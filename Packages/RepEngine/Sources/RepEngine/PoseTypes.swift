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

/// A frame reduced to what the counter needs.
///
/// The body is tracked as a 2D point - the midpoint of shoulder and hip -
/// rather than a height. A height assumes the phone knows which way is up,
/// and a phone propped on a floor does not: iOS reports no useful orientation
/// for it. Distances and projections are the same under any rotation, so
/// nothing downstream depends on the camera's angle.
public struct RepSignal: Sendable {
    public var time: Double
    public var elbowAngle: Double
    public var torsoCentre: Point2D
    public var torsoLength: Double
    public var hipAngle: Double?
    public var isConfident: Bool

    /// Weakest confidence among the joints this frame actually needed, kept
    /// even when the frame was rejected. Without it, "not confident enough"
    /// is unfalsifiable: there is no way to tell a frame that missed the gate
    /// by a hair from one where nothing was detected.
    public var jointConfidence: Double = 0

    public static func unusable(at time: Double, confidence: Double = 0) -> RepSignal {
        RepSignal(time: time, elbowAngle: 0, torsoCentre: Point2D(x: 0, y: 0),
                  torsoLength: 1, hipAngle: nil, isConfident: false,
                  jointConfidence: confidence)
    }
}

public struct CountedRep: Sendable, Identifiable {
    public var id: Int { index }
    public var index: Int
    public var startedAt: Double
    public var endedAt: Double
    public var minElbowAngle: Double
    public var maxElbowAngle: Double
    /// Distance the body moved, as a fraction of torso length. Rotation-free.
    public var bodyTravel: Double
    public var hipDeviation: Double?

    public var duration: Double { endedAt - startedAt }
}

/// Why a candidate rep was not counted. Surfaced for debugging and for the
/// framing coach, never shown raw to the user.
public enum RepRejection: String, Sendable {
    case tooFast = "too-fast"
    case tooSlow = "too-slow"
    case noBodyTravel = "no-body-travel"
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
    public var torsoCentre = Point2D(x: 0, y: 0)
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

    /// How many times a rep got as far as being judged. The distinction that
    /// matters most when nothing is counting: zero candidates means the elbow
    /// angle never swung far enough to look like a rep at all, which is an
    /// upstream problem (usually the camera is head-on rather than side-on,
    /// where the arm is foreshortened). A non-zero count with no reps means
    /// the movement was seen and a specific guard rejected it.
    public var candidateReps = 0

    /// Frame accounting. A high rejection rate points at confidence or
    /// framing; a low one means frames were fine and the guards disagreed.
    public var usableFrames = 0
    public var unusableFrames = 0
    public var jointConfidence: Double = 0

    public var usableFrameFraction: Double {
        let total = usableFrames + unusableFrames
        return total == 0 ? 0 : Double(usableFrames) / Double(total)
    }

    /// Widest elbow-angle span seen this session, before any thresholds.
    public var minAngleSeen = Double.infinity
    public var maxAngleSeen = -Double.infinity

    public var angleSpanSeen: Double {
        maxAngleSeen > minAngleSeen ? maxAngleSeen - minAngleSeen : 0
    }

    // Public structs get an internal memberwise init, so the app target
    // cannot construct one without this.
    public init() {}
}
