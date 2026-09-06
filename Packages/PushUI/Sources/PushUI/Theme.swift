import SwiftUI

/// The visual direction: modern, clean, fast, energetic, slightly playful.
/// Not military, not cartoonish.
///
/// This has been rebuilt once, for a reason worth writing down. The first pass
/// hit every default of a generated fitness app: emoji standing in for icons,
/// the rounded system face on every word regardless of what it was saying,
/// ALL-CAPS TRACKED labels on top of each card, and a screen made of identical
/// grey rounded rectangles at identical spacing. Each of those is defensible
/// alone. Together they are a house style nobody chose, and it reads as
/// generated rather than designed.
///
/// So the rules now are:
///
/// - **Type carries the tone, not decoration.** The default San Francisco face
///   for anything that is words. The rounded face is gone entirely.
/// - **Numbers are the only things allowed to shout.** Big, tightly tracked,
///   monospaced digits.
/// - **Symbols, never emoji.** Emoji drag in another vendor's illustration
///   style, ignore the tint, ignore Dynamic Type and date the app instantly.
/// - **Hierarchy comes from weight and space, not from boxes.** A card means
///   "these things belong together", so a screen of five cards means nothing.
/// - **One accent, spent carefully.** It marks the action you should take and
///   progress you have made. Not labels, not headings, not decoration.
public enum Push {

    // MARK: - Color

    public enum Palette {
        #if canImport(UIKit)
        private static func dynamic(light: UIColor, dark: UIColor) -> Color {
            Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
        }
        #else
        private static func dynamic(light: Color, dark: Color) -> Color { dark }
        #endif

        #if canImport(UIKit)
        /// Volt. Loud enough to carry a celebration, readable on both grounds.
        ///
        /// Pulled back from the original neon: at full chroma on black it
        /// haloes, and it was being used for so much that nothing on screen
        /// read as more important than anything else.
        public static let accent = dynamic(
            light: UIColor(red: 0.33, green: 0.65, blue: 0.09, alpha: 1),
            dark: UIColor(red: 0.71, green: 0.94, blue: 0.28, alpha: 1))

        /// Behind a tinted symbol, never behind text.
        public static let accentSoft = dynamic(
            light: UIColor(red: 0.33, green: 0.65, blue: 0.09, alpha: 0.12),
            dark: UIColor(red: 0.71, green: 0.94, blue: 0.28, alpha: 0.14))

        public static let flame = dynamic(
            light: UIColor(red: 0.85, green: 0.31, blue: 0.09, alpha: 1),
            dark: UIColor(red: 1.00, green: 0.53, blue: 0.29, alpha: 1))

        public static let background = dynamic(
            light: UIColor(red: 0.97, green: 0.97, blue: 0.98, alpha: 1),
            dark: UIColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1))

        /// Deliberately close to the background. A card is a grouping, and it
        /// only needs to be distinguishable, not loud - the hairline does most
        /// of the work of separating it.
        public static let surface = dynamic(
            light: UIColor.white,
            dark: UIColor(red: 0.085, green: 0.085, blue: 0.095, alpha: 1))

        public static let surfaceRaised = dynamic(
            light: UIColor(red: 0.93, green: 0.93, blue: 0.94, alpha: 1),
            dark: UIColor(red: 0.145, green: 0.145, blue: 0.16, alpha: 1))

        /// The hairline around cards and between metrics.
        public static let stroke = dynamic(
            light: UIColor(white: 0, alpha: 0.09),
            dark: UIColor(white: 1, alpha: 0.09))

        public static let textPrimary = dynamic(
            light: UIColor(red: 0.06, green: 0.06, blue: 0.07, alpha: 1),
            dark: UIColor(red: 0.98, green: 0.98, blue: 0.99, alpha: 1))

        public static let textSecondary = dynamic(
            light: UIColor(red: 0.40, green: 0.40, blue: 0.43, alpha: 1),
            dark: UIColor(red: 0.60, green: 0.60, blue: 0.64, alpha: 1))

        /// Third tier: units, footnotes, anything that must be there without
        /// being read.
        public static let textTertiary = dynamic(
            light: UIColor(red: 0.58, green: 0.58, blue: 0.61, alpha: 1),
            dark: UIColor(red: 0.42, green: 0.42, blue: 0.46, alpha: 1))

        public static let track = dynamic(
            light: UIColor(red: 0.89, green: 0.89, blue: 0.90, alpha: 1),
            dark: UIColor(red: 0.18, green: 0.18, blue: 0.20, alpha: 1))
        #else
        public static let accent = Color.green
        public static let accentSoft = Color.green.opacity(0.14)
        public static let flame = Color.orange
        public static let background = Color.black
        public static let surface = Color.gray.opacity(0.2)
        public static let surfaceRaised = Color.gray.opacity(0.3)
        public static let stroke = Color.white.opacity(0.09)
        public static let textPrimary = Color.white
        public static let textSecondary = Color.gray
        public static let textTertiary = Color.gray.opacity(0.6)
        public static let track = Color.gray.opacity(0.4)
        #endif

        /// Reserved for text sitting on the accent itself.
        public static let onAccent = Color.black
    }

    // MARK: - Type

    public enum Typography {

        /// A number that is the point of the screen.
        ///
        /// Default San Francisco rather than the rounded face: rounded numerals
        /// at 130pt read as a kid's game, where SF's flat terminals read as an
        /// instrument. Monospaced so a live count does not shuffle its own
        /// layout as it ticks past 9.
        public static func numeral(_ size: CGFloat = 120) -> Font {
            .system(size: size, weight: .bold, design: .default).monospacedDigit()
        }

        /// Large words - a welcome line, a screen's opening statement.
        public static func display(_ size: CGFloat = 34) -> Font {
            .system(size: size, weight: .bold, design: .default)
        }

        /// Big numerals want negative tracking; the default spacing is set for
        /// running text and looks gappy at display sizes.
        public static func numeralTracking(_ size: CGFloat) -> CGFloat {
            -size * 0.022
        }

        public static let title = Font.system(.title3, design: .default).weight(.semibold)
        public static let headline = Font.system(.callout, design: .default).weight(.semibold)
        public static let body = Font.system(.callout, design: .default)

        /// Section headings. Sentence case, sitting above content rather than
        /// stamped across the top of a card in capitals.
        public static let label = Font.system(.footnote, design: .default).weight(.semibold)

        public static let caption = Font.system(.caption, design: .default)

        /// The smallest thing on screen: a unit, a metric's name.
        public static let micro = Font.system(.caption2, design: .default).weight(.medium)

        /// Kept for numbers that sit inline in a row rather than leading a
        /// screen.
        public static func stat(_ size: CGFloat = 24) -> Font {
            .system(size: size, weight: .semibold, design: .default).monospacedDigit()
        }
    }

    // MARK: - Metrics

    public enum Metrics {
        /// Cards. Generous, but not a lozenge.
        public static let cornerRadius: CGFloat = 22
        /// Buttons and inline controls, deliberately tighter than the cards
        /// they sit on - matching radii at different sizes look wrong.
        public static let controlRadius: CGFloat = 16
        public static let cardPadding: CGFloat = 18
        public static let gutter: CGFloat = 14
        public static let ringWidth: CGFloat = 12
    }
}

public extension View {
    /// Standard card treatment: one grouping, one hairline, one place to
    /// change the whole app's chrome.
    func pushCard(padding: CGFloat = Push.Metrics.cardPadding) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Push.Palette.surface,
                        in: RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous)
                    .strokeBorder(Push.Palette.stroke, lineWidth: 1)
            }
    }
}
