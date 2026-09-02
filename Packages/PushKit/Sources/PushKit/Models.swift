import Foundation
import SwiftData

// CloudKit mirroring requires every attribute to have a default and every
// relationship to be optional. Designing for that from the first model version
// is much cheaper than migrating into it later.

public enum CountingMode: String, Codable, Sendable, CaseIterable {
    case camera, watch, manual

    /// Only sensed reps can ever back a leaderboard claim. Manual reps stay
    /// fully valid for streaks, goals and personal statistics.
    public var isVerifiable: Bool { self != .manual }
}

public enum SessionSource: String, Codable, Sendable {
    case program, justPush, manual
}

@Model
public final class Profile {
    public var id: UUID = UUID()
    public var displayName: String = ""
    public var createdAt: Date = Date()
    public var maxRepsAtOnboarding: Int = 0
    public var currentMax: Int = 0
    public var dailyGoal: Int = 25
    public var difficultyPreference: Int = 1        // 0 easy, 1 standard, 2 hard
    public var preferredCountingMode: String = CountingMode.camera.rawValue
    public var modifiedAt: Date = Date()

    public init(displayName: String = "", dailyGoal: Int = 25) {
        self.displayName = displayName
        self.dailyGoal = dailyGoal
    }
}

@Model
public final class Session {
    public var id: UUID = UUID()
    public var startedAt: Date = Date()
    public var endedAt: Date?
    public var sourceRaw: String = SessionSource.justPush.rawValue
    public var countingModeRaw: String = CountingMode.manual.rawValue
    public var programSlug: String?
    public var programDayIndex: Int?
    public var totalReps: Int = 0
    public var isVerified: Bool = false
    public var formScore: Double?
    public var modifiedAt: Date = Date()

    @Relationship(deleteRule: .cascade, inverse: \WorkoutSet.session)
    public var sets: [WorkoutSet]? = []

    public init(source: SessionSource = .justPush, countingMode: CountingMode = .manual) {
        self.sourceRaw = source.rawValue
        self.countingModeRaw = countingMode.rawValue
        self.isVerified = countingMode.isVerifiable
    }

    public var source: SessionSource { SessionSource(rawValue: sourceRaw) ?? .justPush }
    public var countingMode: CountingMode { CountingMode(rawValue: countingModeRaw) ?? .manual }
    public var orderedSets: [WorkoutSet] { (sets ?? []).sorted { $0.index < $1.index } }
    public var bestSet: Int { (sets ?? []).map(\.completedReps).max() ?? 0 }
}

@Model
public final class WorkoutSet {
    public var id: UUID = UUID()
    public var index: Int = 0
    public var targetReps: Int?
    public var completedReps: Int = 0
    public var startedAt: Date = Date()
    public var endedAt: Date?
    public var restDurationAfter: TimeInterval = 0
    public var session: Session?

    @Relationship(deleteRule: .cascade, inverse: \RepSample.set)
    public var samples: [RepSample]? = []

    public init(index: Int, targetReps: Int? = nil) {
        self.index = index
        self.targetReps = targetReps
    }
}

/// One row per sensed rep. A few dozen bytes each -- even ten thousand
/// lifetime reps is well under a megabyte -- and it is what makes form trends
/// possible later without re-recording anything.
@Model
public final class RepSample {
    public var id: UUID = UUID()
    public var timestamp: Date = Date()
    public var durationSeconds: Double = 0
    public var minElbowAngle: Double = 0
    public var hipDeviation: Double?
    public var set: WorkoutSet?

    public init(timestamp: Date, durationSeconds: Double, minElbowAngle: Double, hipDeviation: Double?) {
        self.timestamp = timestamp
        self.durationSeconds = durationSeconds
        self.minElbowAngle = minElbowAngle
        self.hipDeviation = hipDeviation
    }
}

@Model
public final class ProgramEnrollment {
    public var id: UUID = UUID()
    public var programSlug: String = ""
    public var startedAt: Date = Date()
    public var currentDayIndex: Int = 0
    public var completedDayIndices: [Int] = []
    /// Signed difficulty adjustment the adaptive engine has accumulated.
    public var adaptationOffset: Int = 0
    public var completedAt: Date?
    public var modifiedAt: Date = Date()

    public init(programSlug: String) {
        self.programSlug = programSlug
    }
}

public enum GoalKind: String, Codable, Sendable, CaseIterable {
    case dailyReps, monthlyTotal, consecutiveReps, lifetimeTotal, custom

    public var title: String {
        switch self {
        case .dailyReps: return "Push-ups every day"
        case .monthlyTotal: return "Push-ups this month"
        case .consecutiveReps: return "Consecutive push-ups"
        case .lifetimeTotal: return "Lifetime push-ups"
        case .custom: return "Custom goal"
        }
    }
}

@Model
public final class Goal {
    public var id: UUID = UUID()
    public var kindRaw: String = GoalKind.dailyReps.rawValue
    public var targetValue: Int = 25
    public var periodStart: Date = Date()
    public var periodEnd: Date?
    public var isActive: Bool = true
    public var completedAt: Date?
    public var label: String = ""

    public init(kind: GoalKind, targetValue: Int, label: String = "") {
        self.kindRaw = kind.rawValue
        self.targetValue = targetValue
        self.label = label
    }

    public var kind: GoalKind { GoalKind(rawValue: kindRaw) ?? .dailyReps }
}

@Model
public final class AchievementUnlock {
    public var id: UUID = UUID()
    public var slug: String = ""
    public var unlockedAt: Date = Date()

    public init(slug: String, unlockedAt: Date = Date()) {
        self.slug = slug
        self.unlockedAt = unlockedAt
    }
}

/// Read-through cache so the stats screen and streak do not scan every session
/// on every launch. It must always be reconstructible from `Session` alone --
/// there is a test that proves it.
@Model
public final class DailyRollup {
    public var id: UUID = UUID()
    public var day: Date = Date()          // start of the user's local day
    public var totalReps: Int = 0
    public var sessionCount: Int = 0
    public var goalTarget: Int = 0
    public var programCompleted: Bool = false
    public var isRecoveryDay: Bool = false

    public init(day: Date, totalReps: Int, sessionCount: Int, goalTarget: Int,
                programCompleted: Bool = false, isRecoveryDay: Bool = false) {
        self.day = day
        self.totalReps = totalReps
        self.sessionCount = sessionCount
        self.goalTarget = goalTarget
        self.programCompleted = programCompleted
        self.isRecoveryDay = isRecoveryDay
    }
}

public enum PushSchema {
    public static let models: [any PersistentModel.Type] = [
        Profile.self, Session.self, WorkoutSet.self, RepSample.self,
        ProgramEnrollment.self, Goal.self, AchievementUnlock.self, DailyRollup.self,
    ]
}
