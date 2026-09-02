import SwiftUI

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
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.45, dampingFraction: 0.8), value: progress)
        }
        .accessibilityHidden(true)
    }
}

/// The rep count, as the hero of the screen.
///
/// Scales itself down as the number grows so 3 digits still fit, and it must
/// respect Dynamic Type: legibility is the entire point of this view.
public struct HeroCount: View {
    private let value: Int
    private let label: String?

    public init(_ value: Int, label: String? = nil) {
        self.value = value
        self.label = label
    }

    private var size: CGFloat {
        switch value {
        case ..<100: return 132
        case ..<1000: return 108
        default: return 84
        }
    }

    public var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(Push.Typography.hero(size))
                .foregroundStyle(Push.Palette.textPrimary)
                .contentTransition(.numericText(value: Double(value)))
                .animation(.snappy(duration: 0.22), value: value)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            if let label {
                Text(label.uppercased())
                    .font(Push.Typography.label)
                    .tracking(2)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? "Count")
        .accessibilityValue("\(value)")
    }
}

public struct StatChip: View {
    private let emoji: String
    private let value: String
    private let caption: String

    public init(emoji: String, value: String, caption: String) {
        self.emoji = emoji
        self.value = value
        self.caption = caption
    }

    public var body: some View {
        VStack(spacing: 4) {
            Text(emoji).font(.system(size: 20))
            Text(value)
                .font(Push.Typography.stat(20))
                .foregroundStyle(Push.Palette.textPrimary)
            Text(caption)
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Push.Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(caption): \(value)")
    }
}

public struct PrimaryButton: View {
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
            HStack(spacing: 8) {
                if let systemImage { Image(systemName: systemImage) }
                Text(title)
            }
            .font(Push.Typography.title)
            .foregroundStyle(Push.Palette.onAccent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(Push.Palette.accent)
            .clipShape(RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

public struct SecondaryButton: View {
    private let title: String
    private let action: () -> Void

    public init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(title)
                .font(Push.Typography.headline)
                .foregroundStyle(Push.Palette.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(Push.Palette.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: Push.Metrics.cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// Celebration overlay for a PR or achievement.
///
/// Honors Reduce Motion by swapping the animation for a plain state change --
/// the celebration still happens, it just stops moving.
public struct CelebrationBadge: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false

    private let emoji: String
    private let title: String

    public init(emoji: String, title: String) {
        self.emoji = emoji
        self.title = title
    }

    public var body: some View {
        VStack(spacing: 10) {
            Text(emoji).font(.system(size: 56))
            Text(title)
                .font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .background(Push.Palette.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .scaleEffect(appeared || reduceMotion ? 1 : 0.7)
        .opacity(appeared || reduceMotion ? 1 : 0)
        .onAppear {
            guard !reduceMotion else { appeared = true; return }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) { appeared = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}
