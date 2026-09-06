import Foundation

public struct Achievement: Sendable, Identifiable, Equatable {
    public enum Criteria: Sendable, Equatable {
        case lifetimeReps(Int)
        case singleSet(Int)
        case streakDays(Int)
        case sessionsCompleted(Int)
        case personalRecord
    }

    public var id: String { slug }
    public let slug: String
    public let title: String

    /// An SF Symbol name, not an emoji.
    ///
    /// Emoji were a mistake here for three separate reasons: they render in
    /// another vendor's illustration style that has nothing to do with this
    /// app, they ignore the tint colour so a locked and an unlocked badge can
    /// only be told apart by greyscaling a picture, and they change shape
    /// under you whenever the platform redraws its set.
    public let symbol: String
    public let criteria: Criteria

    public init(slug: String, title: String, symbol: String, criteria: Criteria) {
        self.slug = slug
        self.title = title
        self.symbol = symbol
        self.criteria = criteria
    }
}

public struct AchievementProgress: Sendable {
    public var lifetimeReps: Int
    public var bestSet: Int
    public var currentStreak: Int
    public var sessionsCompleted: Int
    public var setNewRecord: Bool

    public init(lifetimeReps: Int, bestSet: Int, currentStreak: Int,
                sessionsCompleted: Int, setNewRecord: Bool = false) {
        self.lifetimeReps = lifetimeReps
        self.bestSet = bestSet
        self.currentStreak = currentStreak
        self.sessionsCompleted = sessionsCompleted
        self.setNewRecord = setNewRecord
    }
}

public enum AchievementCatalog {
    public static let all: [Achievement] = [
        .init(slug: "first-set", title: "First Set", symbol: "checkmark.seal.fill", criteria: .sessionsCompleted(1)),
        .init(slug: "first-100", title: "First 100", symbol: "rosette", criteria: .lifetimeReps(100)),
        .init(slug: "streak-7", title: "7-Day Streak", symbol: "flame.fill", criteria: .streakDays(7)),
        .init(slug: "streak-30", title: "30-Day Streak", symbol: "flame.fill", criteria: .streakDays(30)),
        .init(slug: "streak-100", title: "100-Day Streak", symbol: "flame.fill", criteria: .streakDays(100)),
        .init(slug: "set-25", title: "25 Consecutive", symbol: "figure.strengthtraining.traditional", criteria: .singleSet(25)),
        .init(slug: "set-50", title: "50 Consecutive", symbol: "figure.strengthtraining.traditional", criteria: .singleSet(50)),
        .init(slug: "set-100", title: "100 Consecutive", symbol: "figure.strengthtraining.traditional", criteria: .singleSet(100)),
        .init(slug: "lifetime-1000", title: "1,000 Lifetime", symbol: "star.fill", criteria: .lifetimeReps(1_000)),
        .init(slug: "lifetime-10000", title: "10,000 Lifetime", symbol: "trophy.fill", criteria: .lifetimeReps(10_000)),
        .init(slug: "personal-record", title: "New Personal Record", symbol: "bolt.fill", criteria: .personalRecord),
    ]

    public static func satisfied(by progress: AchievementProgress) -> [Achievement] {
        all.filter { achievement in
            switch achievement.criteria {
            case .lifetimeReps(let n): return progress.lifetimeReps >= n
            case .singleSet(let n): return progress.bestSet >= n
            case .streakDays(let n): return progress.currentStreak >= n
            case .sessionsCompleted(let n): return progress.sessionsCompleted >= n
            case .personalRecord: return progress.setNewRecord
            }
        }
    }

    /// Achievements to celebrate right now: satisfied, and not already banked.
    /// Celebrating a milestone twice cheapens every one of them.
    public static func newlyUnlocked(progress: AchievementProgress,
                                     alreadyUnlocked: Set<String>) -> [Achievement] {
        satisfied(by: progress).filter { !alreadyUnlocked.contains($0.slug) }
    }
}
