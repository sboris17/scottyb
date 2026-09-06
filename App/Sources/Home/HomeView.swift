import SwiftUI
import PushUI
import PushCore
import TrainingEngine

/// The home screen answers one question immediately: what should I do today?
///
/// Everything else on it is a reward for having done it. START is the largest
/// tappable thing on screen and is never more than one tap from a rep.
///
/// The ring deliberately sits on the background rather than in a card. When
/// every element was a rounded grey rectangle at the same spacing, the one
/// thing the screen exists to say had exactly the same weight as the sync
/// status - and a screen where nothing is emphasised is a screen where
/// nothing was designed.
struct HomeView: View {
    @Environment(Store.self) private var store
    @Environment(SyncCoordinator.self) private var syncer
    @State private var activeSession: SessionLaunch?
    @State private var resumable: SessionDraft?
    private let drafts = SessionDraftStore()

    private var workout: ProgramDay? { store.todaysWorkout }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    if let draft = resumable { resumeCard(draft) }
                    todayHero
                    if workout?.isRecoveryDay == true {
                        recoveryCard
                    } else {
                        startBlock
                    }
                    metricsCard
                    if store.currentStreak > 0 && !store.goalMetToday { streakNote }
                }
                .padding(.horizontal, Push.Metrics.gutter)
                .padding(.bottom, 28)
            }
            .background(Push.Palette.background)
            .navigationTitle("Today")
            .onAppear { resumable = drafts.load() }
            .fullScreenCover(item: $activeSession) { launch in
                SessionContainerView(launch: launch)
                    .environment(store)
                    .environment(syncer)
            }
        }
    }

    // MARK: - Hero

    private var goalProgress: Double {
        guard store.profile.dailyGoal > 0 else { return 0 }
        return Double(store.todayReps) / Double(store.profile.dailyGoal)
    }

    private var todayHero: some View {
        VStack(spacing: 14) {
            ZStack {
                ProgressRing(progress: goalProgress, lineWidth: 12)
                    .frame(width: 208, height: 208)
                HeroCount(store.todayReps, label: "of \(store.profile.dailyGoal) today")
            }
            Text(store.goalMetToday
                 ? "Daily goal complete."
                 : "\(store.remainingToday) to go today.")
                .font(Push.Typography.body)
                .foregroundStyle(store.goalMetToday ? Push.Palette.accent : Push.Palette.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }

    // MARK: - Starting

    private func programLaunch() -> SessionLaunch {
        guard let workout, let enrollment = store.enrollment else {
            // No program running: fall back to the daily goal as a single set.
            return SessionLaunch(prescription: [SetPrescription(targetReps: store.profile.dailyGoal, restSeconds: 0)],
                                 source: .justPush)
        }
        return SessionLaunch(prescription: workout.sets, source: .program,
                             programSlug: enrollment.programSlug,
                             programDayIndex: enrollment.currentDayIndex)
    }

    /// One button, with today's sets written on it.
    ///
    /// There used to be two: START and Just Push. They open the same screen
    /// and differ only in whether it carries targets, which is invisible from
    /// the outside - so it read as a primary action and a lesser version of
    /// it, rather than a choice. Now there is one thing to press, and what it
    /// is about to ask of you is written underneath rather than sitting in an
    /// unlabelled row further up.
    ///
    /// Counting without a plan is kept, deliberately quietly. It is a real
    /// thing somebody wants at 11pm when the plan is not happening, and
    /// deleting it to tidy the screen would cost more than it saves.
    @ViewBuilder
    private var startBlock: some View {
        VStack(spacing: 8) {
            PrimaryButton("Start", systemImage: "play.fill") {
                activeSession = programLaunch()
            }
            if let plan = todaysPlanSummary {
                Text(plan)
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textTertiary)
            }
            QuietButton("Just count, no plan") {
                activeSession = SessionLaunch(prescription: [], source: .justPush)
            }
        }
    }

    /// "10 · 5" rather than "10 / 5": a middot reads as a list of sets, where
    /// a slash reads as a fraction - which is what made it collide with the
    /// "of 60" directly above it.
    private var todaysPlanSummary: String? {
        guard let workout, !workout.isRecoveryDay, !workout.sets.isEmpty else { return nil }
        let sets = workout.sets.map { "\($0.targetReps)" }.joined(separator: " · ")
        return "Today: \(sets)"
    }

    /// An interrupted workout is offered back, never silently dropped and
    /// never silently resumed.
    private func resumeCard(_ draft: SessionDraft) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            PushTag("Unfinished workout", systemImage: "pause.fill", tint: Push.Palette.flame)
            Text("\(draft.totalReps) push-ups over \(draft.completedSets.count) set\(draft.completedSets.count == 1 ? "" : "s")")
                .font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            HStack(spacing: 10) {
                SecondaryButton("Save it") {
                    store.record(draft: draft)
                    drafts.clear()
                    resumable = nil
                }
                PrimaryButton("Resume") {
                    activeSession = SessionLaunch(
                        prescription: zip(draft.targets, draft.restSeconds)
                            .map { SetPrescription(targetReps: $0, restSeconds: $1) },
                        source: draft.source,
                        programSlug: draft.programSlug,
                        programDayIndex: draft.programDayIndex,
                        resuming: draft)
                    resumable = nil
                }
            }
        }
        .pushCard()
    }

    private var recoveryCard: some View {
        VStack(spacing: 12) {
            SymbolBadge("moon.zzz.fill")
            Text("Recovery day").font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            Text("Rest is part of the program. Your streak keeps going.")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
                .multilineTextAlignment(.center)
            SecondaryButton("Mark as done") { store.acknowledgeRecoveryDay() }
            QuietButton("Push anyway") {
                activeSession = SessionLaunch(prescription: [], source: .justPush)
            }
        }
        .frame(maxWidth: .infinity)
        .pushCard()
    }

    // MARK: - Numbers

    private var metricsCard: some View {
        MetricStrip([
            .init("\(store.currentStreak)", "Day streak"),
            .init("\(store.records.bestSet)", "Best set"),
            .init("\(store.weekReps)", "This week"),
        ])
        .pushCard()
    }

    /// Only shown while it still says something you can act on. Once the goal
    /// is met the streak is safe, and repeating it under a strip that already
    /// shows the number is one more card for nothing.
    private var streakNote: some View {
        HStack(spacing: 12) {
            SymbolBadge("flame.fill", diameter: 34, tint: Push.Palette.flame)
            Text("Finish today's goal to keep your \(store.currentStreak)-day streak.")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 4)
    }
}

/// Identifiable wrapper so a session can be presented from a sheet binding.
struct SessionLaunch: Identifiable {
    let id = UUID()
    var prescription: [SetPrescription]
    var source: SessionSource
    var programSlug: String?
    var programDayIndex: Int?
    var resuming: SessionDraft?
}
