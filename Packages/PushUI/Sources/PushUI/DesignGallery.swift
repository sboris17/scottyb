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
            VStack(alignment: .leading, spacing: 22) {
                ZStack {
                    ProgressRing(progress: 0.62, lineWidth: 12)
                        .frame(width: 190, height: 190)
                    HeroCount(count, label: "push-ups")
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 20)

                MetricStrip([
                    .init("12", "Day streak"),
                    .init("38", "Best set"),
                    .init("428", "This week"),
                ])
                .pushCard()

                VStack(spacing: 10) {
                    PrimaryButton("Start", systemImage: "play.fill") { count += 1 }
                    SecondaryButton("Floor mode", systemImage: "iphone") { count = max(0, count - 1) }
                    QuietButton("Just count, no plan") { count = 0 }
                }

                HStack(spacing: 8) {
                    PushTag("In progress", systemImage: "circle.fill")
                    PushTag("Recommended", systemImage: "sparkles")
                    PushTag("Stretch", systemImage: "exclamationmark", tint: Push.Palette.flame)
                }

                CelebrationBadge(systemImage: "bolt.fill", title: "New personal record. 38 in one set.")

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader("Card", detail: "grouping")
                    Text("Large numbers, quiet chrome, one accent spent carefully.")
                        .font(Push.Typography.body)
                        .foregroundStyle(Push.Palette.textSecondary)
                    HStack(spacing: 12) {
                        SymbolBadge("flame.fill")
                        SymbolBadge("trophy.fill", diameter: 36)
                        SymbolBadge("figure.strengthtraining.traditional", diameter: 30)
                    }
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
