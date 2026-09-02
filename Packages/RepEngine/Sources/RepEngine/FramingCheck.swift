import Foundation

/// Pre-session framing guidance.
///
/// Getting this right is what keeps the camera path from being a chore. The
/// rule everywhere else in the app: never block on the camera - if framing
/// cannot be fixed quickly, offer manual counting rather than nagging.
public enum FramingIssue: String, Sendable {
    case noPerson = "Point the camera at yourself"
    case armsNotVisible = "Move back so your arms are in frame"
    case bodyNotVisible = "Move back so your hips are in frame"
    case facingCamera = "Place the phone to your side, not in front of you"
    case tooDark = "It's too dark to see you clearly"
}

public struct FramingCheck {
    private let tuning: RepEngineTuning

    public init(tuning: RepEngineTuning = RepEngineTuning()) {
        self.tuning = tuning
    }

    public func evaluate(_ frame: PoseFrame) -> FramingIssue? {
        guard !frame.joints.isEmpty else { return .noPerson }

        let confident = frame.joints.values.filter { $0.confidence >= tuning.minJointConfidence }
        if confident.count < 3 { return .tooDark }

        let sides: [JointName.Side] = [.left, .right]
        let armVisible = sides.contains { side in
            [JointName.shoulder(side), .elbow(side), .wrist(side)]
                .allSatisfy { (frame[$0]?.confidence ?? 0) >= tuning.minJointConfidence }
        }
        guard armVisible else { return .armsNotVisible }

        let hipVisible = sides.contains { (frame[.hip($0)]?.confidence ?? 0) >= tuning.minJointConfidence }
        guard hipVisible else { return .bodyNotVisible }

        // Side-on, the two shoulders very nearly overlap horizontally. Facing
        // the camera separates them, and from that angle the elbow angle is
        // heavily foreshortened and counts badly.
        if let left = frame[.leftShoulder], let right = frame[.rightShoulder],
           left.confidence >= tuning.minJointConfidence,
           right.confidence >= tuning.minJointConfidence,
           let leftHip = frame[.leftHip] {
            let shoulderSpread = abs(left.position.x - right.position.x)
            let torso = max(left.position.distance(to: leftHip.position), 1e-6)
            if shoulderSpread / torso > 0.55 { return .facingCamera }
        }
        return nil
    }
}
