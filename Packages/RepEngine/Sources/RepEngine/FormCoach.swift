import Foundation

/// Coaching hints derived from a completed rep.
///
/// Poor-form reps still count. The product is explicit that the app is a coach
/// and not a referee, so form never gates a count - it only ever adds a hint,
/// and at most one at a time.
public enum FormHint: String, Sendable, CaseIterable {
    case straighterBack = "Try keeping your back straighter"
    case hipsLower = "Hips a little lower"
    case goLower = "Try going a little lower"
    case slowDown = "Slow down"
}

public struct FormCoach {
    private let tuning: RepEngineTuning
    private var lastHintRep = -99

    /// Hints are rationed. Correcting somebody on every single rep is the
    /// fastest way to make a coach feel like a referee.
    public var repsBetweenHints = 4

    public init(tuning: RepEngineTuning = RepEngineTuning()) {
        self.tuning = tuning
    }

    public mutating func hint(for rep: CountedRep) -> FormHint? {
        guard rep.index - lastHintRep >= repsBetweenHints else { return nil }
        guard let hint = evaluate(rep) else { return nil }
        lastHintRep = rep.index
        return hint
    }

    private func evaluate(_ rep: CountedRep) -> FormHint? {
        if let deviation = rep.hipDeviation, deviation > tuning.backDeviationDegrees {
            return .straighterBack
        }
        if rep.minElbowAngle > tuning.shallowDepthAngle { return .goLower }
        if rep.duration < tuning.fastTempoSeconds { return .slowDown }
        return nil
    }

    /// A per-session score, 0...1, for the summary screen. Depth consistency
    /// matters more than absolute depth: everybody's honest depth differs.
    public static func sessionScore(_ reps: [CountedRep], tuning: RepEngineTuning = RepEngineTuning()) -> Double? {
        guard reps.count >= 3 else { return nil }
        let depths = reps.map(\.minElbowAngle)
        let mean = depths.reduce(0, +) / Double(depths.count)
        let variance = depths.reduce(0) { $0 + pow($1 - mean, 2) } / Double(depths.count)
        let consistency = max(0, 1 - variance.squareRoot() / 25)

        let deviations = reps.compactMap(\.hipDeviation)
        let backline = deviations.isEmpty ? 1.0
            : max(0, 1 - Geometry.median(deviations) / (tuning.backDeviationDegrees * 2))
        let depth = max(0, min(1, (tuning.shallowDepthAngle - mean) / 30 + 0.5))

        return 0.4 * consistency + 0.3 * backline + 0.3 * depth
    }
}
