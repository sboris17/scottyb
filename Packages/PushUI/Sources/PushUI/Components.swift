import SwiftUI

// MARK: - Progress

/// Circular progress. Used for the daily goal and for set progress.
public struct ProgressRing: View {
    private let progress: Double
    private let lineWidth: CGFloat
    private let tint: Color

    public init(progress: Double, lineWidth: CGFloat = Push.Metrics.ringWidth, tint: Color = Push.Palette.accent) {
        self.progress = progress
        self.lineWidth = lineWidth
        self.tint = tint
    }

    public var body: some View {
        ZStack {
            Circle()
                .stroke(Push.Palette.track, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            Circle()
                .trim(from: 0, to: max(0.001, min(1, progress)))
                // A flat band of one colour reads as a plastic toy at this
                // width. The sweep gives the arc a direction and a head.
                .stroke(
                    AngularGradient(colors: [tint.opacity(0.45), tint],
                                    center: .center,
                                    startAngle: .degrees(0),
                                    endAngle: .degrees(360)),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.45, dampingFraction: 0.8), value: progress)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Numbers

/// The rep count, as the hero of the screen.
///
/// Scales itself down as the number grows so 3 digits still fit, and it must
/// respect Dynamic Type: legibility is the entire point of this view.
///
/// The label under it is sentence case. It used to be capitals with two points
/// of tracking, which is the single most over-used move in fitness UI and was
/// on nine different screens here.
public struct HeroCount: View {
    private let value: Int
    private let label: String?

    public init(_ value: Int, label: String? = nil) {
        self.value = value
        self.label = label
    }

    private var size: CGFloat {
        switch value {
        case ..<100: return 128
        case ..<1000: return 104
        default: return 80
        }
    }

    public var body: some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(Push.Typography.numeral(size))
                .tracking(Push.Typography.numeralTracking(size))
                .foregroundStyle(Push.Palette.textPrimary)
                .contentTransition(.numericText(value: Double(value)))
                .animation(.snappy(duration: 0.22), value: value)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            if let label {
                Text(label)
                    .font(Push.Typography.label)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? "Count")
        .accessibilityValue("\(value)")
    }
}

/// A row of numbers separated by hairlines, with no boxes around them.
///
/// This replaces a row of filled tiles with an emoji on each. Three grey
/// rectangles side by side, each with a 🔥 or a 🏆 on top, is the house style
/// of every generated fitness app; it also wasted a third of its height on
/// pictures that said nothing the caption underneath did not.
public struct MetricStrip: View {

    public struct Item: Identifiable {
        public let id = UUID()
        public let value: String
        public let caption: String

        public init(_ value: String, _ caption: String) {
            self.value = value
            self.caption = caption
        }
    }

    private let items: [Item]
    private let valueSize: CGFloat

    public init(_ items: [Item], valueSize: CGFloat = 24) {
        self.items = items
        self.valueSize = valueSize
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { pair in
                if pair.offset > 0 {
                    Rectangle()
                        .fill(Push.Palette.stroke)
                        .frame(width: 1, height: 30)
                }
                VStack(spacing: 3) {
                    Text(pair.element.value)
                        .font(Push.Typography.stat(valueSize))
                        .foregroundStyle(Push.Palette.textPrimary)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(pair.element.caption)
                        .font(Push.Typography.micro)
                        .foregroundStyle(Push.Palette.textTertiary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(pair.element.caption): \(pair.element.value)")
            }
        }
    }
}

// MARK: - Labels

/// A section heading, sitting above its content rather than inside it.
public struct SectionHeader: View {
    private let title: String
    private let detail: String?

    public init(_ title: String, detail: String? = nil) {
        self.title = title
        self.detail = detail
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textPrimary)
            Spacer(minLength: 8)
            if let detail {
                Text(detail)
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textTertiary)
            }
        }
    }
}

/// A small status marker - "In progress", "Recommended".
///
/// Replaces the capitalised, letter-spaced strap line that used to sit on top
/// of most cards. Same job, a fifth of the visual weight, and it looks like
/// something rather than like a heading that lost its nerve.
public struct PushTag: View {
    private let text: String
    private let systemImage: String?
    private let tint: Color

