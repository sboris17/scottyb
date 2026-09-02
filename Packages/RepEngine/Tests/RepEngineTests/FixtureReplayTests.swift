import XCTest
@testable import RepEngine

/// Replays the exact pose sequences produced by Tools/RepEngineSim.
///
/// The Python reference implementation and this Swift engine are driven by the
/// same bytes, so any divergence between them shows up here as a wrong count
/// rather than as a bug discovered on somebody's living room floor.
final class FixtureReplayTests: XCTestCase {

    struct Fixture: Decodable {
        let name: String
        let note: String
        let expectedReps: Int
        let joints: [String]
        let frames: [[Double]]
    }

    /// Fixture files use snake_case; the engine's enum is camelCase.
    static func jointName(_ raw: String) -> JointName? {
        let parts = raw.split(separator: "_")
        guard parts.count == 2 else { return nil }
        return JointName(rawValue: parts[0] + parts[1].prefix(1).uppercased() + parts[1].dropFirst())
    }

    static func load(_ name: String) throws -> Fixture {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: name, withExtension: "json") else {
            throw XCTSkip("Fixture \(name).json not found in test bundle")
        }
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    static func poseFrames(_ fixture: Fixture) -> [PoseFrame] {
        let names = fixture.joints.compactMap(jointName)
        return fixture.frames.map { row in
            var joints: [JointName: JointPoint] = [:]
            for (i, name) in names.enumerated() {
                let base = 1 + i * 3
                guard base + 2 < row.count else { continue }
                joints[name] = JointPoint(
                    position: Point2D(x: row[base], y: row[base + 1]),
                    confidence: row[base + 2]
                )
            }
            return PoseFrame(time: row[0], joints: joints)
        }
    }

    func replay(_ name: String) throws -> (counted: Int, expected: Int, note: String) {
        let fixture = try Self.load(name)
        let engine = RepEngine()
        for frame in Self.poseFrames(fixture) {
            engine.process(frame)
        }
        return (engine.count, fixture.expectedReps, fixture.note)
    }

    func assertExact(_ name: String, file: StaticString = #filePath, line: UInt = #line) throws {
        let result = try replay(name)
        XCTAssertEqual(result.counted, result.expected,
                       "\(name): \(result.note)", file: file, line: line)
    }

    // MARK: - Positive clips

    func testStandardSet() throws { try assertExact("standard_10") }
    func testSlowDeepSet() throws { try assertExact("slow_deep_8") }
    func testFastSet() throws { try assertExact("fast_15") }
    func testPauseAtBottom() throws { try assertExact("pause_at_bottom_6") }
    func testSaggingBackStillCounts() throws { try assertExact("sagging_back_10") }
    func testHeavyPoseJitter() throws { try assertExact("noisy_10") }

    /// The case fixed thresholds get wrong. A user whose honest bottom is
    /// ~118 degrees never crosses a hard 100, and a fixed-threshold engine
    /// reports zero for a set they really did.
    func testShallowRangeOfMotion() throws { try assertExact("shallow_10") }

    func testVeryShallowRangeOfMotion() throws { try assertExact("very_shallow_8") }

    /// Depth collapses partway through the set. If calibration cannot follow
    /// the user down, counting silently stops mid-workout.
    func testFatigueMidSet() throws { try assertExact("fatigue_12") }

    /// Tracking is lost for several seconds. Losing the unseen reps is
    /// correct; inventing reps to cover the gap is not.
    func testTrackingDropout() throws { try assertExact("dropout_8_of_10") }

    // MARK: - Negative clips
    //
    // A false positive is worse than a missed rep: it makes every number in
    // the app untrustworthy, and the whole product rests on those numbers.

    func testIdlePlankCountsNothing() throws { try assertExact("negative_idle_plank") }
    func testBouncingCountsNothing() throws { try assertExact("negative_bouncing") }

    /// Full-range elbow flexion with the body stationary. Angle alone would
    /// count every one of these; the vertical-travel guard is what rejects them.
    func testArmFlexionWithoutBodyMovementCountsNothing() throws {
        try assertExact("negative_arm_bend")
    }

    func testNoisyIdleCountsNothing() throws { try assertExact("negative_noisy_idle") }

    // MARK: - Aggregate

    /// The ship gate from docs/03-rep-detection.md, enforced as a test.
    func testAggregateAccuracyMeetsShipGate() throws {
        let names = ["standard_10", "shallow_10", "very_shallow_8", "slow_deep_8",
                     "fast_15", "fatigue_12", "sagging_back_10", "pause_at_bottom_6",
                     "dropout_8_of_10", "noisy_10"]
        var error = 0, expected = 0
        for name in names {
            let result = try replay(name)
            error += abs(result.counted - result.expected)
            expected += result.expected
        }
        let accuracy = 1 - Double(error) / Double(expected)
        XCTAssertGreaterThanOrEqual(accuracy, 0.98,
            "Rep accuracy \(accuracy * 100)% is below the 98% ship gate")
    }

    func testNoFalsePositivesOnAnyNegativeClip() throws {
        for name in ["negative_idle_plank", "negative_arm_bend",
                     "negative_noisy_idle", "negative_bouncing"] {
            let result = try replay(name)
            XCTAssertEqual(result.counted, 0, "\(name) produced \(result.counted) phantom rep(s)")
        }
    }
}
