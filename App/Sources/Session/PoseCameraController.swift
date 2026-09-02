import AVFoundation
import QuartzCore
import Vision
import RepEngine
#if canImport(UIKit)
import UIKit
#endif

/// Camera capture and on-device pose detection.
///
/// Everything here is analysis only: frames are read, measured and discarded.
/// Nothing is written to disk and nothing leaves the device, which is both the
/// privacy promise in the permission string and what makes it defensible.
final class PoseCameraController: NSObject {
    enum StartupError: Error, LocalizedError {
        case noCamera, cannotAddInput, cannotAddOutput, denied

        var errorDescription: String? {
            switch self {
            case .noCamera: return "No camera available on this device."
            case .cannotAddInput, .cannotAddOutput: return "Could not start the camera."
            case .denied: return "Camera access is off. You can still count manually."
            }
        }
    }

    /// Vision runs at this rate regardless of the camera's. A push-up takes
    /// one to three seconds, so 15fps is 20-45 samples per rep -- far more than
    /// the state machine needs, and a third of the battery and heat of 30.
    private let targetFrameRate: Double = 15

    let captureSession = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "app.push.pose", qos: .userInitiated)
    private let request = VNDetectHumanBodyPoseRequest()

    private var lastProcessed: CFTimeInterval = 0
    private var startTime: CFTimeInterval?

    /// Delivered on the main queue.
    var onFrame: ((PoseFrame) -> Void)?
    var onFailure: ((Error) -> Void)?

    func requestAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
        default: return false
        }
    }

    func start() async {
        guard await requestAccess() else {
            await MainActor.run { self.onFailure?(StartupError.denied) }
            return
        }
        queue.async { [weak self] in
            guard let self else { return }
            do {
                try self.configureIfNeeded()
                if !self.captureSession.isRunning { self.captureSession.startRunning() }
            } catch {
                DispatchQueue.main.async { self.onFailure?(error) }
            }
        }
    }

    func stop() {
        queue.async { [weak self] in
            guard let self, self.captureSession.isRunning else { return }
            self.captureSession.stopRunning()
        }
    }

    func resetClock() {
        startTime = nil
        lastProcessed = 0
    }

    private var isConfigured = false

    private func configureIfNeeded() throws {
        guard !isConfigured else { return }
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

        // 640x480 is plenty for full-body pose. Higher resolution buys no
        // accuracy here and costs battery, heat and thermal throttling.
        captureSession.sessionPreset = .vga640x480

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
                ?? AVCaptureDevice.default(for: .video) else {
            throw StartupError.noCamera
        }
        let input = try AVCaptureDeviceInput(device: device)
        guard captureSession.canAddInput(input) else { throw StartupError.cannotAddInput }
        captureSession.addInput(input)

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
        ]
        videoOutput.setSampleBufferDelegate(self, queue: queue)
        guard captureSession.canAddOutput(videoOutput) else { throw StartupError.cannotAddOutput }
        captureSession.addOutput(videoOutput)

        isConfigured = true
    }

    /// The engine's height signal assumes image-space "up" is world-up, which
    /// holds only if the buffer is oriented the same way the user is. The
    /// phone is propped on the floor, so this comes from device orientation.
    private var imageOrientation: CGImagePropertyOrientation {
        #if canImport(UIKit)
        switch UIDevice.current.orientation {
        case .landscapeLeft: return .up
        case .landscapeRight: return .down
        case .portraitUpsideDown: return .left
        default: return .right
        }
        #else
        return .right
        #endif
    }
}

extension PoseCameraController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        let now = CACurrentMediaTime()
        guard now - lastProcessed >= 1 / targetFrameRate else { return }
        lastProcessed = now

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer,
                                            orientation: imageOrientation,
                                            options: [:])
        do {
            try handler.perform([request])
        } catch {
            return
        }

        // More than one person in frame: take the most confident and stay with
        // them, rather than flickering between bodies mid-set.
        guard let observations = request.results as? [VNHumanBodyPoseObservation],
              let observation = observations.max(by: { $0.confidence < $1.confidence })
        else { return }

        if startTime == nil { startTime = now }
        let elapsed = now - (startTime ?? now)

        guard let frame = Self.poseFrame(from: observation, time: elapsed) else { return }
        DispatchQueue.main.async { [weak self] in self?.onFrame?(frame) }
    }

    /// Vision's normalized points are origin-bottom-left, matching `Point2D`.
    static func poseFrame(from observation: VNHumanBodyPoseObservation, time: Double) -> PoseFrame? {
        guard let points = try? observation.recognizedPoints(.all) else { return nil }

        let mapping: [VNHumanBodyPoseObservation.JointName: JointName] = [
            .leftShoulder: .leftShoulder, .leftElbow: .leftElbow, .leftWrist: .leftWrist,
            .leftHip: .leftHip, .leftKnee: .leftKnee, .leftAnkle: .leftAnkle,
            .rightShoulder: .rightShoulder, .rightElbow: .rightElbow, .rightWrist: .rightWrist,
            .rightHip: .rightHip, .rightKnee: .rightKnee, .rightAnkle: .rightAnkle,
        ]

        var joints: [JointName: JointPoint] = [:]
        for (visionName, engineName) in mapping {
            guard let point = points[visionName], point.confidence > 0 else { continue }
            joints[engineName] = JointPoint(
                position: Point2D(x: Double(point.location.x), y: Double(point.location.y)),
                confidence: Double(point.confidence)
            )
        }
        return joints.isEmpty ? nil : PoseFrame(time: time, joints: joints)
    }
}
