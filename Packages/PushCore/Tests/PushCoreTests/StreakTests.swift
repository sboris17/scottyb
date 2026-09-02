import XCTest
@testable import PushCore

final class StreakTests: XCTestCase {
    private var calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "America/New_York")!
        return c
    }()

    private func day(_ offset: Int, reps: Int, goal: Int = 25,
                     recovery: Bool = false, programDone: Bool = false,
                     from reference: Date) -> DayRecord {
        let date = calendar.date(byAdding: .day, value: offset, to: reference)!
        return DayRecord(day: date, totalReps: reps, goalTarget: goal,
                         programCompleted: programDone, isRecoveryDay: recovery)
    }

    private var now: Date {
        calendar.date(from: DateComponents(year: 2026, month: 9, day: 2, hour: 14))!
    }

    func testConsecutiveQualifyingDays() {
        let records = (0...4).map { day(-$0, reps: 30, from: now) }
        XCTAssertEqual(StreakCalculator(calendar: calendar).currentStreak(records: records, asOf: now), 5)
    }

    /// The subtle one. At 9am with nothing logged yet, the user has not broken
    /// their streak -- they still have all day. Reporting 0 here would be a
    /// churn event in a habit app.
    func testTodayIncompleteDoesNotBreakStreak() {
        let records = (1...4).map { day(-$0, reps: 30, from: now) }
        XCTAssertEqual(StreakCalculator(calendar: calendar).currentStreak(records: records, asOf: now), 4)
    }

    func testMissedYesterdayResetsStreak() {
        var records = [day(0, reps: 30, from: now)]
        records.append(day(-1, reps: 4, from: now))       // short of goal
        records.append(day(-2, reps: 30, from: now))
        XCTAssertEqual(StreakCalculator(calendar: calendar).currentStreak(records: records, asOf: now), 1)
    }

    /// The product says a prescribed recovery day keeps the streak. That means
    /// the streak measures "showed up as prescribed", not "did push-ups".
    func testRecoveryDayPreservesStreak() {
        var records = [day(0, reps: 30, from: now), day(-1, reps: 0, goal: 25, recovery: true, from: now)]
        records.append(day(-2, reps: 30, from: now))
        XCTAssertEqual(StreakCalculator(calendar: calendar).currentStreak(records: records, asOf: now), 3)
    }

    func testCompletingProgramDayCountsEvenBelowDailyGoal() {
        let records = [day(0, reps: 5, goal: 50, programDone: true, from: now)]
        XCTAssertEqual(StreakCalculator(calendar: calendar).currentStreak(records: records, asOf: now), 1)
    }

    func testEmptyHistoryHasNoStreak() {
        XCTAssertEqual(StreakCalculator(calendar: calendar).currentStreak(records: [], asOf: now), 0)
    }

    func testLongestStreakFindsBestRun() {
        var records = (0...2).map { day(-$0, reps: 30, from: now) }            // 3
        records += (5...11).map { day(-$0, reps: 30, from: now) }              // 7
        XCTAssertEqual(StreakCalculator(calendar: calendar).longestStreak(records: records), 7)
    }

    /// Timestamps are stored in UTC and resolved to local days at read time,
    /// so flying across a timezone must not silently break a long streak.
    func testStreakSurvivesTimezoneChange() {
        let records = (0...9).map { day(-$0, reps: 30, from: now) }
        var tokyo = Calendar(identifier: .gregorian)
        tokyo.timeZone = TimeZone(identifier: "Asia/Tokyo")!
        let streak = StreakCalculator(calendar: tokyo).currentStreak(records: records, asOf: now)
        XCTAssertGreaterThanOrEqual(streak, 9, "a timezone change should not cost more than the boundary day")
    }
}

final class StatsEngineTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)

    func testPersonalRecordsAggregate() {
        let now = Date()
        let days = (0..<10).map { i in
            DayRecord(day: calendar.date(byAdding: .day, value: -i, to: now)!,
                      totalReps: 10 * (i + 1), goalTarget: 25)
        }
        let records = StatsEngine(calendar: calendar).records(days: days, bestSet: 42)
        XCTAssertEqual(records.bestSet, 42)
        XCTAssertEqual(records.bestDay, 100)
        XCTAssertEqual(records.lifetimeTotal, 550)
    }

    func testRemainingTodayNeverNegative() {
        let engine = StatsEngine(calendar: calendar)
        let today = [DayRecord(day: Date(), totalReps: 80, goalTarget: 50)]
        XCTAssertEqual(engine.remainingToday(today, goal: 50), 0)
    }
}

final class AchievementTests: XCTestCase {
    func testUnlocksAreNotRepeated() {
        let progress = AchievementProgress(lifetimeReps: 1_200, bestSet: 30,
                                           currentStreak: 8, sessionsCompleted: 40)
        let first = AchievementCatalog.newlyUnlocked(progress: progress, alreadyUnlocked: [])
        XCTAssertTrue(first.contains { $0.slug == "lifetime-1000" })

        let banked = Set(first.map(\.slug))
        let second = AchievementCatalog.newlyUnlocked(progress: progress, alreadyUnlocked: banked)
        XCTAssertTrue(second.isEmpty, "a milestone celebrated twice cheapens every one of them")
    }

    func testThresholdsAreExclusiveBelowTarget() {
        let progress = AchievementProgress(lifetimeReps: 99, bestSet: 24,
                                           currentStreak: 6, sessionsCompleted: 1)
        let slugs = Set(AchievementCatalog.satisfied(by: progress).map(\.slug))
        XCTAssertFalse(slugs.contains("first-100"))
        XCTAssertFalse(slugs.contains("set-25"))
        XCTAssertFalse(slugs.contains("streak-7"))
        XCTAssertTrue(slugs.contains("first-set"))
    }
}
