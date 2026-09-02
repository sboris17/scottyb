import Foundation

/// The counting state machine.
///
///     TOP --(angle < bottom)--> BOTTOM --(angle > top)--> guards --> rep
///
/// The guards exist because elbow angle alone cannot tell a push-up apart from
/// someone sitting on the floor bending their arms. Three of them matter:
///
///   travel       the body must drop, not just the arms
///   correlation  it must drop *while* the elbows bend
///   smoothness   it must travel, not judder
///
/// Two recovery mechanisms sit on top, both driven by one rolling buffer:
///
///   bootstrap replay  the first reps happen before there is enough movement
///                     to calibrate; replay recovers them instead of losing them
///   stall replay      if reps stop completing while the signal still swings,
///                     the thresholds no longer describe how the user is
///                     moving (fatigue), so re-read them and replay
public final class RepCounter {
    private enum State { case unknown, top, bottom }

    private let tuning: RepEngineTuning
    private var thresholdsModel: AdaptiveThresholds

    public private(set) var reps: [CountedRep] = []
    public private(set) var rejections: [RepRejection] = []
    public private(set) var diagnostics = RepDiagnostics()
    public var onRep: ((CountedRep) -> Void)?

    private var recent: [RepSignal] = []
    private var calibratedOnce = false
    private var lastRepTime: Double = 0
    private var lastRecalibration: Double = 0

    private var state: State = .unknown
    private var repStartTime: Double = 0
    private var lastAboveTop: Double?
    private var minAngle: Double = 0
    private var maxAngle: Double = 0
    private var posAtTop: Point2D?
    private var belowFrames = 0
    private var topPositions: [Point2D] = []
    private var repSamples: [(angle: Double, position: Point2D)] = []
    private var maxHipDeviation: Double?

    public init(tuning: RepEngineTuning = RepEngineTuning()) {
        self.tuning = tuning
        self.thresholdsModel = AdaptiveThresholds(tuning: tuning)
    }

    public var thresholds: RepThresholds { thresholdsModel.current }
    public var count: Int { reps.count }

    // MARK: - Entry point

    public func process(_ signal: RepSignal) {
        recordDiagnostics(signal)
        guard signal.isConfident else {
            // A skeleton that vanishes and comes back must never read as a rep.
            if state == .bottom { note(.lostPose) }
            resetState()
            return
        }

        thresholdsModel.observe(signal)
        recent.append(signal)
        while let first = recent.first, signal.time - first.time > tuning.replaySeconds {
            recent.removeFirst()
        }

        if !calibratedOnce && thresholdsModel.current.isCalibrated {
            calibratedOnce = true
            replay()
            return
        }

        if shouldRecalibrate(at: signal.time) {
            lastRecalibration = signal.time
            if thresholdsModel.recalibrateFromWindow() {
                replay()
                return
            }
        }

        step(signal)
    }

    public func reset() {
        reps.removeAll()
        rejections.removeAll()
        recent.removeAll()
        calibratedOnce = false
        lastRepTime = 0
        lastRecalibration = 0
        thresholdsModel = AdaptiveThresholds(tuning: tuning)
        resetState()
    }

    private func recordDiagnostics(_ signal: RepSignal) {
        diagnostics.elbowAngle = signal.elbowAngle
        diagnostics.torsoCentre = signal.torsoCentre
        diagnostics.torsoLength = signal.torsoLength
        diagnostics.hipAngle = signal.hipAngle
        diagnostics.isConfident = signal.isConfident
        diagnostics.thresholds = thresholdsModel.current
        switch state {
        case .unknown: diagnostics.state = signal.isConfident ? "waiting for top" : "no pose"
        case .top: diagnostics.state = "top"
        case .bottom: diagnostics.state = "descending"
        }
    }

    private func note(_ rejection: RepRejection) {
        rejections.append(rejection)
        diagnostics.lastRejection = rejection
        diagnostics.rejectionCounts[rejection.rawValue, default: 0] += 1
    }

    private func shouldRecalibrate(at time: Double) -> Bool {
        guard calibratedOnce, state != .unknown else { return false }
        guard time - lastRecalibration >= tuning.stallSeconds else { return false }
        return time - lastRepTime > tuning.stallSeconds
    }

