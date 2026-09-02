#if DEBUG
import SwiftUI

/// Every component on one canvas.
///
/// The visual direction is a product decision, so it needs somewhere it can be
/// judged as a whole rather than screen by screen -- and it has to be checked
/// in both colour schemes, since the palette is defined twice.
struct DesignGallery: View {
    @State private var count = 24

    var body: some View {
        ScrollView {
            VStack(spacing: Push.Metrics.gutter) {
                ZStack {
                    ProgressRing(progress: 0.62, lineWidth: 16)
                        .frame(width: 200, height: 200)
                    HeroCount(count, label: "push-ups")
                }
                .padding(.top, 20)

                HStack(spacing: 10) {
                    StatChip(emoji: "\u{1F525}", value: "12", caption: "Day streak")
                    StatChip(emoji: "\u{1F3C6}", value: "38", caption: "Best set")
                    StatChip(emoji: "\u{1F4AA}", value: "428", caption: "This week")
                }

                PrimaryButton("START", systemImage: "play.fill") { count += 1 }
                SecondaryButton("Just Push") { count = max(0, count - 1) }

                CelebrationBadge(emoji: "\u{26A1}", title: "New personal record")

                VStack(alignment: .leading, spacing: 10) {
                    Text("Card").font(Push.Typography.title)
                        .foregroundStyle(Push.Palette.textPrimary)
                    Text("Large numbers, quiet chrome, one loud accent.")
                        .font(Push.Typography.body)
                        .foregroundStyle(Push.Palette.textSecondary)
                }
                .pushCard()
            }
            .padding(Push.Metrics.gutter)
        }
        .background(Push.Palette.background)
    }
}

#Preview("Design gallery - light") {
    DesignGallery().preferredColorScheme(.light)
}

#Preview("Design gallery - dark") {
    DesignGallery().preferredColorScheme(.dark)
}
#endif
