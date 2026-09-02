import SwiftUI

/// The visual direction from the one-pager: modern, clean, fast, energetic,
/// slightly playful. Not military, not cartoonish.
///
/// In practice that means a near-black ground, one loud accent used sparingly,
/// and type doing most of the work. The rep count is the hero of the screen,
/// so everything else is deliberately quiet.
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
        public static let accent = dynamic(
            light: UIColor(red: 0.36, green: 0.72, blue: 0.07, alpha: 1),
            dark: UIColor(red: 0.78, green: 1.00, blue: 0.24, alpha: 1))

        public static let flame = dynamic(
            light: UIColor(red: 0.90, green: 0.35, blue: 0.10, alpha: 1),
            dark: UIColor(red: 1.00, green: 0.48, blue: 0.20, alpha: 1))

        public static let background = dynamic(
            light: UIColor(red: 0.97, green: 0.97, blue: 0.96, alpha: 1),
            dark: UIColor(red: 0.05, green: 0.05, blue: 0.06, alpha: 1))

        public static let surface = dynamic(
            light: UIColor.white,
            dark: UIColor(red: 0.10, green: 0.10, blue: 0.11, alpha: 1))

        public static let surfaceRaised = dynamic(
            light: UIColor(red: 0.94, green: 0.94, blue: 0.93, alpha: 1),
            dark: UIColor(red: 0.15, green: 0.15, blue: 0.17, alpha: 1))

        public static let textPrimary = dynamic(
            light: UIColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1),
            dark: UIColor(red: 0.98, green: 0.98, blue: 0.97, alpha: 1))

        public static let textSecondary = dynamic(
            light: UIColor(red: 0.42, green: 0.42, blue: 0.44, alpha: 1),
            dark: UIColor(red: 0.62, green: 0.62, blue: 0.65, alpha: 1))

        public static let track = dynamic(
            light: UIColor(red: 0.88, green: 0.88, blue: 0.87, alpha: 1),
            dark: UIColor(red: 0.20, green: 0.20, blue: 0.22, alpha: 1))
        #else
        public static let accent = Color.green
        public static let flame = Color.orange
        public static let background = Color.black
        public static let surface = Color.gray.opacity(0.2)
        public static let surfaceRaised = Color.gray.opacity(0.3)
        public static let textPrimary = Color.white
        public static let textSecondary = Color.gray
        public static let track = Color.gray.opacity(0.4)
        #endif

        /// Reserved for the one number that matters on screen.
        public static let onAccent = Color.black
    }

    // MARK: - Type

    public enum Typography {
        /// The hero count. Rounded because a bare system numeral at 120pt
        /// reads as a spreadsheet, and monospaced digits because a count that
        /// jiggles as it ticks past 9 looks broken.
        public static func hero(_ size: CGFloat = 120) -> Font {
            .system(size: size, weight: .heavy, design: .rounded).monospacedDigit()
        }

        public static func stat(_ size: CGFloat = 34) -> Font {
            .system(size: size, weight: .bold, design: .rounded).monospacedDigit()
        }

        public static let title = Font.system(.title2, design: .rounded).weight(.bold)
        public static let headline = Font.system(.headline, design: .rounded)
        public static let body = Font.system(.body, design: .rounded)

        public static let label = Font.system(.subheadline, design: .rounded).weight(.semibold)

        public static let caption = Font.system(.caption, design: .rounded).weight(.medium)
    }

    // MARK: - Metrics

    public enum Metrics {
        public static let cornerRadius: CGFloat = 20
        public static let cardPadding: CGFloat = 20
        public static let gutter: CGFloat = 16
        public static let ringWidth: CGFloat = 14
    }
}

public extension View {
    /// Standard card treatment. One place to change the whole app's chrome.
    func pushCard(padding: CGFloat = Push.Metrics.cardPadding) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Push.Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous))
    }
}
