import Foundation

public struct SetPrescription: Sendable, Equatable, Codable {
    public var targetReps: Int
    public var restSeconds: Int

    public init(targetReps: Int, restSeconds: Int = 60) {
        self.targetReps = targetReps
        self.restSeconds = restSeconds
    }
}

public struct ProgramDay: Sendable, Equatable, Codable, Identifiable {
    public var id: Int { dayIndex }
    public var dayIndex: Int
    public var sets: [SetPrescription]
    public var isRecoveryDay: Bool
    public var note: String?

    public init(dayIndex: Int, sets: [SetPrescription], isRecoveryDay: Bool = false, note: String? = nil) {
        self.dayIndex = dayIndex
        self.sets = sets
        self.isRecoveryDay = isRecoveryDay
        self.note = note
    }

    public var totalReps: Int { sets.reduce(0) { $0 + $1.targetReps } }

    public var summary: String {
        if isRecoveryDay { return "Recovery" }
        let counts = sets.map(\.targetReps)
        if let first = counts.first, counts.allSatisfy({ $0 == first }) {
            return "\(counts.count) x \(first)"
        }
        return counts.map(String.init).joined(separator: " / ")
    }
}

public struct Program: Sendable, Equatable, Identifiable {
    public var id: String { slug }
    public var slug: String
    public var title: String
    public var summary: String
    public var days: [ProgramDay]

    public var dayCount: Int { days.count }
    public var peakSet: Int { days.flatMap(\.sets).map(\.targetReps).max() ?? 0 }

    public func day(at index: Int) -> ProgramDay? {
        days.first { $0.dayIndex == index }
    }
}
