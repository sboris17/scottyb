import SwiftUI
import RepEngine
import PushUI

/// What the counting engine is seeing, live.
///
/// Built for one job: standing over a phone at 3am asking "why didn't that
/// count?". Every number here is a guard the engine applies, shown next to the
/// threshold it has to clear, so a rejected rep explains itself instead of
/// being a mystery.
struct DebugOverlay: View {
    let diagnostics: RepDiagnostics
    let frameRate: Double
    let orientation: String
    let framingIssue: FramingIssue?

    private let tuning = RepEngineTuning()

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            header

            row("elbow", String(format: "%.0f°", diagnostics.elbowAngle))
            // The gate that silently discards frames. A green skeleton proves
            // Vision found joints, not that they were confident enough to
            // count with, and those are not the same thing.
            guardRow("confidence", diagnostics.jointConfidence,
                     min: tuning.minJointConfidence, format: "%.2f")
            row("rotation", orientation)
            row("frames used", diagnostics.usableFrames + diagnostics.unusableFrames == 0
                ? "—"
                : String(format: "%.0f%%  (%d/%d)",
                         diagnostics.usableFrameFraction * 100,
                         diagnostics.usableFrames,
                         diagnostics.usableFrames + diagnostics.unusableFrames))
            row("angle seen", diagnostics.angleSpanSeen > 0
                ? String(format: "%.0f° span", diagnostics.angleSpanSeen) : "—")
            // Zero candidates means no rep was ever judged, which is a
            // completely different problem from a rep being rejected.
            row("attempted", "\(diagnostics.candidateReps)")
            row("band", diagnostics.thresholds.isCalibrated
                ? String(format: "%.0f – %.0f°", diagnostics.thresholds.bottom, diagnostics.thresholds.top)
                : String(format: "%.0f – %.0f° (default)", diagnostics.thresholds.bottom, diagnostics.thresholds.top))

            Divider().overlay(Push.Palette.textSecondary.opacity(0.3))

            Text("LAST CANDIDATE REP")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(Push.Palette.textSecondary)

            guardRow("travel", diagnostics.lastTravel, min: tuning.minBodyTravel, format: "%.3f")
            guardRow("correlation", diagnostics.lastCorrelation, min: tuning.minSignalCorrelation, format: "%.2f")
            guardRow("duration", diagnostics.lastDuration, min: tuning.minRepSeconds, format: "%.2fs")
            guardRow("reversals", Double(diagnostics.lastReversals),
                     max: Double(tuning.maxDirectionReversals), format: "%.0f")

            if let rejection = diagnostics.lastRejection {
                Text("rejected: \(rejection.rawValue)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(Push.Palette.flame)
            }
            if !diagnostics.rejectionCounts.isEmpty {
                Text(diagnostics.rejectionCounts.sorted { $0.key < $1.key }
                        .map { "\($0.key) ×\($0.value)" }.joined(separator: "  "))
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(Push.Palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .frame(maxWidth: 250)
    }

    private var header: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(diagnostics.isConfident ? Push.Palette.accent : Push.Palette.flame)
                .frame(width: 8, height: 8)
            Text(diagnostics.state.uppercased())
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Push.Palette.textPrimary)
            Spacer()
            // Well under 15 means thermal throttling or Vision struggling.
            Text(String(format: "%.0f fps", frameRate))
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(frameRate < 10 ? Push.Palette.flame : Push.Palette.textSecondary)
        }
        .overlay(alignment: .bottomLeading) {
            if let framingIssue {
                Text(framingIssue.rawValue)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(Push.Palette.flame)
                    .offset(y: 14)
            }
        }
        .padding(.bottom, framingIssue == nil ? 0 : 14)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Push.Palette.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(Push.Palette.textPrimary)
        }
    }

    /// Shows the measured value against the threshold it must clear, and
    /// colours it by whether it passed - so the failing guard is obvious.
    private func guardRow(_ label: String, _ value: Double,
                          min: Double? = nil, max: Double? = nil,
                          format: String) -> some View {
        let passed = (min.map { value >= $0 } ?? true) && (max.map { value <= $0 } ?? true)
        let limit = min ?? max ?? 0
        return HStack {
            Text(label)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Push.Palette.textSecondary)
            Spacer()
            Text(String(format: format, value))
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(passed ? Push.Palette.accent : Push.Palette.flame)
            Text(String(format: (min != nil ? "≥" : "≤") + format, limit))
                .font(.system(size: 9, design: .monospaced))
                .foregroundStyle(Push.Palette.textSecondary)
        }
    }

}
