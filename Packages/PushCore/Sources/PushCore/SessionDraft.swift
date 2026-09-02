import Foundation

/// A workout in progress, persisted after every completed set.
///
/// A phone call, a stray notification, or the system reclaiming memory mid-set
/// must not cost somebody their workout. Those reps happened; the app owes
/// them. Checkpointing after each set is cheap and means the worst case is
/// losing the set currently underway rather than all of them.
public struct SessionDraft: Codable, Equatable, Sendable {
    public var startedAt: Date
    public var sourceRaw: String
    public var countingModeRaw: String
    public var programSlug: String?
    public var programDayIndex: Int?
    public var targets: [Int]
    public var restSeconds: [Int]
    public var completedSets: [Int]

    public init(startedAt: Date, source: SessionSource, countingMode: CountingMode,
                programSlug: String? = nil, programDayIndex: Int? = nil,
                targets: [Int], restSeconds: [Int], completedSets: [Int]) {
        self.startedAt = startedAt
        self.sourceRaw = source.rawValue
        self.countingModeRaw = countingMode.rawValue
        self.programSlug = programSlug
        self.programDayIndex = programDayIndex
        self.targets = targets
        self.restSeconds = restSeconds
        self.completedSets = completedSets
    }

    public var source: SessionSource { SessionSource(rawValue: sourceRaw) ?? .justPush }
    public var countingMode: CountingMode { CountingMode(rawValue: countingModeRaw) ?? .manual }
    public var totalReps: Int { completedSets.reduce(0, +) }
    public var isWorthResuming: Bool { totalReps > 0 && completedSets.count < targets.count }
}

/// Where drafts live. UserDefaults rather than SwiftData on purpose: a
/// half-finished workout must never appear in totals, streaks or records, and
/// the surest way to guarantee that is for it not to be in the database at all.
public final class SessionDraftStore {
    public static let key = "app.push.activeSessionDraft"

    /// Older than this and the user has moved on. Resuming a workout from
    /// yesterday would be worse than dropping it.
    public static let expiry: TimeInterval = 6 * 60 * 60

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func save(_ draft: SessionDraft) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        defaults.set(data, forKey: Self.key)
    }

    public func load(now: Date = Date()) -> SessionDraft? {
        guard let data = defaults.data(forKey: Self.key),
              let draft = try? JSONDecoder().decode(SessionDraft.self, from: data)
        else { return nil }

        guard now.timeIntervalSince(draft.startedAt) < Self.expiry else {
            clear()
            return nil
        }
        return draft.isWorthResuming ? draft : nil
    }

    public func clear() {
        defaults.removeObject(forKey: Self.key)
    }
}
