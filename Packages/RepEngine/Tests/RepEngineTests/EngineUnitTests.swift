import XCTest
@testable import RepEngine

final class GeometryTests: XCTestCase {
    func testRightAngle() throws {
        let angle = Geometry.angle(Point2D(x: 0, y: 1),
                                   vertex: Point2D(x: 0, y: 0),
                                   Point2D(x: 1, y: 0))
        XCTAssertEqual(try XCTUnwrap(angle), 90, accuracy: 0.001)
    }

    func testStraightArm() throws {
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
        // A user whose whole range of motion is 128...158 degrees.
        for _ in 0..<4 { model.record(minAngle: 128, maxAngle: 158) }
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
                   bodyTravel: 0.3, hipDeviation: hip)
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

/// Diagnostics get read by a person who is trying to work out why nothing
/// counted, and a wrong number there costs a whole test session. These pin the
/// two that decide what advice the app gives.
final class DiagnosticAccountingTests: XCTestCase {
    private func confident(_ angle: Double, at time: Double) -> RepSignal {
        RepSignal(time: time, elbowAngle: angle, torsoCentre: Point2D(x: 0.5, y: 0.5),
                  torsoLength: 0.3, hipAngle: 170, isConfident: true, jointConfidence: 0.8)
    }

    /// An unusable frame reports an elbow angle of zero because there was no
    /// arm to measure. Folding that into the session's angle span pinned the
    /// minimum at zero and made the span read as a full-range movement that
    /// never happened - and every session starts with unusable frames, so the
    /// coach could never reach its "camera is head-on" advice.
    func testUnusableFramesDoNotWidenTheAngleSpan() {
        let counter = RepCounter()
        counter.process(.unusable(at: 0))
        for (i, angle) in [160.0, 158, 162, 159].enumerated() {
            counter.process(confident(angle, at: 0.1 + Double(i) * 0.1))
        }
        counter.process(.unusable(at: 1))

        XCTAssertEqual(counter.diagnostics.angleSpanSeen, 4, accuracy: 0.001,
                       "span must describe the arm, not the frames where there was no arm")
        XCTAssertLessThan(counter.diagnostics.angleSpanSeen, 25,
                          "an arm that barely moved must read as barely moved")
    }

    func testFrameAccountingSeparatesSeenFromUnseen() {
        let counter = RepCounter()
        for i in 0..<3 { counter.process(confident(160, at: Double(i) * 0.1)) }
        for i in 0..<1 { counter.process(.unusable(at: 1 + Double(i))) }

        XCTAssertEqual(counter.diagnostics.usableFrames, 3)
        XCTAssertEqual(counter.diagnostics.unusableFrames, 1)
        XCTAssertEqual(counter.diagnostics.usableFrameFraction, 0.75, accuracy: 1e-9)
    }

    /// A rejected frame still has to report how confident it was. "Not
    /// confident enough" is unfalsifiable otherwise: nothing distinguishes a
    /// frame that missed the gate by a hair from one where nobody was there.
    func testRejectedFramesStillCarryTheirConfidence() {
        let counter = RepCounter()
        counter.process(.unusable(at: 0, confidence: 0.22))
        XCTAssertEqual(counter.diagnostics.jointConfidence, 0.22, accuracy: 1e-9)
    }
}