    public init(_ text: String, systemImage: String? = nil, tint: Color = Push.Palette.accent) {
        self.text = text
        self.systemImage = systemImage
        self.tint = tint
    }

    public var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage).font(.system(size: 10, weight: .semibold))
            }
            Text(text).font(Push.Typography.micro)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.13), in: Capsule())
    }
}

/// A tinted circle with a symbol in it. The app's only decorative element, and
/// it inherits the tint, the weight and Dynamic Type - which is exactly what
/// an emoji could not do.
public struct SymbolBadge: View {
    private let systemImage: String
    private let diameter: CGFloat
    private let tint: Color

    public init(_ systemImage: String, diameter: CGFloat = 44, tint: Color = Push.Palette.accent) {
        self.systemImage = systemImage
        self.diameter = diameter
        self.tint = tint
    }

    public var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: diameter * 0.42, weight: .medium))
            .foregroundStyle(tint)
            .frame(width: diameter, height: diameter)
            .background(tint.opacity(0.13), in: Circle())
            .accessibilityHidden(true)
    }
}

// MARK: - Buttons

/// Press feedback on every button in the app.
///
/// A control that does not acknowledge the touch feels broken on hardware even
/// when it works, and this app is tapped with sweaty hands from the floor.
public struct PushPressStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.975 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

public struct PrimaryButton: View {
    @Environment(\.isEnabled) private var isEnabled

    private let title: String
    private let systemImage: String?
    private let action: () -> Void

    public init(_ title: String, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let systemImage {
                    Image(systemName: systemImage).font(.system(size: 15, weight: .bold))
                }
                Text(title)
                    .font(.system(.headline, design: .default).weight(.semibold))
            }
            .foregroundStyle(Push.Palette.onAccent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Push.Palette.accent,
                        in: RoundedRectangle(cornerRadius: Push.Metrics.controlRadius, style: .continuous))
            .opacity(isEnabled ? 1 : 0.4)
        }
        .buttonStyle(PushPressStyle())
    }
}

/// Outlined rather than filled.
///
/// A second solid grey slab under the accent one made two buttons of nearly
/// equal weight, so neither read as the answer. An outline is unmistakably the
/// alternative.
public struct SecondaryButton: View {
    @Environment(\.isEnabled) private var isEnabled

    private let title: String
    private let systemImage: String?
    private let action: () -> Void

    public init(_ title: String, systemImage: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let systemImage {
                    Image(systemName: systemImage).font(.system(size: 14, weight: .semibold))
                }
                Text(title).font(Push.Typography.headline)
            }
            .foregroundStyle(Push.Palette.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Push.Palette.surfaceRaised.opacity(0.6),
                        in: RoundedRectangle(cornerRadius: Push.Metrics.controlRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Push.Metrics.controlRadius, style: .continuous)
                    .strokeBorder(Push.Palette.stroke, lineWidth: 1)
            }
            .opacity(isEnabled ? 1 : 0.4)
        }
        .buttonStyle(PushPressStyle())
    }
}

/// Text only. For the third option on a screen that should not look like it
/// has three options.
public struct QuietButton: View {
    private let title: String
    private let action: () -> Void

    public init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(title)
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(PushPressStyle())
    }
}

// MARK: - Celebration

/// Celebration overlay for a PR or achievement.
///
/// Honors Reduce Motion by swapping the animation for a plain state change --
/// the celebration still happens, it just stops moving.
public struct CelebrationBadge: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    private let systemImage: String
    private let title: String

    public init(systemImage: String, title: String) {
        self.systemImage = systemImage
        self.title = title
    }

    public var body: some View {
        HStack(spacing: 14) {
            SymbolBadge(systemImage, diameter: 46)
            Text(title)
                .font(Push.Typography.headline)
                .foregroundStyle(Push.Palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(Push.Palette.accentSoft,
                    in: RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous)
                .strokeBorder(Push.Palette.accent.opacity(0.35), lineWidth: 1)
        }
        .scaleEffect(appeared || reduceMotion ? 1 : 0.92)
        .opacity(appeared || reduceMotion ? 1 : 0)
        .onAppear {
            guard !reduceMotion else { appeared = true; return }
            withAnimation(.spring(response: 0.45, dampingFraction: 0.7)) { appeared = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}
