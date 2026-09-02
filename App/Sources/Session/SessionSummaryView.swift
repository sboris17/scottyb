import SwiftUI
import PushUI
import PushCore
import RepEngine

struct SessionSummaryView: View {
    @Environment(Store.self) private var store
    let result: SessionResult
    let onDone: () -> Void

    private var duration: String {
        let seconds = Int(result.endedAt.timeIntervalSince(result.startedAt))
        return seconds < 60 ? "\(seconds)s" : "\(seconds / 60)m \(seconds % 60)s"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Push.Metrics.gutter) {
                VStack(spacing: 4) {
                    HeroCount(result.totalReps, label: "push-ups")
                    Text(result.setResults.filter { $0.completedReps > 0 }
                        .map { "\($0.completedReps)" }.joined(separator: " · "))
                        .font(Push.Typography.headline)
                        .foregroundStyle(Push.Palette.textSecondary)
                }
                .padding(.top, 30)

                HStack(spacing: 10) {
                    StatChip(emoji: "\u{23F1}", value: duration, caption: "Duration")
                    StatChip(emoji: "\u{1F3C6}", value: "\(result.bestSet)", caption: "Best set")
                    StatChip(emoji: "\u{1F525}", value: "\(store.currentStreak)", caption: "Streak")
                }

                if let diagnostics = result.failureDiagnostics, result.totalReps == 0 {
                    CountingFailurePanel(diagnostics: diagnostics)
                }

                if store.justSetPersonalRecord {
                    CelebrationBadge(emoji: "\u{26A1}", title: "New personal record\n\(result.bestSet) in one set")
                        .onAppear { Feedback.shared.celebrate() }
                }

                ForEach(store.pendingCelebrations) { achievement in
                    CelebrationBadge(emoji: achievement.emoji, title: achievement.title)
                }

                if let score = result.formScore {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Form").font(Push.Typography.label)
                            .foregroundStyle(Push.Palette.textSecondary)
                        ProgressView(value: score).tint(Push.Palette.accent)
                        // Never scolding. Form data exists to show progress,
                        // and every rep was counted regardless.
                        Text(score > 0.75 ? "Clean, consistent reps."
                             : "Depth got shorter as you went. Normal when you're working hard.")
                            .font(Push.Typography.caption)
                            .foregroundStyle(Push.Palette.textSecondary)
                    }
                    .pushCard()
                }

                PrimaryButton("Done") {
                    store.pendingCelebrations = []
                    store.justSetPersonalRecord = false
                    onDone()
                }
            }
            .padding(Push.Metrics.gutter)
        }
        .background(Push.Palette.background)
        .onAppear {
            if !store.pendingCelebrations.isEmpty { Feedback.shared.celebrate() }
        }
    }
}


/// Shown when a camera session counted nothing.
///
/// A bare zero is useless: it does not say whether the app failed to see you,
/// saw you and disagreed, or saw nothing worth judging. This is the first
/// moment the phone is back in your hand, so it is the right place to explain.
private struct CountingFailurePanel: View {
    let diagnostics: RepDiagnostics

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("NOTHING COUNTED")
                .font(Push.Typography.caption).tracking(2)
                .foregroundStyle(Push.Palette.flame)

            if let advice = CountingCoach.advice(for: diagnostics, countedReps: 0) {
                Text(advice)
                    .font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Divider().overlay(Push.Palette.track)

            detail("Reps judged", "\(diagnostics.candidateReps)")
            // Separates "the app could not see you" from "the app saw you and
            // disagreed". Those need opposite fixes, and without this number
            // there is no way to tell them apart after the fact.
            detail("Frames it could use",
                   diagnostics.usableFrames + diagnostics.unusableFrames == 0
                   ? "none"
                   : String(format: "%.0f%%", diagnostics.usableFrameFraction * 100))
            detail("Elbow movement seen",
                   diagnostics.angleSpanSeen > 0
                   ? String(format: "%.0f°", diagnostics.angleSpanSeen) : "none")
            if let rejection = diagnostics.lastRejection {
                detail("Last rejected for", rejection.rawValue)
            }
            if !diagnostics.rejectionCounts.isEmpty {
                detail("Rejections",
                       diagnostics.rejectionCounts.sorted { $0.key < $1.key }
                           .map { "\($0.key) x\($0.value)" }.joined(separator: ", "))
            }

            Text("Nothing was saved — a session with no reps doesn't count as a workout, and won't change your plan.")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .pushCard()
    }

    private func detail(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
            Spacer(minLength: 12)
            Text(value)
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textPrimary)
                .multilineTextAlignment(.trailing)
        }
    }
}
