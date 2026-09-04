import Foundation
import Observation
import RepEngine
import PushCore
import PushUI
import TrainingEngine

/// Drives one workout: sets, rest, counting, and the fallbacks that keep the
/// camera from ever being a dead end.
@Observable
final class SessionModel {
    enum Phase: Equatable {
        case framing            // lining the phone up, nothing counted yet
        case counting(setIndex: Int)
        case resting(nextSetIndex: Int, endsAt: Date)
        case finished
    }

    enum Mode: Equatable {
        case camera, manual
    }

    // MARK: - Configuration

    let prescription: [SetPrescription]
    let source: SessionSource
    let programSlug: String?
    let programDayIndex: Int?

    // MARK: - Observable state

    private(set) var phase: Phase = .framing
    private(set) var mode: Mode = .camera
    private(set) var repsThisSet = 0
    private(set) var completedSets: [Int] = []
    private(set) var samples: [[CountedRep]] = []
    private(set) var framingIssue: FramingIssue?
    private(set) var currentHint: FormHint?
    private(set) var startedAt = Date()
    private(set) var restRemaining: TimeInterval = 0

    /// Live engine internals for the debug overlay. Never used for counting.
    private(set) var diagnostics = RepDiagnostics()
    private(set) var frameRate: Double = 0

    /// Latest pose, purely so the skeleton overlay can be drawn. Never used
    /// for counting.
    private(set) var lastFrame: PoseFrame?

    /// Diagnostics captured when a set ends having counted nothing, so the
    /// summary can explain itself once the phone is back in your hand.
    private(set) var failureDiagnostics: RepDiagnostics?

    /// Captures the set for replay when the recording switch is on.
    ///
    /// Held here rather than in the view because it has to see every frame,
    /// including the ones the counter rejects - a clip that only contained
    /// frames the engine already liked would be useless for finding out why it
    /// dislikes the others.
    let recorder = PoseRecorder()
    var isRecording = UserDefaults.standard.bool(forKey: "recordPoseData")

    private var countingStartedAt: Date?
    private var lastSpokenAdviceAt: Date?
    private var spokenAdviceCount = 0

    func updateFrameRate(_ rate: Double) { frameRate = rate }

    /// Which rotation the detector settled on, and how confident it was.
    /// Shown rather than trusted: the whole point of measuring it is that the
    /// previous hard-coded answer looked reasonable and was costing frames.
    private var hasAnnouncedTracking = false

    private(set) var orientationLabel = "measuring"
    func updateOrientation(_ label: String) { orientationLabel = label }

    /// Set when pose has been unusable long enough that we should stop asking
    /// the user to fix framing and just offer the manual path.
    private(set) var shouldOfferManual = false

    // MARK: - Internals

    private var engine = RepEngine()
    private let framingCheck = FramingCheck()
    private var lastConfidentFrame: Date?
    private var restTimer: Timer?

    /// Called after every completed set so the workout survives being
    /// interrupted, and once more when the session ends so the draft is
    /// cleared rather than offered back to the user.
    var onCheckpoint: ((SessionDraft) -> Void)?
    var onSessionEnded: (() -> Void)?

    /// How long pose can be unusable before we stop nagging and offer manual.
    private let manualFallbackAfter: TimeInterval = 5

    init(prescription: [SetPrescription],
         source: SessionSource = .justPush,
         programSlug: String? = nil,
         programDayIndex: Int? = nil,
         resuming draft: SessionDraft? = nil) {
        // "Just Push" has no prescription: one open-ended set.
        self.prescription = prescription.isEmpty ? [SetPrescription(targetReps: 0, restSeconds: 0)] : prescription
        self.source = source
        self.programSlug = programSlug
        self.programDayIndex = programDayIndex
        self.samples = Array(repeating: [], count: self.prescription.count)

        if let draft {
            // Those reps happened. Pick up from the set after the last one
            // that was banked rather than starting the workout over.
            completedSets = Array(draft.completedSets.prefix(self.prescription.count))
            startedAt = draft.startedAt
        }
    }

    /// Builds the resume snapshot from wherever the session currently is.
    private var draft: SessionDraft {
        SessionDraft(startedAt: startedAt,
                     source: source,
                     countingMode: mode == .camera ? .camera : .manual,
                     programSlug: programSlug,
                     programDayIndex: programDayIndex,
                     targets: prescription.map(\.targetReps),
                     restSeconds: prescription.map(\.restSeconds),
                     completedSets: completedSets)
    }

    // MARK: - Derived

    var currentSetIndex: Int {
        switch phase {
        case .counting(let index): return index
        case .resting(let next, _): return next
        case .framing: return 0
        case .finished: return max(prescription.count - 1, 0)
        }
    }

