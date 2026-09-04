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

    /// Named rather than numbered. The steps have been renumbered twice and an
    /// off-by-one here shows up as a screen that cannot be reached.
    private enum Step: Int, CaseIterable {
        case welcome, ability, goal, plan, account
    }

    @State private var step = Step.welcome
    @State private var name = ""
    @State private var maxReps = 10
    @State private var wantsHabit = false
    @State private var auth = AuthModel()

    /// The account step is skipped entirely when there is no project to sign
    /// in to, or when the Keychain already has a session from a previous
    /// install. Neither case should show somebody a login.
    private var showsAccountStep: Bool {
        auth.isConfigured && !auth.isSignedIn
    }

    private var lastStep: Step { showsAccountStep ? .account : .plan }

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
            case .welcome: welcome
            case .ability: abilityStep
            case .goal: goalStep
            case .plan: summaryStep
            case .account: accountStep
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

    /// Asked last, once there is a plan on screen worth keeping.
    ///
    /// Leading with a login is the reliable way to lose somebody who has not
    /// yet seen what the app does, and it would be dishonest here besides:
    /// nothing needs an account. Every workout is saved on the phone whether
    /// you sign in or not, so this is offered as backup rather than as a gate,
    /// and skipping is a plain button rather than fine print.
    private var accountStep: some View {
        VStack(spacing: 16) {
            Text("\u{1F511}").font(.system(size: 52))
            Text("Keep your progress")
                .font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            Text("Sign in and your streak and history survive a new phone. Everything works without it \u{2014} workouts are always saved here first.")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
                .multilineTextAlignment(.center)

            AppleSignInView(model: auth)
                .padding(.top, 4)
        }
        // Signing in finishes the job: there is nothing left to ask, so do not
        // make somebody tap Continue to confirm what they just did.
        .onChange(of: auth.isSignedIn) { _, signedIn in
            if signedIn { finish() }
        }
    }

    private var controls: some View {
        VStack(spacing: 10) {
            PrimaryButton(primaryTitle) {
                if step == lastStep {
                    finish()
                } else {
                    withAnimation(.snappy) { step = Step(rawValue: step.rawValue + 1) ?? lastStep }
                }
            }
            .disabled(auth.isSigningIn)

            HStack(spacing: 20) {
                // Every step after the first was one-way. Getting a number
                // wrong and being unable to go back and change it is how
                // somebody ends up on a programme built for a different body -
                // which is exactly what happened.
                if step != .welcome {
                    Button("Back") {
                        withAnimation(.snappy) {
                            step = Step(rawValue: step.rawValue - 1) ?? .welcome
                        }
                    }
                }
                if step != .welcome && step != lastStep {
                    Button("Skip") { withAnimation(.snappy) { step = lastStep } }
                }
            }
            .font(Push.Typography.caption)
            .foregroundStyle(Push.Palette.textSecondary)
        }
    }

    private var primaryTitle: String {
        // On the account step the primary button is the way past it, so it has
        // to read as declining rather than as confirming.
        if step == .account { return "Not now" }
        return step == lastStep ? "Start pushing" : "Continue"
    }

    private func finish() {
        store.completeOnboarding(displayName: name, maxReps: maxReps,
                                 program: recommended, dailyGoal: dailyGoal)
        onFinish()
    }
}
