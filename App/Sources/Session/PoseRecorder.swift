import Foundation
import RepEngine

/// Captures a set as replayable pose data, so counting can be debugged off the
/// floor instead of on it.
///
/// Every counting problem so far has been chased the same miserable way: do
/// push-ups, report what happened, guess, ship a build, repeat. Days per
/// iteration, and the person paying for each one is doing push-ups. Worse, the
/// guessing was done against a body invented in Python whose projected elbow
/// swing disagreed with a real device by a factor of three.
///
/// A recorded set collapses that loop to seconds: change a threshold, replay
/// every clip, read the counts.
///
/// **No video and nothing identifiable is captured.** These are twelve joint
/// coordinates per frame - numbers describing where a shoulder was, not a
/// picture of anybody. The camera frames themselves are analysed and discarded
/// exactly as they always were.
///
/// The output is deliberately the same JSON the fixture suite already reads,
/// so a recording drops into `Packages/RepEngine/Tests/RepEngineTests/Fixtures`
/// and `Tools/RepEngineSim/run.py` with nothing to convert.
///
/// Not actor-isolated, and that is a decision rather than an oversight. This is
/// a passive buffer with no async work of its own, reached from exactly two
/// places, both already on the main thread: `SessionModel.ingest`, which is
/// only ever called from the main-queue hop in `PoseCameraController`, and the
/// summary view. Isolating it would mean isolating `SessionModel` too, which
/// drags in the rest-timer callback for no gain here.
final class PoseRecorder {

    /// The order joints are written in, and the order they are read back in.
    /// Matches `synth.JOINT_NAMES` exactly - a recording that disagreed with
    /// the generator would be silently misread rather than rejected.
    static let jointOrder: [(name: String, joint: JointName)] = [
        ("left_shoulder", .leftShoulder), ("left_elbow", .leftElbow),
        ("left_wrist", .leftWrist), ("left_hip", .leftHip),
        ("left_knee", .leftKnee), ("left_ankle", .leftAnkle),
        ("right_shoulder", .rightShoulder), ("right_elbow", .rightElbow),
        ("right_wrist", .rightWrist), ("right_hip", .rightHip),
        ("right_knee", .rightKnee), ("right_ankle", .rightAnkle),
    ]

    /// About six and a half minutes at 15fps. Recording stops rather than
    /// dropping old frames: a clip missing its middle is worse than no clip,
    /// because its rep count would no longer be ground truth for what it
    /// contains.
    private static let maxFrames = 6000

    private(set) var frames: [PoseFrame] = []
    private(set) var isTruncated = false

    var frameCount: Int { frames.count }
    var isEmpty: Bool { frames.isEmpty }

    /// Roughly, for the UI. Twelve joints at three numbers each, plus a time.
    var approximateKilobytes: Int { max(1, frames.count * 37 * 8 / 1024) }

    func reset() {
        frames.removeAll()
        isTruncated = false
    }

    func record(_ frame: PoseFrame) {
        guard frames.count < Self.maxFrames else {
            isTruncated = true
            return
        }
        frames.append(frame)
    }

    // MARK: - Export

    /// A recording in the fixture format, ready to replay.
    ///
    /// `actualReps` is what the person says they really did, which is the
    /// entire point: without a human-supplied ground truth the clip proves
    /// nothing, since the count under test is the thing in question.
    func fixtureJSON(name: String, actualReps: Int, counted: Int, note: String) throws -> Data {
        let rows: [[Double]] = frames.map { frame in
            var row: [Double] = [round(frame.time * 10_000) / 10_000]
            for entry in Self.jointOrder {
                let point = frame.joints[entry.joint]
                // A joint the detector never found is written as zero
                // confidence rather than omitted, so every row is the same
                // width and a missing joint stays visible in the data.
                row.append(round((point?.position.x ?? 0) * 100_000) / 100_000)
                row.append(round((point?.position.y ?? 0) * 100_000) / 100_000)
                row.append(round((point?.confidence ?? 0) * 100_000) / 100_000)
            }
            return row
        }

        let payload = Fixture(
            name: name,
            note: note,
            expectedReps: actualReps,
            countedAtRecording: counted,
            joints: Self.jointOrder.map(\.name),
            frames: rows
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(payload)
    }

    /// Mirrors the generator's schema, plus one field.
    ///
    /// `countedAtRecording` is what the app thought at the time. The fixture
    /// reader ignores unknown keys, so it costs nothing, and it turns every
    /// clip into a record of the miss as well as the truth - which is what
    /// makes a regression visible later.
    private struct Fixture: Encodable {
        let name: String
        let note: String
        let expectedReps: Int
        let countedAtRecording: Int
        let joints: [String]
        let frames: [[Double]]
    }

    /// Writes the recording somewhere the share sheet can reach.
    func write(name: String, actualReps: Int, counted: Int, note: String) throws -> URL {
        let data = try fixtureJSON(name: name, actualReps: actualReps,
                                   counted: counted, note: note)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(name).json")
        try data.write(to: url, options: .atomic)
        return url
    }

    /// `real_2026-09-03_1431_12reps` - sortable, and says what it holds without
    /// being opened.
    static func suggestedName(reps: Int, date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HHmm"
        return "real_\(formatter.string(from: date))_\(reps)reps"
    }
}
