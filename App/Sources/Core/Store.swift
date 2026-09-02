import Foundation
import SwiftData
import Observation
import PushCore
import RepEngine
import TrainingEngine

/// The one place that writes to SwiftData.
///
/// Views read derived values from here rather than querying models directly,
/// so the rules about what counts toward a streak or a record live in exactly
/// one place and are the same rules the tests exercise.
@Observable
final class Store {
    private let context: ModelContext
    private let calendar: Calendar

    private(set) var profile: Profile
    private(set) var dayRecords: [DayRecord] = []
    private(set) var records = PersonalRecords()
    private(set) var currentStreak = 0
    private(set) var unlockedAchievements: Set<String> = []
    private(set) var enrollment: ProgramEnrollment?

    /// Achievements earned by the session that just finished, for the summary
    /// screen to celebrate once and then clear.
    var pendingCelebrations: [Achievement] = []
    var justSetPersonalRecord = false

    init(context: ModelContext, calendar: Calendar = .current) {
        self.context = context
        self.calendar = calendar
        self.profile = Store.loadOrCreateProfile(in: context)
        refresh()
    }

    // MARK: - Loading

    private static func loadOrCreateProfile(in context: ModelContext) -> Profile {
        let existing = try? context.fetch(FetchDescriptor<Profile>())
        if let profile = existing?.first { return profile }
        let profile = Profile()
        context.insert(profile)
        return profile
    }

    func refresh() {
        let sessions = (try? context.fetch(FetchDescriptor<Session>())) ?? []
        let goal = profile.dailyGoal

        // Rebuilt from sessions on every write. The rollup is a cache and
        // nothing more -- if it ever disagrees with the sessions, the sessions
        // are right.
        var totals: [Date: (reps: Int, count: Int, program: Bool)] = [:]
        for session in sessions {
            let day = calendar.startOfDay(for: session.startedAt)
            var entry = totals[day] ?? (0, 0, false)
            entry.reps += session.totalReps
            entry.count += 1
            entry.program = entry.program || session.source == .program
            totals[day] = entry
        }

        dayRecords = totals.map { day, entry in
            DayRecord(day: day, totalReps: entry.reps, goalTarget: goal,
                      programCompleted: entry.program)
        }.sorted { $0.day > $1.day }

        let streaks = StreakCalculator(calendar: calendar)
        currentStreak = streaks.currentStreak(records: dayRecords)

        let bestSet = sessions.map(\.bestSet).max() ?? 0
        records = StatsEngine(calendar: calendar).records(days: dayRecords, bestSet: bestSet)

        let unlocks = (try? context.fetch(FetchDescriptor<AchievementUnlock>())) ?? []
        unlockedAchievements = Set(unlocks.map(\.slug))

        enrollment = (try? context.fetch(FetchDescriptor<ProgramEnrollment>()))?
            .first { $0.completedAt == nil }
    }

    // MARK: - Derived reads

    private var stats: StatsEngine { StatsEngine(calendar: calendar) }

    var todayReps: Int { stats.today(dayRecords) }
    var weekReps: Int { stats.thisWeek(dayRecords) }
    var monthReps: Int { stats.thisMonth(dayRecords) }
    var remainingToday: Int { stats.remainingToday(dayRecords, goal: profile.dailyGoal) }
    var goalMetToday: Bool { todayReps >= profile.dailyGoal }
    var sessionCount: Int { ((try? context.fetch(FetchDescriptor<Session>())) ?? []).count }

    var activeProgram: Program? {
        enrollment.flatMap { ProgramLibrary.program(slug: $0.programSlug) }
    }

    /// Today's prescription, with the adaptive offset already applied.
    var todaysWorkout: ProgramDay? {
        guard let enrollment, let program = activeProgram,
              let day = program.day(at: enrollment.currentDayIndex) else { return nil }
        return AdaptationEngine().adjust(day, offset: enrollment.adaptationOffset)
    }

    // MARK: - Writing

    func completeOnboarding(displayName: String, maxReps: Int, program: Program, dailyGoal: Int) {
        profile.displayName = displayName
        profile.maxRepsAtOnboarding = maxReps
        profile.currentMax = maxReps
        profile.dailyGoal = dailyGoal
        profile.modifiedAt = Date()

        for existing in (try? context.fetch(FetchDescriptor<ProgramEnrollment>())) ?? [] {
            context.delete(existing)
        }
        context.insert(ProgramEnrollment(programSlug: program.slug))
        save()
    }

