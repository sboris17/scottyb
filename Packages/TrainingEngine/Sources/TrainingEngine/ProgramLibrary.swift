import Foundation

/// The built-in programs.
///
/// Generated from a shape rather than hand-authored day by day: a "Road to
/// 100" written out longhand is 300+ numbers nobody will ever re-tune, and the
/// tests can assert properties of a generator (it progresses, it rests, it
/// arrives) that a wall of literals would only assert by transcription.
public enum ProgramLibrary {
    public static let all: [Program] = [
        firstTen, roadTo(25), roadTo(50), roadTo(100), dailyPush,
    ]

    public static func program(slug: String) -> Program? {
        all.first { $0.slug == slug }
    }

    // MARK: - First 10

    public static var firstTen: Program {
        var days: [ProgramDay] = []
        // Starts from knee push-ups territory: five sets of two is achievable
        // on day one for somebody who cannot do a single full rep, and the
        // whole point of this program is that day one is never demoralising.
        let ladder: [[Int]] = [
            [2, 2, 2], [2, 3, 2], [3, 3, 3], [3, 4, 3], [4, 4, 4],
            [4, 5, 4], [5, 5, 5], [5, 6, 5], [6, 6, 6], [6, 7, 6],
            [7, 7, 7], [7, 8, 7], [8, 8, 8], [8, 9, 8], [9, 9, 9],
            [9, 10, 9], [10, 10, 10],
        ]
        for (i, sets) in ladder.enumerated() {
            let index = days.count
            days.append(ProgramDay(dayIndex: index,
                                   sets: sets.map { SetPrescription(targetReps: $0, restSeconds: 60) }))
            // Every third training day is a recovery day. Recovery days keep
            // the streak alive, which is what stops rest from feeling like
            // failure.
            if i % 3 == 2 {
                days.append(ProgramDay(dayIndex: days.count, sets: [], isRecoveryDay: true,
                                       note: "Rest up. Your streak keeps going."))
            }
        }
        return Program(slug: "first-10", title: "First 10",
                       summary: "Build from your first push-up to 10 in a row.",
                       days: days)
    }

    // MARK: - Road to N

    public static func roadTo(_ target: Int) -> Program {
        // Weeks scale with the target: reaching 100 unbroken reps is a
        // different order of task from reaching 25.
        let weeks = target <= 25 ? 6 : (target <= 50 ? 8 : 12)
        let trainingDays = weeks * 4
        var days: [ProgramDay] = []
        var trained = 0

        while trained < trainingDays {
            let progress = Double(trained) / Double(max(trainingDays - 1, 1))
            // Ease-out: early sessions add volume quickly while it is cheap,
            // late sessions creep, because that is where reps get expensive.
            let eased = 1 - pow(1 - progress, 1.7)
            let peak = max(3, Int((Double(target) * (0.25 + 0.75 * eased)).rounded()))
            let setCount = progress < 0.5 ? 5 : 4

            var sets: [SetPrescription] = []
            for setIndex in 0..<setCount {
                // Descending sets: the first is the honest effort, the rest
                // bank volume without wrecking the next day.
                let factor = setIndex == 0 ? 1.0 : max(0.55, 1.0 - 0.15 * Double(setIndex))
                sets.append(SetPrescription(targetReps: max(2, Int((Double(peak) * factor).rounded())),
                                            restSeconds: progress < 0.5 ? 60 : 90))
            }
            days.append(ProgramDay(dayIndex: days.count, sets: sets))
            trained += 1

            if trained % 4 == 0 && trained < trainingDays {
                days.append(ProgramDay(dayIndex: days.count, sets: [], isRecoveryDay: true,
                                       note: "Recovery day. Streak safe."))
            }
        }

        // The program has to actually arrive at its promise.
        days.append(ProgramDay(dayIndex: days.count,
                               sets: [SetPrescription(targetReps: target, restSeconds: 0)],
                               note: "Test day. One set, all the way to \(target)."))

        return Program(slug: "road-to-\(target)", title: "Road to \(target)",
                       summary: "Reach \(target) consecutive push-ups in \(weeks) weeks.",
                       days: days)
    }

    // MARK: - Daily Push

    public static var dailyPush: Program {
        // Habit first, volume second. Every day is small enough that "I don't
        // have time" is never true.
        let days = (0..<30).map { index -> ProgramDay in
            let base = 10 + (index / 5) * 5
            return ProgramDay(dayIndex: index,
                              sets: [SetPrescription(targetReps: base, restSeconds: 45),
                                     SetPrescription(targetReps: max(5, base - 5), restSeconds: 45)],
                              note: index == 0 ? "One month. Every day." : nil)
        }
        return Program(slug: "daily-push", title: "Daily Push",
                       summary: "Thirty days, every day, in under five minutes.",
                       days: days)
    }
}