    var currentTarget: Int? {
        let target = prescription[min(currentSetIndex, prescription.count - 1)].targetReps
        return target > 0 ? target : nil
    }

    var totalReps: Int { completedSets.reduce(0, +) + repsThisSet }

    var isOpenEnded: Bool { currentTarget == nil }

    var setProgress: Double {
        guard let target = currentTarget, target > 0 else { return 0 }
        return min(1, Double(repsThisSet) / Double(target))
    }

    var isLastSet: Bool { currentSetIndex >= prescription.count - 1 }

    // MARK: - Lifecycle

    func begin(mode: Mode) {
        self.mode = mode
        startedAt = Date()
        Feedback.shared.prepare()
        // Resuming starts at the set after the last one banked.
        if isRecording { recorder.reset() }
        let first = min(completedSets.count, prescription.count - 1)
        phase = .counting(setIndex: first)
        repsThisSet = 0
        countingStartedAt = Date()
        engine.reset()
        // Says the set has started without the screen having to be read. On
        // the camera path this is also the last cue before a silence that,
        // until now, was indistinguishable from the app not working.
        Feedback.shared.setBeginning(first + 1)
    }

    func switchToManual() {
        mode = .manual
        shouldOfferManual = false
        framingIssue = nil
        if case .framing = phase { phase = .counting(setIndex: 0) }
    }

    // MARK: - Camera path

    func ingest(_ frame: PoseFrame) {
        guard mode == .camera else { return }
        lastFrame = frame
        // Before the framing guard and before the counter: the whole value of
        // a recording is that it contains what actually arrived, not what
        // survived.
        if isRecording { recorder.record(frame) }

        if case .framing = phase {
            framingIssue = framingCheck.evaluate(frame)
            return
        }
        guard case .counting = phase else { return }

        let output = engine.process(frame)
        diagnostics = output.diagnostics
        announceTrackingOnce()
        speakAdviceIfStuck()
        trackConfidence(for: frame)

        // A replay can land more than one rep in a single frame. Stop as soon
        // as the set completes, or the overflow gets credited to the next set.
        let newReps = output.totalReps - repsThisSet
        if newReps > 0 {
            for _ in 0..<newReps {
                guard case .counting = phase else { break }
                registerRep()
            }
            currentHint = output.hint
        }
    }

    /// One spoken verdict on whether the app can actually see you, a few
    /// seconds in.
    ///
    /// Until now the first word after "go" came twelve seconds later and only
    /// if nothing had counted, so a set could be most of the way through
    /// before there was any sign either way. The person is on the floor and
    /// cannot read the screen, so silence is indistinguishable from failure -
    /// and after enough failures they stop and get up to check, which is worse
    /// than being told.
    ///
    /// Four seconds is enough frames to be sure, and early enough to fix the
    /// placement without having wasted the set.
    private func announceTrackingOnce() {
        guard case .counting = phase, !hasAnnouncedTracking else { return }
        let started = countingStartedAt ?? Date()
        if countingStartedAt == nil { countingStartedAt = started }
        guard Date().timeIntervalSince(started) > 4 else { return }
        guard diagnostics.usableFrames + diagnostics.unusableFrames >= 20 else { return }
        hasAnnouncedTracking = true

        if diagnostics.usableFrameFraction >= 0.7 {
            // Deliberately said even when reps are already counting: it costs
            // three words and it is the confirmation that stops someone
            // breaking their set to go and look at the screen.
            Feedback.shared.speak("Got you.")
        } else if let advice = CountingCoach.advice(for: diagnostics, countedReps: repsThisSet) {
            lastSpokenAdviceAt = Date()
            spokenAdviceCount += 1
            Feedback.shared.speak(advice)
        } else {
            Feedback.shared.speak("Only partly seeing you. More light, or move the phone closer.")
        }
    }

    /// Says the advice out loud when nothing is being counted.
    ///
    /// The phone sits several feet away where the screen cannot be read, so
    /// on-screen diagnostics are no use to the person actually doing the
    /// push-ups. Rationed hard: three times at most, well spaced, and never
    /// once a rep has been counted.
    private func speakAdviceIfStuck() {
        guard case .counting = phase, repsThisSet == 0, spokenAdviceCount < 3 else { return }
        let started = countingStartedAt ?? Date()
        if countingStartedAt == nil { countingStartedAt = started }
        guard Date().timeIntervalSince(started) > 12 else { return }
        if let last = lastSpokenAdviceAt, Date().timeIntervalSince(last) < 20 { return }
        guard let advice = CountingCoach.advice(for: diagnostics, countedReps: repsThisSet) else { return }
        lastSpokenAdviceAt = Date()
        spokenAdviceCount += 1
        Feedback.shared.speak(advice)
    }

