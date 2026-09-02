import Foundation

/// A single day, reduced to what streaks and stats need. Deliberately a plain
/// value type: all the rules below are then testable without a database.
public struct DayRecord: Sendable, Equatable {
    public var day: Date
    public var totalReps: Int
    public var goalTarget: Int
    public var programCompleted: Bool
    public var isRecoveryDay: Bool

    public init(day: Date, totalReps: Int, goalTarget: Int,
                programCompleted: Bool = false, isRecoveryDay: Bool = false) {
        self.day = day
        self.totalReps = totalReps
        self.goalTarget = goalTarget
        self.programCompleted = programCompleted
        self.isRecoveryDay = isRecoveryDay
    }

    /// A day counts toward the streak if the user did what was asked of them,
    /// which is not the same as "did push-ups". A prescribed recovery day is a
    /// day they followed the plan.
    public var qualifies: Bool {
        if isRecoveryDay || programCompleted { return true }
        return goalTarget > 0 && totalReps >= goalTarget
    }
}

public struct StreakCalculator {
    public var calendar: Calendar

    public init(calendar: Calendar = .current) {
        self.calendar = calendar
    }

    /// Current streak length in days.
    ///
    /// Today not being finished yet must not read as a broken streak -- the
    /// user still has the rest of the day. So an unqualified today is skipped
    /// rather than counted as a break, and the streak is measured from
    /// yesterday. Boundaries are local days resolved at read time: storing a
    /// "streak day" as a fixed string is what breaks streaks when travelling.
    public func currentStreak(records: [DayRecord], asOf now: Date = Date()) -> Int {
        let byDay = Dictionary(
            records.map { (calendar.startOfDay(for: $0.day), $0) },
            uniquingKeysWith: { a, b in a.totalReps >= b.totalReps ? a : b }
        )

        var cursor = calendar.startOfDay(for: now)
        if byDay[cursor]?.qualifies != true {
            guard let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor) else { return 0 }
            cursor = yesterday
        }

        var streak = 0
        while byDay[cursor]?.qualifies == true {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return streak
    }

    public func longestStreak(records: [DayRecord]) -> Int {
        let days = records.filter(\.qualifies)
            .map { calendar.startOfDay(for: $0.day) }
            .reduce(into: Set<Date>()) { $0.insert($1) }
            .sorted()
        guard !days.isEmpty else { return 0 }

        var best = 1, run = 1
        for i in 1..<days.count {
            let expected = calendar.date(byAdding: .day, value: 1, to: days[i - 1])
            run = expected.map { calendar.isDate($0, inSameDayAs: days[i]) } == true ? run + 1 : 1
            best = max(best, run)
        }
        return best
    }
}

public struct PersonalRecords: Sendable, Equatable {
    public var bestSet: Int = 0
    public var bestDay: Int = 0
    public var bestWeek: Int = 0
    public var bestMonth: Int = 0
    public var longestStreak: Int = 0
    public var lifetimeTotal: Int = 0

    public init() {}
}

/// All derived, never stored. Denormalised counters are the classic source of
/// "my streak is wrong", and a wrong streak in a habit app is a churn event.
public struct StatsEngine {
    public var calendar: Calendar

    public init(calendar: Calendar = .current) {
        self.calendar = calendar
    }

    public func total(_ records: [DayRecord], in interval: DateInterval) -> Int {
        records.filter { interval.contains($0.day) }.reduce(0) { $0 + $1.totalReps }
    }

    public func today(_ records: [DayRecord], asOf now: Date = Date()) -> Int {
        let start = calendar.startOfDay(for: now)
        return records.filter { calendar.isDate($0.day, inSameDayAs: start) }
            .reduce(0) { $0 + $1.totalReps }
    }

    public func thisWeek(_ records: [DayRecord], asOf now: Date = Date()) -> Int {
        guard let week = calendar.dateInterval(of: .weekOfYear, for: now) else { return 0 }
        return total(records, in: week)
    }

    public func thisMonth(_ records: [DayRecord], asOf now: Date = Date()) -> Int {
        guard let month = calendar.dateInterval(of: .month, for: now) else { return 0 }
        return total(records, in: month)
    }

    public func records(days: [DayRecord], bestSet: Int) -> PersonalRecords {
        var result = PersonalRecords()
        result.bestSet = bestSet
        result.bestDay = days.map(\.totalReps).max() ?? 0
        result.lifetimeTotal = days.reduce(0) { $0 + $1.totalReps }
        result.longestStreak = StreakCalculator(calendar: calendar).longestStreak(records: days)
        result.bestWeek = bestTotal(days, by: .weekOfYear)
        result.bestMonth = bestTotal(days, by: .month)
        return result
    }

    private func bestTotal(_ days: [DayRecord], by component: Calendar.Component) -> Int {
        var buckets: [Date: Int] = [:]
        for day in days {
            guard let interval = calendar.dateInterval(of: component, for: day.day) else { continue }
            buckets[interval.start, default: 0] += day.totalReps
        }
        return buckets.values.max() ?? 0
    }

    /// Reps needed today to keep the streak alive. Drives the home screen's
    /// single most important line of text.
    public func remainingToday(_ records: [DayRecord], goal: Int, asOf now: Date = Date()) -> Int {
        max(0, goal - today(records, asOf: now))
    }
}
