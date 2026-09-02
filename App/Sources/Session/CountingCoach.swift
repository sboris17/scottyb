import RepEngine

/// Turns the engine's internal state into one sentence a person can act on.
///
/// The raw numbers are precise but they need decoding, and nobody decodes
/// anything mid-plank. Every case below names what is wrong *and* what to
/// change, because "no body travel" is not an instruction.
enum CountingCoach {
    static func advice(for d: RepDiagnostics, countedReps: Int) -> String? {
        guard countedReps == 0 else { return nil }

        // Judge visibility over the whole session rather than the single
        // frame that happened to be current. Tracking blinks constantly, and
        // one dropped frame is not a reason to tell someone to move.
        if d.usableFrameFraction < 0.5 {
            if d.jointConfidence < 0.1 {
                return "Can't see you at all. Move back so your whole body is in frame."
            }
            return "Only half seeing you. More light, or a plainer background behind you."
        }

        // Nothing ever got as far as being judged, so the arm never appeared
        // to bend far enough. Almost always the camera is looking at you
        // head-on, where the elbow is foreshortened and its angle barely
        // changes however deep you go.
        if d.candidateReps == 0 {
            if d.angleSpanSeen < 25 {
                return "Point the camera at your side, not your head. It needs to see your elbow bend from the side."
            }
            return "Nearly there — try going a little lower."
        }

        // Movement was seen and judged. Name the guard that rejected it.
        switch d.lastRejection {
        case .noBodyTravel:
            return "Seeing your arms bend but not your body drop. Move the phone round to your side."
        case .uncorrelated:
            return "Your body and arms aren't moving together. Check the phone can see your hip."
        case .notSmooth:
            return "Tracking is jumpy. More light, or a plainer background, will help."
        case .tooFast:
            return "Counting those as bounces. Slow the reps down a touch."
        case .tooSlow:
            return "Taking too long between the top and the bottom."
        case .lostPose:
            return "Losing sight of you mid-rep. Move back so all of you is in frame."
        case .none:
            return nil
        }
    }
}
