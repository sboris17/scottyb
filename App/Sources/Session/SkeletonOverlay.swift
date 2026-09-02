import SwiftUI
import RepEngine

/// Draws the joints Vision is actually finding, on top of the camera preview.
///
/// This is the single most useful thing on screen when counting misbehaves.
/// No skeleton means Vision cannot see a body at all, and no amount of
/// threshold tuning will help. A skeleton that tracks you means detection is
/// fine and the problem is downstream. Without it, "it didn't count" is
/// unfalsifiable.
struct SkeletonOverlay: View {
    let frame: PoseFrame?
    let minimumConfidence: Double

    init(frame: PoseFrame?, minimumConfidence: Double = 0.3) {
        self.frame = frame
        self.minimumConfidence = minimumConfidence
    }

    /// Camera buffer is 640x480, and the preview uses .resizeAspect, so the
    /// video sits letterboxed inside the view. Vision's coordinates are
    /// relative to that rect, not to the whole view.
    private static let bufferAspect: CGFloat = 4.0 / 3.0

    private static let bones: [(JointName, JointName)] = [
        (.leftShoulder, .leftElbow), (.leftElbow, .leftWrist),
        (.leftShoulder, .leftHip), (.leftHip, .leftKnee), (.leftKnee, .leftAnkle),
        (.rightShoulder, .rightElbow), (.rightElbow, .rightWrist),
        (.rightShoulder, .rightHip), (.rightHip, .rightKnee), (.rightKnee, .rightAnkle),
        (.leftShoulder, .rightShoulder), (.leftHip, .rightHip),
    ]

    private func videoRect(in size: CGSize) -> CGRect {
        let viewAspect = size.width / max(size.height, 1)
        if viewAspect > Self.bufferAspect {
            let width = size.height * Self.bufferAspect
            return CGRect(x: (size.width - width) / 2, y: 0, width: width, height: size.height)
        }
        let height = size.width / Self.bufferAspect
        return CGRect(x: 0, y: (size.height - height) / 2, width: size.width, height: height)
    }

    /// Vision's origin is bottom-left; SwiftUI's is top-left.
    private func point(_ joint: JointPoint, in rect: CGRect) -> CGPoint {
        CGPoint(x: rect.minX + joint.position.x * rect.width,
                y: rect.minY + (1 - joint.position.y) * rect.height)
    }

    var body: some View {
        Canvas { context, size in
            guard let frame else { return }
            let rect = videoRect(in: size)

            for (a, b) in Self.bones {
                guard let first = frame[a], let second = frame[b],
                      first.confidence >= minimumConfidence,
                      second.confidence >= minimumConfidence else { continue }
                var path = Path()
                path.move(to: point(first, in: rect))
                path.addLine(to: point(second, in: rect))
                context.stroke(path, with: .color(.green.opacity(0.9)), lineWidth: 3)
            }

            for (_, joint) in frame.joints where joint.confidence >= minimumConfidence {
                let centre = point(joint, in: rect)
                // Brighter dot for a more confident joint, so a marginal
                // detection is visibly marginal.
                let strength = min(1, max(0.3, joint.confidence))
                context.fill(
                    Path(ellipseIn: CGRect(x: centre.x - 4, y: centre.y - 4, width: 8, height: 8)),
                    with: .color(.yellow.opacity(strength)))
            }
        }
        .allowsHitTesting(false)
    }
}
