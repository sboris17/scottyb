import Foundation

public struct RepThresholds: Sendable, Equatable {
    public var top: Double
    public var bottom: Double
    public var isCalibrated: Bool
}

/// Calibrates the counting thresholds to this person, on this day.
///
/// Fixed thresholds are the single biggest source of missed reps. Someone
/// whose honest bottom is 115 degrees never crosses a hard 100, so the app
/// counts zero for a set they actually did - the worst failure this product
/// can have. So the thresholds live inside whatever range the user is
/// actually producing, and follow it when it changes.
struct AdaptiveThresholds {
    private let tuning: RepEngineTuning
    private var repHistory: [(min: Double, max: Double)] = []
    private var window: [RepSignal] = []
    /// Settable so a shadow counter can be seeded during replay.
    var current: RepThresholds

    init(tuning: RepEngineTuning) {
        self.tuning = tuning
        self.current = RepThresholds(top: tuning.defaultTopAngle,
                                     bottom: tuning.defaultBottomAngle,
                                     isCalibrated: false)
    }

    mutating func observe(_ signal: RepSignal) {
        window.append(signal)
        while let first = window.first, signal.time - first.time > tuning.bootstrapSeconds {
            window.removeFirst()
        }
        if repHistory.isEmpty {
            _ = recalibrateFromWindow()
        }
    }

    mutating func record(minAngle: Double, maxAngle: Double) {
        repHistory.append((minAngle, maxAngle))
        if repHistory.count > tuning.calibrationWindowReps {
            repHistory.removeFirst(repHistory.count - tuning.calibrationWindowReps)
        }
        _ = apply(low: Geometry.median(repHistory.map(\.min)),
                  high: Geometry.median(repHistory.map(\.max)))
    }

    /// Re-read thresholds from raw signal, ignoring rep history. Used when
    /// reps stop completing: the user has changed how they move - fatigue
    /// shortening their range is the common case - and the rep-derived
    /// thresholds now describe a range they can no longer reach.
    @discardableResult
    mutating func recalibrateFromWindow() -> Bool {
        guard window.count >= 8 else { return false }
        let heights = window.map(\.shoulderHeight)
        let torso = max(Geometry.median(window.map(\.torsoLength)), 1e-6)

        // Percentile span, not min/max: across a six-second window the two
        // extremes are by definition the noisiest samples in it. Requiring the
        // body to have moved stops the engine calibrating onto pure jitter and
        // then dutifully counting it.
        let span = Geometry.percentile(heights, 0.90) - Geometry.percentile(heights, 0.10)
        guard span / torso >= tuning.minVerticalTravel else { return false }

        let angles = window.map(\.elbowAngle)
        return apply(low: angles.min() ?? 0, high: angles.max() ?? 0)
    }

    private mutating func apply(low: Double, high: Double) -> Bool {
        let range = high - low
        guard range >= tuning.minCalibrationRange else { return false }

        var top = low + tuning.topFraction * range
        var bottom = low + tuning.bottomFraction * range
        let minGap = max(tuning.minGapDegrees, tuning.minGapFraction * range)
        if top - bottom < minGap {
            let mid = (top + bottom) / 2
            top = mid + minGap / 2
            bottom = mid - minGap / 2
        }
        current = RepThresholds(top: min(top, tuning.angleCeiling),
                                bottom: max(bottom, tuning.angleFloor),
                                isCalibrated: true)
        return true
    }
}
