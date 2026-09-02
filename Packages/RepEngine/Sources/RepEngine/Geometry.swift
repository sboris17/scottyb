import Foundation

/// A 2D point in Vision's normalized image space: origin bottom-left, both
/// axes in 0...1. Deliberately not CGPoint so this package stays portable and
/// testable away from Apple platforms.
public struct Point2D: Equatable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    public func distance(to other: Point2D) -> Double {
        hypot(other.x - x, other.y - y)
    }
}

public enum Geometry {
    /// Interior angle at `vertex`, in degrees. Nil if the points are degenerate.
    ///
    /// This is the workhorse of the whole engine: an angle is invariant to how
    /// far the phone sits from the user and to how big the user is, which a
    /// distance in pixels is not.
    public static func angle(_ a: Point2D, vertex: Point2D, _ c: Point2D) -> Double? {
        let v1 = Point2D(x: a.x - vertex.x, y: a.y - vertex.y)
        let v2 = Point2D(x: c.x - vertex.x, y: c.y - vertex.y)
        let magnitude = hypot(v1.x, v1.y) * hypot(v2.x, v2.y)
        guard magnitude > 1e-9 else { return nil }
        let dot = v1.x * v2.x + v1.y * v2.y
        return acos(min(1, max(-1, dot / magnitude))) * 180 / .pi
    }

    public static func median(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        return sorted.count.isMultiple(of: 2)
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid]
    }

    /// Value at `fraction` through the sorted sample, e.g. 0.9 for the 90th
    /// percentile. Used instead of min/max wherever noise extremes would lie.
    public static func percentile(_ values: [Double], _ fraction: Double) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let index = Int(fraction * Double(sorted.count - 1))
        return sorted[min(max(index, 0), sorted.count - 1)]
    }

    /// Pearson correlation between the two components of a paired sample.
    public static func correlation(_ pairs: [(Double, Double)]) -> Double {
        guard pairs.count >= 4 else { return 0 }
        let n = Double(pairs.count)
        let meanX = pairs.reduce(0) { $0 + $1.0 } / n
        let meanY = pairs.reduce(0) { $0 + $1.1 } / n
        var numerator = 0.0, sumX = 0.0, sumY = 0.0
        for (x, y) in pairs {
            let dx = x - meanX, dy = y - meanY
            numerator += dx * dy
            sumX += dx * dx
            sumY += dy * dy
        }
        let denominator = (sumX * sumY).squareRoot()
        return denominator < 1e-12 ? 0 : numerator / denominator
    }
}
