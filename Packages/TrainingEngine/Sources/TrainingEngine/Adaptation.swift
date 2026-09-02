import Foundation

public struct SetResult: Sendable, Equatable {
    public var targetReps: Int
    public var completedReps: Int

    public init(targetReps: Int, completedReps: Int) {
        self.targetReps = targetReps
        self.completedReps = completedReps
    }

    public var ratio: Double {
        targetReps <= 0 ? 1 : Double(completedReps) / Double(targetReps)
    }
}

public enum AdaptationVerdict: String, Sendable {
    case easier, hold, harder

    public var offsetDelta: Int {
        switch self {
        case .easier: return -1
        case .hold: return 0
        case .harder: return 1
        }
    }
}

/// Adjusts future workouts from what actually happened in this one.
///
/// The product describes exactly this: struggling on the last set of 3x15
/// should ease off, and consistently beating the prescription should push
/// harder. The engine is deliberately slow to move -- one step per session --
/// because a program that lurches around feels broken rather than responsive.
public struct AdaptationEngine {
    public var maximumOffset = 6
    public var minimumOffset = -6

    public init() {}

    public func verdict(for sets: [SetResult]) -> AdaptationVerdict {
        guard !sets.isEmpty else { return .hold }

        let completedAll = sets.allSatisfy { $0.completedReps >= $0.targetReps }
        let overshoot = sets.reduce(0) { $0 + max(0, $1.completedReps - $1.targetReps) }

        if completedAll && overshoot >= max(2, sets.count) { return .harder }
        if completedAll { return .hold }

        // The final set is the honest signal. Falling apart on set one is a
        // warm-up problem; falling short on the last set is a dose problem.
        if let last = sets.last, last.ratio < 0.8 { return .easier }

        let shortfall = sets.reduce(0) { $0 + max(0, $1.targetReps - $1.completedReps) }
        let target = sets.reduce(0) { $0 + $1.targetReps }
        return Double(shortfall) / Double(max(target, 1)) > 0.15 ? .easier : .hold
    }

    public func nextOffset(current: Int, sets: [SetResult]) -> Int {
        min(maximumOffset, max(minimumOffset, current + verdict(for: sets).offsetDelta))
    }

    /// Applies the accumulated offset to a prescribed day.
    ///
    /// Scales by percentage rather than adding a flat number of reps: +2 reps
    /// is trivial on a set of 40 and brutal on a set of 4.
    public func adjust(_ day: ProgramDay, offset: Int) -> ProgramDay {
        guard offset != 0, !day.isRecoveryDay else { return day }
        let factor = 1 + 0.07 * Double(offset)
        var adjusted = day
        adjusted.sets = day.sets.map {
            SetPrescription(targetReps: max(1, Int((Double($0.targetReps) * factor).rounded())),
                            restSeconds: $0.restSeconds)
        }
        return adjusted
    }
}

/// Picks a starting program from the onboarding answers.
public enum ProgramRecommender {
    public static func recommend(maxReps: Int, wantsHabitOverStrength: Bool = false) -> Program {
        if wantsHabitOverStrength { return ProgramLibrary.dailyPush }
        switch maxReps {
        case ..<5: return ProgramLibrary.firstTen
        case 5..<15: return ProgramLibrary.roadTo(25)
        case 15..<30: return ProgramLibrary.roadTo(50)
        default: return ProgramLibrary.roadTo(100)
        }
    }

    /// A sensible daily goal for someone whose best set is `maxReps`.
    ///
    /// Roughly three workable sets. Deliberately modest: the failure mode that
    /// kills habit apps is a goal the user misses on day three.
    public static func dailyGoal(maxReps: Int) -> Int {
        let raw = max(10, Int((Double(max(maxReps, 1)) * 2.5).rounded()))
        return min(raw, 200) / 5 * 5
    }
}
