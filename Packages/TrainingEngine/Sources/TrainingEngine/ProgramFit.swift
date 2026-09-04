import Foundation

/// Whether the program somebody is on still matches what they can do.
///
/// This exists because of a real failure. Somebody enrolled in "First 10" -
/// the programme for people who cannot do a single push-up - and then went on
/// to record a set of 28. The app had that number, printed it on two different
/// screens, and carried on prescribing sets of three for a week. The
/// programme is chosen once during onboarding, from a number typed before you
/// have done anything, and nothing ever revisits it.
///
/// Every session is evidence. This is the part that reads it.
public enum ProgramFit: Equatable {
    /// The programme still asks for something.
    case good

    /// You can already do its finishing target in one set. Finishing it would
    /// take weeks and teach you nothing.
    case outgrown

    /// Day one is beyond you, which is the fastest way to quit. Worth catching
    /// because the cost is asymmetric: too easy is boring, too hard is over.
    case tooHard

    /// Reads the fit from the one number that is hard to argue with - the
    /// biggest set actually completed.
    ///
    /// `bestSet` of zero means nothing has been recorded yet, and a judgement
    /// on no evidence is worse than none at all.
    public static func evaluate(program: Program, bestSet: Int) -> ProgramFit {
        guard bestSet > 0 else { return .good }
        if bestSet >= program.peakSet { return .outgrown }

        let firstRealDay = program.days.first { !$0.isRecoveryDay && !$0.sets.isEmpty }
        if let hardestOpeningSet = firstRealDay?.sets.map(\.targetReps).max(),
           hardestOpeningSet > bestSet {
            return .tooHard
        }
        return .good
    }

    /// The programme to move to, or nil when the current one is fine or when
    /// the obvious answer is the one already in use.
    public static func suggestion(current: Program, bestSet: Int) -> Program? {
        guard evaluate(program: current, bestSet: bestSet) != .good else { return nil }
        let better = ProgramRecommender.recommend(maxReps: bestSet)
        return better.slug == current.slug ? nil : better
    }
}
