import SwiftUI
import PushUI
import PushCore

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
