import SwiftUI
import PushUI
import PushCore
import TrainingEngine

/// The home screen answers one question immediately: what should I do today?
///
/// Everything else on it is a reward for having done it. START is the largest
/// tappable thing on screen and is never more than one tap from a rep.
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
                VStack(spacing: Push.Metrics.gutter) {
                    if let draft = resumable { resumeCard(draft) }
                    todayCard
                    if workout?.isRecoveryDay == true {
                        recoveryCard
                    } else {
                        startBlock
                    }
                    statsRow
                    if store.currentStreak > 0 { streakCard }
                }
                .padding(Push.Metrics.gutter)
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

    /// An interrupted workout is offered back, never silently dropped and
    /// never silently resumed.
    private func resumeCard(_ draft: SessionDraft) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("UNFINISHED WORKOUT")
                .font(Push.Typography.caption).tracking(2)
                .foregroundStyle(Push.Palette.flame)
            Text("\(draft.totalReps) push-ups over \(draft.completedSets.count) set\(draft.completedSets.count == 1 ? "" : "s")")
                .font(Push.Typography.headline)
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

    private var goalProgress: Double {
        guard store.profile.dailyGoal > 0 else { return 0 }
        return Double(store.todayReps) / Double(store.profile.dailyGoal)
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
        VStack(spacing: 10) {
            PrimaryButton("START", systemImage: "play.fill") {
                activeSession = programLaunch()
            }
            if let plan = todaysPlanSummary {
                Text(plan)
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
            Button("Just count, no plan") {
                activeSession = SessionLaunch(prescription: [], source: .justPush)
            }
            .font(Push.Typography.caption)
            .foregroundStyle(Push.Palette.textSecondary)
            .padding(.top, 2)
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

    private var todayCard: some View {
        VStack(spacing: 18) {
            ZStack {
                ProgressRing(progress: goalProgress, lineWidth: 16)
                    .frame(width: 220, height: 220)
                VStack(spacing: 0) {
                    HeroCount(store.todayReps)
                    Text("of \(store.profile.dailyGoal)")
                        .font(Push.Typography.headline)
                        .foregroundStyle(Push.Palette.textSecondary)
                }
            }
            .padding(.vertical, 6)

            Text(store.goalMetToday
                 ? "Daily goal complete."
                 : "\(store.remainingToday) to go today.")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
        }
        .pushCard()
    }

    private var recoveryCard: some View {
        VStack(spacing: 14) {
            Text("Recovery Day").font(Push.Typography.title)
            Text("Rest is part of the program. Your streak keeps going.")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
                .multilineTextAlignment(.center)
            SecondaryButton("Mark as done") { store.acknowledgeRecoveryDay() }
            Button("Push anyway") {
                activeSession = SessionLaunch(prescription: [], source: .justPush)
            }
            .font(Push.Typography.caption)
            .foregroundStyle(Push.Palette.textSecondary)
        }
        .pushCard()
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            StatChip(emoji: "\u{1F525}", value: "\(store.currentStreak)", caption: "Day streak")
            StatChip(emoji: "\u{1F3C6}", value: "\(store.records.bestSet)", caption: "Best set")
            StatChip(emoji: "\u{1F4AA}", value: "\(store.weekReps)", caption: "This week")
        }
    }

    private var streakCard: some View {
        HStack {
            Text("\u{1F525}").font(.system(size: 28))
            VStack(alignment: .leading, spacing: 2) {
                Text("\(store.currentStreak) day streak")
                    .font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textPrimary)
                Text(store.goalMetToday ? "Safe for today." : "Finish today's goal to keep it.")
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
            Spacer()
        }
        .pushCard()
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
