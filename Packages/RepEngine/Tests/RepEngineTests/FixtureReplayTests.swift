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
        let tail = parts[1]
        return JointName(rawValue: String(parts[0]) + tail.prefix(1).uppercased() + String(tail.dropFirst()))
    }

    /// Missing fixtures must FAIL, never skip. A skipped accuracy gate passes
    /// green and proves nothing, which is the worst possible way for the
    /// counting engine to regress.
    struct MissingFixture: Error, CustomStringConvertible {
        let name: String
        var description: String {
            "Fixture \(name).json is not in the test bundle. Run `make fixtures`."
        }
    }

    static func load(_ name: String) throws -> Fixture {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: name, withExtension: "json") else {
            throw MissingFixture(name: name)
        }
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    static let allFixtures = [
        "standard_10", "shallow_10", "very_shallow_8", "slow_deep_8", "fast_15",
        "fatigue_12", "sagging_back_10", "pause_at_bottom_6", "dropout_8_of_10",
        "noisy_10", "weak_hip_10", "flicker_10",
        "negative_idle_plank", "negative_arm_bend",
        "negative_noisy_idle", "negative_bouncing",
    ]

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

    /// Guards the guard: proves every fixture is present and carries real
    /// frames, so a bundling mistake cannot quietly empty the suite.
    func testEveryFixtureIsPresentAndPopulated() throws {
        for name in Self.allFixtures {
            let fixture = try Self.load(name)
            // At 15fps, two seconds. Enough to prove the clip is populated and
            // not truncated, while staying true of the short negative clips.
            XCTAssertGreaterThanOrEqual(fixture.frames.count, 30, "\(name) looks truncated")
            XCTAssertEqual(fixture.frames.first?.count, 1 + fixture.joints.count * 3,
                           "\(name) rows do not match its joint list")
            XCTAssertEqual(fixture.joints.count, 12, "\(name) is missing joints")
            let frames = Self.poseFrames(fixture)
            XCTAssertEqual(frames.count, fixture.frames.count)
            XCTAssertEqual(frames.first?.joints.count, 12, "\(name) failed to map joint names")
        }
    }

    /// Every rep the counter credits must also show up as a rep it judged.
    ///
    /// Found on a device recording that read "5 push-ups" and "attempted: 0" on
    /// the same screen. Reps recovered by replay are judged inside a throwaway
    /// shadow counter, so the visible diagnostics kept none of it: the summary
    /// reported nothing judged and all four guard values at zero, which is the
    /// exact signature the coach reads as "the camera never saw a rep at all"
    /// and answers with advice about camera angle.
    func testJudgedCandidatesSurviveReplay() throws {
        for name in ["standard_10", "fatigue_12", "slow_deep_8", "weak_hip_10"] {
            let fixture = try Self.load(name)
            let engine = RepEngine()
            var diagnostics = RepDiagnostics()
            for frame in Self.poseFrames(fixture) {
                diagnostics = engine.process(frame).diagnostics
            }
            XCTAssertGreaterThanOrEqual(
                diagnostics.candidateReps, engine.count,
                "\(name): counted \(engine.count) reps but reports \(diagnostics.candidateReps) judged")
            // Replay re-judges a window the live pass already judged. Counting
            // both would inflate this without bound, so it is pinned from above
            // as well: a handful of genuine near-misses, not a second tally.
            XCTAssertLessThanOrEqual(
                diagnostics.candidateReps, engine.count + 4,
                "\(name): \(diagnostics.candidateReps) judged for \(engine.count) reps looks double-counted")
        }
    }

    /// The guard readout is what a stuck count is diagnosed from, so it has to
    /// describe a real rep rather than the zeroes of a rep that never happened.
    func testGuardValuesAreReportedForCountedReps() throws {
        let fixture = try Self.load("standard_10")
        let engine = RepEngine()
        var diagnostics = RepDiagnostics()
        for frame in Self.poseFrames(fixture) {
            diagnostics = engine.process(frame).diagnostics
        }
        XCTAssertGreaterThan(engine.count, 0)
        XCTAssertGreaterThan(diagnostics.lastTravel, 0, "travel reported as zero for a counted rep")
        XCTAssertGreaterThan(diagnostics.lastDuration, 0, "duration reported as zero for a counted rep")
    }

    // MARK: - Positive clips

    func testStandardSet() throws { try assertExact("standard_10") }
    func testSlowDeepSet() throws { try assertExact("slow_deep_8") }
    func testFastSet() throws { try assertExact("fast_15") }
    func testPauseAtBottom() throws { try assertExact("pause_at_bottom_6") }
    func testSaggingBackStillCounts() throws { try assertExact("sagging_back_10") }
    func testHeavyPoseJitter() throws { try assertExact("noisy_10") }

    /// One unreliable hip used to take the count from ten to zero, because a
    /// frame was only usable if shoulder, elbow, wrist AND hip were all
    /// confident on the same side. The skeleton kept drawing from the other
    /// joints, so it looked like everything was working.
    func testOneWeakHipDoesNotStopCounting() throws { try assertExact("weak_hip_10") }

    /// Detection blinking in and out, as it does on a distant or dim subject.
    func testIntermittentDetectionStillCounts() throws { try assertExact("flicker_10") }

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

    /// The known limit, pinned so it cannot quietly get worse.
    ///
    /// A body holding still under jitter heavy enough that the elbow angle
    /// alone swings like a real rep. Harsher than reality: the generator holds
    /// joint confidence at 0.88 while injecting that noise, where Vision would
    /// report low confidence for tracking that unstable. One phantom rep is
    /// tolerated here and nowhere else.
    func testNoisyIdleStaysWithinItsKnownBudget() throws {
        let result = try replay("negative_noisy_idle")
        XCTAssertLessThanOrEqual(result.counted, 1,
            "noisy-idle phantom reps regressed to \(result.counted)")
    }

    // MARK: - Aggregate

    /// The ship gate from docs/03-rep-detection.md, enforced as a test.
    func testAggregateAccuracyMeetsShipGate() throws {
        let names = Self.allFixtures.filter { !$0.hasPrefix("negative_") }
        var error = 0, expected = 0
        for name in names {
            let result = try replay(name)
            error += abs(result.counted - result.expected)
            expected += result.expected
        }
        XCTAssertEqual(expected, 117, "the positive fixture set changed shape")
        let accuracy = 1 - Double(error) / Double(expected)
        XCTAssertGreaterThanOrEqual(accuracy, 0.98,
            "Rep accuracy \(accuracy * 100)% is below the 98% ship gate")
    }

    func testNoFalsePositivesOnAnyNegativeClip() throws {
        // negative_noisy_idle has its own documented budget above; every other
        // negative must be exactly zero.
        for name in Self.allFixtures.filter({ $0.hasPrefix("negative_") && $0 != "negative_noisy_idle" }) {
            let result = try replay(name)
            XCTAssertEqual(result.counted, 0, "\(name) produced \(result.counted) phantom rep(s)")
        }
    }

    // MARK: - Rotation

    /// Rotates every joint about the centre of the frame, as a differently
    /// propped phone would.
    static func rotate(_ frames: [PoseFrame], degrees: Double) -> [PoseFrame] {
        let theta = degrees * .pi / 180
        let c = cos(theta), s = sin(theta)
        return frames.map { frame in
            var spun: [JointName: JointPoint] = [:]
            for (name, joint) in frame.joints {
                let dx = joint.position.x - 0.5, dy = joint.position.y - 0.5
                spun[name] = JointPoint(
                    position: Point2D(x: 0.5 + dx * c - dy * s, y: 0.5 + dx * s + dy * c),
                    confidence: joint.confidence)
            }
            return PoseFrame(time: frame.time, joints: spun)
        }
    }

    /// The count must not depend on how the phone is rotated.
    ///
    /// This is not hypothetical. The first build measured the body's descent
    /// along the image's y axis, so a phone propped on a floor - exactly where
    /// this app asks you to put it, and exactly where iOS reports no useful
    /// orientation - read every push-up as sideways movement and counted none.
    func testCountsAreInvariantUnderRotation() throws {
        for name in Self.allFixtures {
            let fixture = try Self.load(name)
            let frames = Self.poseFrames(fixture)
            var counts: [Int] = []
            for angle in [0.0, 37, 90, 180, 270] {
                let engine = RepEngine()
                for frame in Self.rotate(frames, degrees: angle) { engine.process(frame) }
                counts.append(engine.count)
            }
            XCTAssertEqual(Set(counts).count, 1,
                "\(name) counted \(counts) at 0/37/90/180/270 degrees")
        }
    }
}