    // MARK: - Replay

    /// Re-run the buffered signal under the current thresholds. Only reps
    /// starting after the last one already counted are kept, so a replay can
    /// add reps but never double-count them.
    private func replay() {
        let cutoff = reps.last?.endedAt ?? -.infinity
        let shadow = RepCounter(tuning: tuning)
        shadow.thresholdsModel.current = thresholdsModel.current
        for signal in recent {
            shadow.step(signal, suppressAdaptation: true)
        }

        for var rep in shadow.reps where rep.startedAt > cutoff {
            rep.index = reps.count + 1
            reps.append(rep)
            lastRepTime = rep.endedAt
            thresholdsModel.record(minAngle: rep.minElbowAngle, maxAngle: rep.maxElbowAngle)
            onRep?(rep)
        }

        // Adopt the shadow's in-flight state so counting continues seamlessly
        // from wherever the replay left off.
        state = shadow.state
        repStartTime = shadow.repStartTime
        lastAboveTop = shadow.lastAboveTop
        minAngle = shadow.minAngle
        maxAngle = shadow.maxAngle
        posAtTop = shadow.posAtTop
        topPositions = shadow.topPositions
        repSamples = shadow.repSamples
        maxHipDeviation = shadow.maxHipDeviation
        belowFrames = shadow.belowFrames
    }

    // MARK: - Machine

    private func step(_ signal: RepSignal, suppressAdaptation: Bool = false) {
        let bounds = thresholdsModel.current

        if signal.elbowAngle >= bounds.top { lastAboveTop = signal.time }

        switch state {
        case .unknown:
            if signal.elbowAngle >= bounds.top { enterTop(signal) }

        case .top:
            maxAngle = max(maxAngle, signal.elbowAngle)
            topPositions.append(signal.torsoCentre)
            if topPositions.count > 6 { topPositions.removeFirst(topPositions.count - 6) }
            posAtTop = Point2D(x: Geometry.median(topPositions.map(\.x)),
                               y: Geometry.median(topPositions.map(\.y)))

            belowFrames = signal.elbowAngle <= bounds.bottom ? belowFrames + 1 : 0
            if belowFrames >= tuning.debounceFrames {
                belowFrames = 0
                state = .bottom
                repStartTime = lastAboveTop ?? signal.time
                minAngle = signal.elbowAngle
                repSamples = [(signal.elbowAngle, signal.torsoCentre)]
                maxHipDeviation = signal.hipAngle.map { abs(180 - $0) }
            }

        case .bottom:
            minAngle = min(minAngle, signal.elbowAngle)
            repSamples.append((signal.elbowAngle, signal.torsoCentre))
            if let deviation = signal.hipAngle.map({ abs(180 - $0) }) {
                maxHipDeviation = max(maxHipDeviation ?? deviation, deviation)
            }

            if signal.time - repStartTime > tuning.maxRepSeconds {
                note(.tooSlow)
                resetState()
                return
            }
            if signal.elbowAngle >= bounds.top {
                complete(signal, suppressAdaptation: suppressAdaptation)
            }
        }
    }

    private func enterTop(_ signal: RepSignal) {
        state = .top
        maxAngle = signal.elbowAngle
        topPositions = [signal.torsoCentre]
        posAtTop = signal.torsoCentre
        repSamples = []
        maxHipDeviation = nil
        belowFrames = 0
        lastAboveTop = signal.time
    }

    private func resetState() {
        state = .unknown
        repStartTime = 0
        lastAboveTop = nil
        minAngle = 0
        maxAngle = 0
        posAtTop = nil
        belowFrames = 0
        topPositions = []
        repSamples = []
        maxHipDeviation = nil
    }

    // MARK: - Guards

    /// The frames nearest full flexion, reduced to one point.
    ///
    /// Median rather than the single deepest frame: the extreme of a noisy
    /// signal is the noise. Tying it to the elbow minimum also forces the
    /// body's low point to coincide with the arms' - true of a push-up, and
    /// not true of jitter.
    private func deepestPosition() -> Point2D? {
        let angles = repSamples.map(\.angle)
        guard let deepest = angles.min(), let widest = angles.max() else { return nil }
        let band = deepest + 0.15 * max(widest - deepest, 1e-6)
        let near = repSamples.filter { $0.angle <= band }.map(\.position)
        guard !near.isEmpty else { return nil }
        return Point2D(x: Geometry.median(near.map(\.x)), y: Geometry.median(near.map(\.y)))
    }

