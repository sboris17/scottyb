import Foundation

/// Facade over the pose pipeline: frames in, reps and hints out.
///
/// Nothing here touches Vision, AVFoundation or SwiftUI, which is what lets
/// the whole engine run against recorded fixtures in a unit test rather than
/// needing somebody on the floor in front of a device.
public final class RepEngine {
    public struct Output: Sendable {
        public var rep: CountedRep?
        public var hint: FormHint?
        public var totalReps: Int
        public var thresholds: RepThresholds
    }

    private var interpreter: PoseInterpreter
    private var coach: FormCoach
    private let counter: RepCounter

    public init(tuning: RepEngineTuning = RepEngineTuning()) {
        self.interpreter = PoseInterpreter(tuning: tuning)
        self.coach = FormCoach(tuning: tuning)
        self.counter = RepCounter(tuning: tuning)
    }

    public var reps: [CountedRep] { counter.reps }
    public var count: Int { counter.count }

    @discardableResult
    public func process(_ frame: PoseFrame) -> Output {
        let before = counter.count
        counter.process(interpreter.signal(from: frame))

        // A replay can land more than one rep at once; the newest is the one
        // worth celebrating, and the count carries the rest.
        let newRep = counter.count > before ? counter.reps.last : nil
        let hint = newRep.flatMap { coach.hint(for: $0) }
        return Output(rep: newRep, hint: hint,
                      totalReps: counter.count, thresholds: counter.thresholds)
    }

    public func reset() {
        counter.reset()
        interpreter = PoseInterpreter()
        coach = FormCoach()
    }
}
