import Foundation

/// Every threshold the engine uses, in one place, injectable so tests can
/// sweep them. Values are not guesses: each is set from measured separation
/// between real and negative clips. See Tools/RepEngineSim.
public struct RepEngineTuning: Sendable {
    /// Used until the engine has seen enough of the user's own movement to
    /// calibrate. Generous on purpose: a late rep beats a missed one.
    public var defaultTopAngle: Double = 150
    public var defaultBottomAngle: Double = 100

    public var minCalibrationRange: Double = 18
    public var bottomFraction: Double = 0.30
    public var topFraction: Double = 0.70

    /// Hysteresis as a fraction of the user's own range rather than a fixed
    /// number of degrees. An absolute floor pushes the band wider than a
    /// shallow user's entire range of motion, and they stop being counted
    /// after a single rep.
    public var minGapDegrees: Double = 8
    public var minGapFraction: Double = 0.22

    public var angleCeiling: Double = 170
    public var angleFloor: Double = 55

    public var minRepSeconds: Double = 0.45
    public var maxRepSeconds: Double = 12
    public var minJointConfidence: Double = 0.30

    /// Torso-relative distance the body must travel. Retuned by grid search
    /// when the measurement became a rotation-free distance: a distance is
    /// always positive, so jitter accumulates instead of cancelling and the
    /// old figure no longer applied.
    public var minBodyTravel: Double = 0.023

    /// Elbow angle and shoulder height must move together, because the body
    /// descends *because* the elbows bend. Real reps sit near +0.95; jitter
    /// moves them independently and lands near zero.
    public var minSignalCorrelation: Double = 0.60

    /// A push-up is one descent and one ascent, so the height signal reverses
    /// about once. Measured: real reps never exceed 5, jitter reaches 20.
    public var maxDirectionReversals: Int = 4

    public var debounceFrames: Int = 2
    public var calibrationWindowReps: Int = 4
    public var bootstrapSeconds: Double = 6
    public var stallSeconds: Double = 4
    public var replaySeconds: Double = 15

    public var shallowDepthAngle: Double = 110
    public var backDeviationDegrees: Double = 15
    public var fastTempoSeconds: Double = 0.70

    public init() {}
}
