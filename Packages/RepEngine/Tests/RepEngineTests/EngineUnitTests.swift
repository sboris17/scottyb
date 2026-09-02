import XCTest
@testable import RepEngine

final class GeometryTests: XCTestCase {
    func testRightAngle() {
        let angle = Geometry.angle(Point2D(x: 0, y: 1),
                                   vertex: Point2D(x: 0, y: 0),
                                   Point2D(x: 1, y: 0))
        XCTAssertEqual(try XCTUnwrap(angle), 90, accuracy: 0.001)
    }

    func testStraightArm() {
        let angle = Geometry.angle(Point2D(x: 0, y: 2),
                                   vertex: Point2D(x: 0, y: 1),
                                   Point2D(x: 0, y: 0))
        XCTAssertEqual(try XCTUnwrap(angle), 180, accuracy: 0.001)
    }

    /// The reason elbow angle is the counting signal: it does not care how far
    /// away the phone is or how big the user is.
    func testAngleIsScaleInvariant() throws {
        let small = try XCTUnwrap(Geometry.angle(Point2D(x: 0, y: 1), vertex: .init(x: 0, y: 0), Point2D(x: 1, y: 1)))
        let large = try XCTUnwrap(Geometry.angle(Point2D(x: 0, y: 10), vertex: .init(x: 0, y: 0), Point2D(x: 10, y: 10)))
        XCTAssertEqual(small, large, accuracy: 0.001)
    }

    func testDegeneratePointsReturnNil() {
        XCTAssertNil(Geometry.angle(Point2D(x: 0, y: 0), vertex: .init(x: 0, y: 0), Point2D(x: 1, y: 1)))
    }

    func testMedianOfEvenCount() {
        XCTAssertEqual(Geometry.median([4, 1, 3, 2]), 2.5, accuracy: 1e-9)
    }

    func testCorrelationOfAlignedSignals() {
        let pairs = (0..<20).map { (Double($0), Double($0) * 2 + 1) }
        XCTAssertEqual(Geometry.correlation(pairs), 1, accuracy: 1e-6)
    }

    func testCorrelationOfOpposedSignals() {
        let pairs = (0..<20).map { (Double($0), -Double($0)) }
        XCTAssertEqual(Geometry.correlation(pairs), -1, accuracy: 1e-6)
    }
}

final class AdaptiveThresholdTests: XCTestCase {
    /// Hysteresis must be a fraction of the user's range. With an absolute
    /// floor, a shallow user's band ends up wider than their whole range of
    /// motion and they get exactly one rep for the entire set.
    func testHysteresisNeverExceedsUserRange() {
        var tuning = RepEngineTuning()
        tuning.minCalibrationRange = 18
        var model = AdaptiveThresholds(tuning: tuning)
        for i in 0..<10 {
            let angle = i.isMultiple(of: 2) ? 158.0 : 128.0
            model.record(minAngle: 128, maxAngle: 158)
            _ = angle
        }
        let bounds = model.current
        XCTAssertTrue(bounds.isCalibrated)
        XCTAssertLessThan(bounds.top, 158, "top threshold must sit inside the user's reachable range")
        XCTAssertGreaterThan(bounds.bottom, 128, "bottom threshold must sit inside the user's reachable range")
        XCTAssertGreaterThan(bounds.top - bounds.bottom, 0)
    }

    func testUncalibratedUsesDefaults() {
        let tuning = RepEngineTuning()
        let model = AdaptiveThresholds(tuning: tuning)
        XCTAssertFalse(model.current.isCalibrated)
        XCTAssertEqual(model.current.top, tuning.defaultTopAngle)
        XCTAssertEqual(model.current.bottom, tuning.defaultBottomAngle)
    }
}

final class FormCoachTests: XCTestCase {
    private func rep(index: Int = 1, depth: Double = 80, duration: Double = 2, hip: Double? = nil) -> CountedRep {
        CountedRep(index: index, startedAt: 0, endedAt: duration,
                   minElbowAngle: depth, maxElbowAngle: 165,
                   verticalTravel: 0.3, hipDeviation: hip)
    }

    func testShallowRepEarnsDepthHint() {
        var coach = FormCoach()
        XCTAssertEqual(coach.hint(for: rep(depth: 125)), .goLower)
    }

    func testSaggingHipsTakePriority() {
        var coach = FormCoach()
        XCTAssertEqual(coach.hint(for: rep(depth: 125, hip: 30)), .straighterBack)
    }

    func testGoodRepEarnsNoHint() {
        var coach = FormCoach()
        XCTAssertNil(coach.hint(for: rep()))
    }

    /// A hint on every rep turns the coach into a referee, which the product
    /// explicitly does not want.
    func testHintsAreRationed() {
        var coach = FormCoach()
        XCTAssertEqual(coach.hint(for: rep(index: 1, depth: 130)), .goLower)
        XCTAssertNil(coach.hint(for: rep(index: 2, depth: 130)))
        XCTAssertNil(coach.hint(for: rep(index: 3, depth: 130)))
        XCTAssertEqual(coach.hint(for: rep(index: 5, depth: 130)), .goLower)
    }
}