    /// If pose stays unusable, surface a one-tap manual path rather than
    /// leaving the user staring at a counter that will not move.
    private func trackConfidence(for frame: PoseFrame) {
        let issue = framingCheck.evaluate(frame)
        framingIssue = issue
        let usable = issue == nil
        if usable {
            lastConfidentFrame = Date()
            shouldOfferManual = false
        } else if let last = lastConfidentFrame {
            shouldOfferManual = Date().timeIntervalSince(last) > manualFallbackAfter
        } else {
            lastConfidentFrame = Date()
        }
    }

    // MARK: - Counting

    func addManualRep() {
        guard mode == .manual || isOpenEnded else { return }
        registerRep()
    }

    func removeManualRep() {
        guard repsThisSet > 0 else { return }
        repsThisSet -= 1
    }

    private func registerRep() {
        repsThisSet += 1
        Feedback.shared.repCounted(totalReps)

        if let target = currentTarget, repsThisSet >= target {
            completeSet()
        }
    }

    // MARK: - Set flow

    /// Reaching the target advances automatically. The user is on the floor;
    /// making them reach for the phone between sets is the friction this whole
    /// product exists to remove.
    func completeSet() {
        guard case .counting(let index) = phase else { return }
        completedSets.append(repsThisSet)
        samples[min(index, samples.count - 1)] = engine.reps
        onCheckpoint?(draft)
        let counted = completedSets[completedSets.count - 1]
        repsThisSet = 0
        engine.reset()
        hasAnnouncedTracking = false
        countingStartedAt = Date()

        let next = index + 1
        guard next < prescription.count else {
            Feedback.shared.setComplete(reps: counted)
            finish()
            return
        }
        let rest = TimeInterval(prescription[index].restSeconds)
        guard rest > 0 else {
            Feedback.shared.setComplete(reps: counted)
            phase = .counting(setIndex: next)
            Feedback.shared.setBeginning(next + 1)
            return
        }
        Feedback.shared.setComplete(reps: counted, restSeconds: prescription[index].restSeconds)
        startRest(seconds: rest, nextSetIndex: next)
    }

    private func startRest(seconds: TimeInterval, nextSetIndex: Int) {
        let endsAt = Date().addingTimeInterval(seconds)
        phase = .resting(nextSetIndex: nextSetIndex, endsAt: endsAt)
        restRemaining = seconds
        restTimer?.invalidate()
        restTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
            guard let self else { return }
            let remaining = endsAt.timeIntervalSinceNow
            self.restRemaining = max(0, remaining)
            if remaining <= 0 { self.skipRest() }
        }
    }

    func skipRest() {
        guard case .resting(let next, _) = phase else { return }
        restTimer?.invalidate()
        restTimer = nil
        phase = .counting(setIndex: next)
        Feedback.shared.setBeginning(next + 1)
    }

    func finish() {
        restTimer?.invalidate()
        restTimer = nil
        if repsThisSet > 0 {
            completedSets.append(repsThisSet)
            repsThisSet = 0
        }
        // Capture why nothing was counted, while the engine still knows.
        if completedSets.allSatisfy({ $0 == 0 }) && mode == .camera {
            failureDiagnostics = diagnostics
        }
        onSessionEnded?()
        phase = .finished
    }

    // MARK: - Result

    func result() -> SessionResult {
        SessionResult(
            startedAt: startedAt,
            endedAt: Date(),
            source: source,
            countingMode: mode == .camera ? .camera : .manual,
            programSlug: programSlug,
            programDayIndex: programDayIndex,
            // Sets the user never reached are recorded as zero rather than
            // dropped, so deliberately stopping early feeds the adaptation
            // engine as "this was too much". That is the safer of the two
            // errors: prescribing too little self-corrects the moment they
            // beat a target, prescribing too much is what makes people quit.
            // Interruptions do not come through here -- they are resumed or
            // banked from the draft, which only ever reports sets completed.
            setResults: zip(prescription, completedSets + Array(repeating: 0, count: max(0, prescription.count - completedSets.count)))
                .map { SetResult(targetReps: $0.targetReps, completedReps: $1) },
            reps: samples.flatMap { $0 },
            formScore: FormCoach.sessionScore(samples.flatMap { $0 }),
            failureDiagnostics: failureDiagnostics
        )
    }
}

struct SessionResult {
    var startedAt: Date
    var endedAt: Date
    var source: SessionSource
    var countingMode: CountingMode
    var programSlug: String?
    var programDayIndex: Int?
    var setResults: [SetResult]
    var reps: [CountedRep]
    var formScore: Double?
    /// Present only when the camera counted nothing, so the summary can say
    /// why instead of showing a bare zero.
    var failureDiagnostics: RepDiagnostics? = nil

    var totalReps: Int { setResults.reduce(0) { $0 + $1.completedReps } }
    var bestSet: Int { setResults.map(\.completedReps).max() ?? 0 }
}
