import SwiftUI
import PushUI
import PushCore
import TrainingEngine

/// Four cards, and every one of them is skippable.
///
/// Asking somebody to do max push-ups before they have seen the app is a real
/// drop-off risk, so the test is genuinely optional and a good default program
/// is picked either way.
struct OnboardingView: View {
    let store: Store
    let onFinish: () -> Void

    @State private var step = 0
    @State private var name = ""
    @State private var maxReps = 10
    @State private var wantsHabit = false

    private var recommended: Program {
        ProgramRecommender.recommend(maxReps: maxReps, wantsHabitOverStrength: wantsHabit)
    }

    private var dailyGoal: Int {
        ProgramRecommender.dailyGoal(maxReps: maxReps)
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            switch step {
            case 0: welcome
            case 1: abilityStep
            case 2: goalStep
            default: summaryStep
            }
            Spacer()
            controls
        }
        .padding(Push.Metrics.gutter)
        .background(Push.Palette.background)
    }

    private var welcome: some View {
        VStack(spacing: 14) {
            Text("\u{1F4AA}").font(.system(size: 64))
            Text("One exercise.\nEvery day.")
                .font(Push.Typography.hero(40))
                .multilineTextAlignment(.center)
                .foregroundStyle(Push.Palette.textPrimary)
            Text("Prop your phone up and it counts your push-ups for you.")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var abilityStep: some View {
        VStack(spacing: 20) {
            Text("How many push-ups can you do right now?")
                .font(Push.Typography.title)
                .multilineTextAlignment(.center)
                .foregroundStyle(Push.Palette.textPrimary)
            HeroCount(maxReps, label: "in one set")
            Stepper("", value: $maxReps, in: 0...150).labelsHidden()
            Text("A rough guess is fine. The app adjusts as it learns what you can do.")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    private var goalStep: some View {
        VStack(spacing: 16) {
            Text("What are you after?")
                .font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            Button { wantsHabit = false } label: {
                choice(title: "Get stronger", detail: "Build toward a bigger set.", selected: !wantsHabit)
            }
            Button { wantsHabit = true } label: {
                choice(title: "Build the habit", detail: "Something small, every single day.", selected: wantsHabit)
            }
        }
        .buttonStyle(.plain)
    }

    private func choice(title: String, detail: String, selected: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textPrimary)
                Text(detail).font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
            Spacer()
            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(selected ? Push.Palette.accent : Push.Palette.track)
        }
        .pushCard()
    }

    private var summaryStep: some View {
        VStack(spacing: 16) {
            Text("Here's your plan")
                .font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            VStack(spacing: 10) {
                Text(recommended.title).font(Push.Typography.hero(36))
                    .foregroundStyle(Push.Palette.accent)
                Text(recommended.summary)
                    .font(Push.Typography.body)
                    .foregroundStyle(Push.Palette.textSecondary)
                    .multilineTextAlignment(.center)
                Divider()
                Text("Daily goal: \(dailyGoal) push-ups")
                    .font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textPrimary)
            }
            .pushCard()
            Text("You can change any of this later.")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
        }
    }

    private var controls: some View {
        VStack(spacing: 10) {
            PrimaryButton(step >= 3 ? "Start pushing" : "Continue") {
                if step >= 3 {
                    store.completeOnboarding(displayName: name, maxReps: maxReps,
                                             program: recommended, dailyGoal: dailyGoal)
                    onFinish()
                } else {
                    withAnimation(.snappy) { step += 1 }
                }
            }
            if step > 0 && step < 3 {
                Button("Skip") { withAnimation(.snappy) { step = 3 } }
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
        }
    }
}