    func enroll(in program: Program) {
        for existing in (try? context.fetch(FetchDescriptor<ProgramEnrollment>())) ?? [] {
            context.delete(existing)
        }
        context.insert(ProgramEnrollment(programSlug: program.slug))
        save()
    }

    @discardableResult
    func record(_ result: SessionResult) -> [Achievement] {
        let previousBestSet = records.bestSet

        let session = Session(source: result.source, countingMode: result.countingMode)
        session.startedAt = result.startedAt
        session.endedAt = result.endedAt
        session.totalReps = result.totalReps
        session.programSlug = result.programSlug
        session.programDayIndex = result.programDayIndex
        session.formScore = result.formScore
        context.insert(session)

        for (index, set) in result.setResults.enumerated() where set.completedReps > 0 {
            let workoutSet = WorkoutSet(index: index, targetReps: set.targetReps > 0 ? set.targetReps : nil)
            workoutSet.completedReps = set.completedReps
            workoutSet.session = session
            context.insert(workoutSet)
        }

        for rep in result.reps {
            let sample = RepSample(timestamp: result.startedAt.addingTimeInterval(rep.endedAt),
                                   durationSeconds: rep.duration,
                                   minElbowAngle: rep.minElbowAngle,
                                   hipDeviation: rep.hipDeviation)
            context.insert(sample)
        }

        advanceProgram(with: result)
        if result.bestSet > profile.currentMax { profile.currentMax = result.bestSet }
        save()
        refresh()

        justSetPersonalRecord = result.bestSet > previousBestSet && previousBestSet > 0
        let progress = AchievementProgress(lifetimeReps: records.lifetimeTotal,
                                           bestSet: records.bestSet,
                                           currentStreak: currentStreak,
                                           sessionsCompleted: sessionCount,
                                           setNewRecord: justSetPersonalRecord)
        let newlyUnlocked = AchievementCatalog.newlyUnlocked(progress: progress,
                                                            alreadyUnlocked: unlockedAchievements)
        for achievement in newlyUnlocked {
            context.insert(AchievementUnlock(slug: achievement.slug))
        }
        if !newlyUnlocked.isEmpty { save(); refresh() }

        pendingCelebrations = newlyUnlocked
        return newlyUnlocked
    }

    private func advanceProgram(with result: SessionResult) {
        guard let enrollment, result.source == .program,
              let program = ProgramLibrary.program(slug: enrollment.programSlug) else { return }

        let day = enrollment.currentDayIndex
        if !enrollment.completedDayIndices.contains(day) {
            enrollment.completedDayIndices.append(day)
        }
        enrollment.adaptationOffset = AdaptationEngine()
            .nextOffset(current: enrollment.adaptationOffset, sets: result.setResults)
        enrollment.currentDayIndex = day + 1
        enrollment.modifiedAt = Date()
        if enrollment.currentDayIndex >= program.dayCount {
            enrollment.completedAt = Date()
        }
    }

    /// Skips a rest day forward without recording a workout, so a prescribed
    /// recovery day still moves the program along.
    func acknowledgeRecoveryDay() {
        guard let enrollment else { return }
        if !enrollment.completedDayIndices.contains(enrollment.currentDayIndex) {
            enrollment.completedDayIndices.append(enrollment.currentDayIndex)
        }
        enrollment.currentDayIndex += 1
        save()
        refresh()
    }

    func updateDailyGoal(_ goal: Int) {
        profile.dailyGoal = max(1, goal)
        profile.modifiedAt = Date()
        save()
        refresh()
    }

    private func save() {
        do {
            try context.save()
        } catch {
            // A failed write must never take the workout down with it: the
            // reps are already on screen and the user is owed them.
            assertionFailure("Store save failed: \(error)")
        }
    }

    // MARK: - Export
    //
    // Cheap to build, a real trust signal for a daily-habit app, and it makes
    // the data-request answers trivial.

    func exportJSON() throws -> Data {
        struct Export: Encodable {
            struct Day: Encodable { let date: String; let reps: Int }
            let exportedAt: Date
            let displayName: String
            let lifetimeReps: Int
            let longestStreak: Int
            let days: [Day]
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let payload = Export(
            exportedAt: Date(),
            displayName: profile.displayName,
            lifetimeReps: records.lifetimeTotal,
            longestStreak: records.longestStreak,
            days: dayRecords.map { .init(date: formatter.string(from: $0.day), reps: $0.totalReps) }
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(payload)
    }
}
