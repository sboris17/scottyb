import Foundation

struct LowPassFilter {
    private(set) var value: Double?

    mutating func filter(_ x: Double, alpha: Double) -> Double {
        let result = value.map { alpha * x + (1 - alpha) * $0 } ?? x
        value = result
        return result
    }
}

/// One-Euro filter.
///
/// A fixed low-pass heavy enough to kill pose jitter while the user holds the
/// top of a rep also rounds the corner off a fast descent, and rounded corners
/// cost counted reps. One-Euro widens its own cutoff as the signal speeds up,
/// so it smooths the hold and still tracks the drop.
public struct OneEuroFilter {
    private let minCutoff: Double
    private let beta: Double
    private let derivativeCutoff: Double

    private var xFilter = LowPassFilter()
    private var dxFilter = LowPassFilter()
    private var lastTime: Double?
    private var lastValue: Double = 0

    public init(minCutoff: Double = 1.2, beta: Double = 0.05, derivativeCutoff: Double = 1.0) {
        self.minCutoff = minCutoff
        self.beta = beta
        self.derivativeCutoff = derivativeCutoff
    }

    private func alpha(cutoff: Double, dt: Double) -> Double {
        let tau = 1 / (2 * Double.pi * cutoff)
        return 1 / (1 + tau / dt)
    }

    public mutating func filter(_ x: Double, at time: Double) -> Double {
        guard let last = lastTime, time > last else {
            lastTime = time
            lastValue = x
            _ = xFilter.filter(x, alpha: 1)
            return x
        }
        let dt = time - last
        let dx = (x - lastValue) / dt
        let dxHat = dxFilter.filter(dx, alpha: alpha(cutoff: derivativeCutoff, dt: dt))
        let cutoff = minCutoff + beta * abs(dxHat)
        let result = xFilter.filter(x, alpha: alpha(cutoff: cutoff, dt: dt))
        lastTime = time
        lastValue = x
        return result
    }
}
