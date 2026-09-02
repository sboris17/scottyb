#if DEBUG
import SwiftUI
import SwiftData
import PushCore
import TrainingEngine

/// In-memory scaffolding so every screen can be worked on in the Xcode canvas
/// without a device, a camera, or real history.
@MainActor
enum PreviewSupport {
    static func container() -> ModelContainer {
        let schema = Schema(PushSchema.models)
        // Previews are allowed to be brittle; a failure here is a broken
        // preview, never a broken app.
        return try! ModelContainer(
            for: schema,
            configurations: ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        )
    }

    /// A store with a plausible fortnight of history behind it, so the home
    /// and stats screens show something worth looking at.
    static func populatedStore() -> Store {
        let container = container()
        let context = container.mainContext
        let calendar = Calendar.current

        let profile = Profile(displayName: "Scotty", dailyGoal: 50)
        profile.currentMax = 38
        context.insert(profile)

        let enrollment = ProgramEnrollment(programSlug: "road-to-50")
        enrollment.currentDayIndex = 9
        enrollment.completedDayIndices = Array(0..<9)
        context.insert(enrollment)

        // Day 3 is deliberately a miss, so the streak and the chart have
        // something other than a perfect run to render.
        let reps = [55, 60, 0, 48, 52, 70, 65, 50, 58, 62, 54, 66, 51, 20]
        for (offset, total) in reps.enumerated() where total > 0 {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: Date()) else { continue }
            let session = Session(source: .program, countingMode: .camera)
            session.startedAt = day
            session.endedAt = day.addingTimeInterval(360)
            session.totalReps = total
            context.insert(session)

            var remaining = total
            for index in 0..<3 {
                let setReps = index == 2 ? remaining : total / 3
                remaining -= setReps
                let set = WorkoutSet(index: index, targetReps: total / 3)
                set.completedReps = setReps
                set.session = session
                context.insert(set)
            }
        }

        for slug in ["first-set", "first-100", "streak-7", "set-25"] {
            context.insert(AchievementUnlock(slug: slug))
        }

        try? context.save()
        return Store(context: context)
    }

    static func emptyStore() -> Store {
        Store(context: container().mainContext)
    }
}

#Preview("Home") {
    MainTabs().environment(PreviewSupport.populatedStore())
}

#Preview("Home - first launch") {
    MainTabs().environment(PreviewSupport.emptyStore())
}

#Preview("Onboarding") {
    OnboardingView(store: PreviewSupport.emptyStore()) {}
}

#Preview("Stats") {
    StatsView().environment(PreviewSupport.populatedStore())
}

#Preview("Programs") {
    ProgramsView().environment(PreviewSupport.populatedStore())
}

#Preview("Program detail") {
    ProgramDetailView(program: ProgramLibrary.roadTo(50)) {}
}

#Preview("Session summary") {
    SessionSummaryView(
        result: SessionResult(
            startedAt: Date().addingTimeInterval(-380),
            endedAt: Date(),
            source: .program,
            countingMode: .camera,
            programSlug: "road-to-50",
            programDayIndex: 9,
            setResults: [.init(targetReps: 20, completedReps: 22),
                         .init(targetReps: 18, completedReps: 18),
                         .init(targetReps: 16, completedReps: 13)],
            reps: [],
            formScore: 0.82
        ),
        onDone: {}
    )
    .environment(PreviewSupport.populatedStore())
}
#endif
