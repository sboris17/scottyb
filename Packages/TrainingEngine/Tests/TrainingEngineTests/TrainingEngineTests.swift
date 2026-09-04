import XCTest
@testable import TrainingEngine

final class ProgramLibraryTests: XCTestCase {
    func testEveryProgramHasDays() {
        for program in ProgramLibrary.all {
            XCTAssertFalse(program.days.isEmpty, "\(program.slug) has no days")
        }
    }

    func testSlugsAreUnique() {
        let slugs = ProgramLibrary.all.map(\.slug)
        XCTAssertEqual(Set(slugs).count, slugs.count)
    }

    func testDayIndicesAreContiguous() {
        for program in ProgramLibrary.all {
            XCTAssertEqual(program.days.map(\.dayIndex), Array(0..<program.days.count),
                           "\(program.slug) has gaps in its day indices")
        }
    }

    /// A "Road to 50" that never asks for 50 push-ups has not kept its promise.
    func testRoadProgramsReachTheirTarget() {
        for target in [25, 50, 100] {
            let program = ProgramLibrary.roadTo(target)
            XCTAssertEqual(program.peakSet, target,
                           "road-to-\(target) peaks at \(program.peakSet)")
        }
    }

    /// Volume must trend upward. A program whose second half is easier than
    /// its first is not a program.
    func testVolumeProgresses() {
        for target in [25, 50, 100] {
            let training = ProgramLibrary.roadTo(target).days.filter { !$0.isRecoveryDay }
            let half = training.count / 2
            let early = training.prefix(half).reduce(0) { $0 + $1.totalReps }
            let late = training.suffix(half).reduce(0) { $0 + $1.totalReps }
            XCTAssertGreaterThan(late, early, "road-to-\(target) does not progress")
        }
    }

    /// Recovery days are what let a streak survive a program, so every
    /// multi-week program needs them.
    func testProgramsIncludeRecoveryDays() {
        for program in [ProgramLibrary.firstTen, ProgramLibrary.roadTo(50)] {
            XCTAssertTrue(program.days.contains(where: \.isRecoveryDay), "\(program.slug) never rests")
        }
    }

    func testFirstDayIsAchievableForABeginner() {
        let firstDay = ProgramLibrary.firstTen.days[0]
        XCTAssertLessThanOrEqual(firstDay.sets.map(\.targetReps).max() ?? 0, 3,
                                 "day one must not be demoralising")
    }

    func testSummaryFormatsUniformSets() {
        let day = ProgramDay(dayIndex: 0, sets: (0..<3).map { _ in SetPrescription(targetReps: 15) })
        XCTAssertEqual(day.summary, "3 x 15")
    }
}

final class AdaptationTests: XCTestCase {
    private let engine = AdaptationEngine()

    /// The scenario named in the product one-pager: 3x15, struggling on the
    /// final set, should make future workouts easier.
    func testStrugglingOnFinalSetEasesOff() {
        let sets = [SetResult(targetReps: 15, completedReps: 15),
                    SetResult(targetReps: 15, completedReps: 15),
                    SetResult(targetReps: 15, completedReps: 9)]
        XCTAssertEqual(engine.verdict(for: sets), .easier)
    }

    func testBeatingPrescriptionPushesHarder() {
        let sets = [SetResult(targetReps: 15, completedReps: 18),
                    SetResult(targetReps: 15, completedReps: 17),
                    SetResult(targetReps: 15, completedReps: 16)]
        XCTAssertEqual(engine.verdict(for: sets), .harder)
    }

    func testMeetingPrescriptionExactlyHolds() {
        let sets = (0..<3).map { _ in SetResult(targetReps: 15, completedReps: 15) }
        XCTAssertEqual(engine.verdict(for: sets), .hold)
    }

    func testOffsetIsClamped() {
        let crushing = (0..<3).map { _ in SetResult(targetReps: 10, completedReps: 20) }
        var offset = 0
        for _ in 0..<50 { offset = engine.nextOffset(current: offset, sets: crushing) }
        XCTAssertEqual(offset, engine.maximumOffset)
    }

