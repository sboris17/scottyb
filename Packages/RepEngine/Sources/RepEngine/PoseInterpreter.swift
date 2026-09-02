import Foundation

/// Reduces a pose frame to the scalars the counter needs, picking whichever
/// arm the camera can actually see. In a side-on view the far arm is occluded
/// by the body, so it arrives noisy and low-confidence; taking the better of
/// the two is most of the robustness here.
public struct PoseInterpreter {
    private let tuning: RepEngineTuning
    private var angleFilter: OneEuroFilter
    private var centreFilterX: OneEuroFilter
    private var centreFilterY: OneEuroFilter

    public init(tuning: RepEngineTuning = RepEngineTuning()) {
        self.tuning = tuning
        self.angleFilter = OneEuroFilter(minCutoff: 1.2, beta: 0.05)
        self.centreFilterX = OneEuroFilter(minCutoff: 1.0, beta: 0.02)
        self.centreFilterY = OneEuroFilter(minCutoff: 1.0, beta: 0.02)
    }

    public mutating func signal(from frame: PoseFrame) -> RepSignal {
        var best: (confidence: Double, side: JointName.Side)?
        for side in [JointName.Side.left, .right] {
            guard let shoulder = frame[.shoulder(side)],
                  let elbow = frame[.elbow(side)],
                  let wrist = frame[.wrist(side)] else { continue }
            let confidence = min(shoulder.confidence, min(elbow.confidence, wrist.confidence))
            if best == nil || confidence > best!.confidence {
                best = (confidence, side)
            }
        }

        // The hip is taken from whichever side is more confident, rather than
        // the side the arm came from. Viewed side-on the two hips almost
        // coincide, so tying them together buys nothing and costs everything:
        // one unreliable hip made every frame unusable and the count sat at
        // zero, while the skeleton kept drawing perfectly from the other
        // joints. Green lines, no count, and nothing visibly wrong.
        let hipSide: JointName.Side =
            (frame[.hip(.left)]?.confidence ?? 0) >= (frame[.hip(.right)]?.confidence ?? 0) ? .left : .right

        guard let choice = best, choice.confidence >= tuning.minJointConfidence,
              let shoulder = frame[.shoulder(choice.side)],
              let elbow = frame[.elbow(choice.side)],
              let wrist = frame[.wrist(choice.side)],
              let hip = frame[.hip(hipSide)], hip.confidence >= tuning.minJointConfidence,
              let rawAngle = Geometry.angle(shoulder.position, vertex: elbow.position, wrist.position)
        else {
            return .unusable(at: frame.time)
        }

        var hipAngle: Double?
        if let knee = frame[.knee(hipSide)], knee.confidence >= tuning.minJointConfidence {
            hipAngle = Geometry.angle(shoulder.position, vertex: hip.position, knee.position)
        }

        // Midpoint of shoulder and hip. Averaging two independently-jittering
        // joints cancels part of the noise, while a real push-up moves both
        // together - which is what makes the travel guard trustworthy.
        let centre = Point2D(x: (shoulder.position.x + hip.position.x) / 2,
                             y: (shoulder.position.y + hip.position.y) / 2)
        return RepSignal(
            time: frame.time,
            elbowAngle: angleFilter.filter(rawAngle, at: frame.time),
            torsoCentre: Point2D(x: centreFilterX.filter(centre.x, at: frame.time),
                                 y: centreFilterY.filter(centre.y, at: frame.time)),
            torsoLength: shoulder.position.distance(to: hip.position),
            hipAngle: hipAngle,
            isConfident: true
        )
    }
}