    /// How far the body travelled, as a fraction of torso length.
    ///
    /// A distance, so it reads the same however the camera is rotated.
    private func bodyTravel(torsoLength: Double) -> Double {
        guard let top = posAtTop, let deepest = deepestPosition() else { return 0 }
        return top.distance(to: deepest) / max(torsoLength, 1e-6)
    }

    /// Body travel along the rep's own axis of motion, per frame.
    ///
    /// The rep defines its own "down": the direction from where the body rests
    /// at the top to where it ends up at the bottom. Depth is displacement
    /// projected onto that axis, so it starts at zero and peaks at the bottom
    /// no matter how the phone is propped. Nothing here refers to the image's
    /// x or y axis, which is the entire point - the first build measured the
    /// descent along image-y, and a phone lying on a floor (where iOS reports
    /// no useful orientation) read every push-up as sideways movement.
    private func depthSeries() -> [Double] {
        guard let top = posAtTop, let deepest = deepestPosition() else { return [] }
        let axis = Point2D(x: deepest.x - top.x, y: deepest.y - top.y)
        let length = hypot(axis.x, axis.y)
        guard length > 1e-9 else { return Array(repeating: 0, count: repSamples.count) }
        let ux = axis.x / length, uy = axis.y / length
        return repSamples.map { ($0.position.x - top.x) * ux + ($0.position.y - top.y) * uy }
    }

    /// How many times the body reversed direction during the rep.
    private func directionReversals(_ depths: [Double]) -> Int {
        guard depths.count >= 6, let low = depths.min(), let high = depths.max() else { return 0 }
        let span = max(high - low, 1e-9)
        var deltas: [Double] = []
        for i in 0..<(depths.count - 1) {
            let d = depths[i + 1] - depths[i]
            if abs(d) > 0.04 * span { deltas.append(d) }   // ignore micro-steps
        }
        guard deltas.count >= 2 else { return 0 }
        return (0..<(deltas.count - 1)).reduce(0) { $0 + (deltas[$1] * deltas[$1 + 1] < 0 ? 1 : 0) }
    }

    private func complete(_ signal: RepSignal, suppressAdaptation: Bool) {
        let duration = signal.time - repStartTime
        let travel = bodyTravel(torsoLength: signal.torsoLength)
        let depths = depthSeries()
        // Depth rises as the elbow angle falls, so pairing the angle against
        // negated depth keeps the expected correlation positive.
        let correlation = Geometry.correlation(zip(repSamples.map(\.angle), depths.map { -$0 }).map { ($0, $1) })
        let reversals = directionReversals(depths)
        diagnostics.lastTravel = travel
        diagnostics.lastCorrelation = correlation
        diagnostics.lastReversals = reversals
        diagnostics.lastDuration = duration
        let hipDeviation = maxHipDeviation

        if duration < tuning.minRepSeconds {
            note(.tooFast)
        } else if travel < tuning.minBodyTravel {
            // Arms moved, body did not.
            note(.noBodyTravel)
        } else if correlation < tuning.minSignalCorrelation {
            // Body moved, but not in time with the arms.
            note(.uncorrelated)
        } else if reversals > tuning.maxDirectionReversals {
            // The body juddered rather than travelled.
            note(.notSmooth)
        } else {
            let rep = CountedRep(index: reps.count + 1,
                                 startedAt: repStartTime,
                                 endedAt: signal.time,
                                 minElbowAngle: minAngle,
                                 maxElbowAngle: max(maxAngle, signal.elbowAngle),
                                 bodyTravel: travel,
                                 hipDeviation: hipDeviation)
            reps.append(rep)
            lastRepTime = signal.time
            diagnostics.lastRejection = nil
            if !suppressAdaptation {
                thresholdsModel.record(minAngle: rep.minElbowAngle, maxAngle: rep.maxElbowAngle)
            }
            onRep?(rep)
        }

        enterTop(signal)
    }
}
