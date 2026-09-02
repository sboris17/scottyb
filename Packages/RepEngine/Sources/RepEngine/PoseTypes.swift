import Foundation

public enum JointName: String, CaseIterable, Sendable {
    case leftShoulder, leftElbow, leftWrist, leftHip, leftKnee, leftAnkle
    case rightShoulder, rightElbow, rightWrist, rightHip, rightKnee, rightAnkle

    public enum Side: String, Sendable { case left, right }

    public static func shoulder(_ s: Side) -> JointName { s == .left ? .leftShoulder : .rightShoulder }
    public static func elbow(_ s: Side) -> JointName { s == .left ? .leftElbow : .rightElbow }
    public static func wrist(_ s: Side) -> JointName { s == .left ? .leftWrist : .rightWrist }
    public static func hip(_ s: Side) -> JointName { s == .left ? .leftHip : .rightHip }
    public static func knee(_ s: Side) -> JointName { s == .left ? .leftKnee : .rightKnee }
}

public struct JointPoint: Sendable {
    public var position: Point2D
    public var confidence: Double

    public init(position: Point2D, confidence: Double) {
        self.position = position
        self.confidence = confidence
    }
}

/// One frame of detected pose. The app layer converts Vision's observation
/// into this; the engine never imports Vision.
public struct PoseFrame: Sendable {
    public var time: Double
    public var joints: [JointName: JointPoint]

    public init(time: Double, joints: [JointName: JointPoint]) {
        self.time = time
        self.joints = joints
    }

    public subscript(_ name: JointName) -> JointPoint? { joints[name] }
}

/// A frame reduced to the scalars the counter actually needs.
public struct RepSignal: Sendable {
    public var time: Double
    public var elbowAngle: Double
    public var shoulderHeight: Double
    public var torsoLength: Double
    public var hipAngle: Double?
    public var isConfident: Bool

    public static func unusable(at time: Double) -> RepSignal {
        RepSignal(time: time, elbowAngle: 0, shoulderHeight: 0,
                  torsoLength: 1, hipAngle: nil, isConfident: false)
    }
}

public struct CountedRep: Sendable, Identifiable {
    public var id: Int { index }
    public var index: Int
    public var startedAt: Double
    public var endedAt: Double
    public var minElbowAngle: Double
    public var maxElbowAngle: Double
    public var verticalTravel: Double
    public var hipDeviation: Double?

    public var duration: Double { endedAt - startedAt }
}

/// Why a candidate rep was not counted. Surfaced for debugging and for the
/// framing coach, never shown raw to the user.
public enum RepRejection: String, Sendable {
    case tooFast = "too-fast"
    case tooSlow = "too-slow"
    case noVerticalTravel = "no-vertical-travel"
    case uncorrelated = "uncorrelated"
    case notSmooth = "not-smooth"
    case lostPose = "lost-pose-mid-rep"
}

/// A live view of what the counter is currently seeing and deciding.
///
/// Purely observational -- nothing here feeds back into counting. It exists so
/// that "it isn't counting" can be answered on the spot instead of guessed at.
public struct RepDiagnostics: Sendable {
    public var elbowAngle: Double = 0
    public var shoulderHeight: Double = 0
    public var torsoLength: Double = 0
    public var hipAngle: Double?
    public var isConfident = false
    public var state = "waiting"
    public var thresholds = RepThresholds(top: 150, bottom: 100, isCalibrated: false)

    /// Guard values from the most recent candidate rep, counted or not.
    public var lastTravel: Double = 0
    public var lastCorrelation: Double = 0
    public var lastReversals: Int = 0
    public var lastDuration: Double = 0
    public var lastRejection: RepRejection?
    public var rejectionCounts: [String: Int] = [:]

    // Public structs get an internal memberwise init, so the app target
    // cannot construct one without this.
    public init() {}
}