    /// Percentage scaling, not flat reps: +2 is nothing on a set of 40 and
    /// brutal on a set of 4.
    func testAdjustmentScalesWithSetSize() {
        let small = ProgramDay(dayIndex: 0, sets: [SetPrescription(targetReps: 4)])
        let large = ProgramDay(dayIndex: 0, sets: [SetPrescription(targetReps: 40)])
        let smallDelta = engine.adjust(small, offset: 3).totalReps - small.totalReps
        let largeDelta = engine.adjust(large, offset: 3).totalReps - large.totalReps
        XCTAssertLessThan(smallDelta, largeDelta)
    }

    func testRecoveryDaysAreNeverAdjusted() {
        let rest = ProgramDay(dayIndex: 0, sets: [], isRecoveryDay: true)
        XCTAssertEqual(engine.adjust(rest, offset: 5), rest)
    }
}

final class RecommenderTests: XCTestCase {
    func testBeginnerGetsFirstTen() {
        XCTAssertEqual(ProgramRecommender.recommend(maxReps: 2).slug, "first-10")
    }

    func testStrongUserGetsHardestProgram() {
        XCTAssertEqual(ProgramRecommender.recommend(maxReps: 45).slug, "road-to-100")
    }

    func testHabitPreferenceOverridesStrength() {
        XCTAssertEqual(ProgramRecommender.recommend(maxReps: 45, wantsHabitOverStrength: true).slug,
                       "daily-push")
    }

    func testDailyGoalIsRoundAndReachable() {
        for max in [1, 3, 8, 20, 45, 100] {
            let goal = ProgramRecommender.dailyGoal(maxReps: max)
            XCTAssertEqual(goal % 5, 0, "goals should be round numbers")
            XCTAssertGreaterThanOrEqual(goal, 10)
            XCTAssertLessThanOrEqual(goal, 200)
        }
    }
}

/// The check that would have caught a week of prescribing sets of three to
/// somebody who had already recorded a set of 28.
final class ProgramFitTests: XCTestCase {
    func testFirstTenIsOutgrownBySomeoneDoing28() {
        XCTAssertEqual(ProgramFit.evaluate(program: ProgramLibrary.firstTen, bestSet: 28), .outgrown)
    }

    func testFirstTenSuitsABeginner() {
        XCTAssertEqual(ProgramFit.evaluate(program: ProgramLibrary.firstTen, bestSet: 2), .good)
    }

    func testRoadTo100IsTooHardForABeginner() {
        XCTAssertEqual(ProgramFit.evaluate(program: ProgramLibrary.roadTo(100), bestSet: 1), .tooHard)
    }

    /// A judgement on no evidence is worse than no judgement, so a fresh
    /// account is never nagged.
    func testNoHistoryMeansNoOpinion() {
        XCTAssertEqual(ProgramFit.evaluate(program: ProgramLibrary.firstTen, bestSet: 0), .good)
        XCTAssertNil(ProgramFit.suggestion(current: ProgramLibrary.firstTen, bestSet: 0))
    }

    func testSuggestsTheProgrammeThatActuallyFits() {
        let suggested = ProgramFit.suggestion(current: ProgramLibrary.firstTen, bestSet: 28)
        XCTAssertEqual(suggested?.slug, "road-to-50")
    }

    /// Never suggests a switch to the programme already in use, which would
    /// read as the app not knowing what it is doing.
    func testNeverSuggestsTheCurrentProgramme() {
        // Outgrown, but the honest recommendation is the programme already in
        // use - there is nothing above Road to 100. Suggesting a switch to
        // where you already are reads as the app not knowing what it is doing.
        let top = ProgramLibrary.roadTo(100)
        XCTAssertEqual(ProgramFit.evaluate(program: top, bestSet: 100), .outgrown)
        XCTAssertNil(ProgramFit.suggestion(current: top, bestSet: 100))
    }

    func testAGoodFitSuggestsNothing() {
        XCTAssertNil(ProgramFit.suggestion(current: ProgramLibrary.roadTo(50), bestSet: 20))
    }
}
