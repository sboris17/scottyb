import SwiftUI
import PushUI
import PushCore
import TrainingEngine

struct ProgramsView: View {
    @Environment(Store.self) private var store
    @State private var selected: Program?
    @State private var switching: Program?

    /// What the app would pick knowing what it knows now, rather than what was
    /// typed during onboarding before anything had happened.
    private var recommended: Program? {
        guard store.records.bestSet > 0 else { return nil }
        return ProgramRecommender.recommend(maxReps: store.records.bestSet)
    }

    private var misfit: Program? {
        guard let active = store.activeProgram else { return nil }
        return ProgramFit.suggestion(current: active, bestSet: store.records.bestSet)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Push.Metrics.gutter) {
                    if let suggestion = misfit, let active = store.activeProgram {
                        misfitCard(active: active, suggestion: suggestion)
                    }
                    if let program = store.activeProgram, let enrollment = store.enrollment {
                        activeCard(program: program, enrollment: enrollment)
                    }
                    ForEach(ProgramLibrary.all) { program in
                        Button { selected = program } label: {
                            programCard(program,
                                        isActive: program.slug == store.enrollment?.programSlug,
                                        isRecommended: program.slug == recommended?.slug)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(Push.Metrics.gutter)
            }
            .background(Push.Palette.background)
            .navigationTitle("Programs")
            .sheet(item: $selected) { program in
                ProgramDetailView(program: program,
                                  fit: ProgramFit.evaluate(program: program,
                                                           bestSet: store.records.bestSet)) {
                    selected = nil
                    // Switching wipes the days already completed. Doing that
                    // on a single tap, silently, is how somebody loses three
                    // weeks and blames the app.
                    if let enrollment = store.enrollment,
                       enrollment.programSlug != program.slug,
                       !enrollment.completedDayIndices.isEmpty {
                        switching = program
                    } else {
                        store.enroll(in: program)
                    }
                }
            }
            .alert("Start \(switching?.title ?? "")?",
                   isPresented: Binding(get: { switching != nil },
                                        set: { if !$0 { switching = nil } })) {
                Button("Switch", role: .destructive) {
                    if let program = switching { store.enroll(in: program) }
                    switching = nil
                }
                Button("Cancel", role: .cancel) { switching = nil }
            } message: {
                Text(switchWarning)
            }
        }
    }

    private var switchWarning: String {
        let done = store.enrollment?.completedDayIndices.count ?? 0
        let from = store.activeProgram?.title ?? "your program"
        return "You're \(done) day\(done == 1 ? "" : "s") into \(from). Switching starts the new one from day one. Your workout history and streak are untouched."
    }

    /// Says the thing the app previously knew and never mentioned.
    private func misfitCard(active: Program, suggestion: Program) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(ProgramFit.evaluate(program: active, bestSet: store.records.bestSet) == .outgrown
                 ? "YOU'VE OUTGROWN THIS"
                 : "THIS ONE'S A STRETCH")
                .font(Push.Typography.caption).tracking(2)
                .foregroundStyle(Push.Palette.accent)
            Text("Your best set is \(store.records.bestSet). \(active.title) tops out at \(active.peakSet).")
                .font(Push.Typography.headline)
                .foregroundStyle(Push.Palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text("\(suggestion.title) fits what you can actually do.")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
            PrimaryButton("Switch to \(suggestion.title)") { selected = suggestion }
        }
        .pushCard()
    }

    private func activeCard(program: Program, enrollment: ProgramEnrollment) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("IN PROGRESS")
                .font(Push.Typography.caption).tracking(2)
                .foregroundStyle(Push.Palette.accent)
            Text(program.title).font(Push.Typography.title)
                .foregroundStyle(Push.Palette.textPrimary)
            ProgressView(value: Double(enrollment.currentDayIndex),
                         total: Double(max(program.dayCount, 1)))
                .tint(Push.Palette.accent)
            Text("Day \(min(enrollment.currentDayIndex + 1, program.dayCount)) of \(program.dayCount)")
                .font(Push.Typography.caption)
                .foregroundStyle(Push.Palette.textSecondary)
            if enrollment.adaptationOffset != 0 {
                // Visible on purpose: silent difficulty changes read as bugs.
                Text(enrollment.adaptationOffset > 0
                     ? "Adjusted up \u{2014} you've been beating the targets."
                     : "Adjusted down \u{2014} keeping the sets finishable.")
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
            }
        }
        .pushCard()
    }

    private func programCard(_ program: Program, isActive: Bool, isRecommended: Bool) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                if isRecommended && !isActive {
                    Text("RECOMMENDED FOR YOU")
                        .font(Push.Typography.caption).tracking(1.5)
                        .foregroundStyle(Push.Palette.accent)
                }
                Text(program.title).font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textPrimary)
                Text(program.summary).font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
                    .multilineTextAlignment(.leading)
                // The two numbers that decide whether a programme is for you,
                // rather than making you open it to find out.
                Text("\(program.dayCount) days · builds to \(program.peakSet) in a set")
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary.opacity(0.7))
            }
            Spacer()
            if isActive {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(Push.Palette.accent)
            } else {
                Image(systemName: "chevron.right").foregroundStyle(Push.Palette.textSecondary)
            }
        }
        .pushCard()
    }
}

struct ProgramDetailView: View {
    let program: Program
    var fit: ProgramFit = .good
    let onStart: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Push.Metrics.gutter) {
                    Text(program.summary)
                        .font(Push.Typography.body)
                        .foregroundStyle(Push.Palette.textSecondary)

                    if fit != .good {
                        Text(fit == .outgrown
                             ? "You can already do this program's final target in one set."
                             : "Day one of this asks for more than your best set so far.")
                            .font(Push.Typography.caption)
                            .foregroundStyle(Push.Palette.flame)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    HStack(spacing: 10) {
                        StatChip(emoji: "\u{1F4C5}", value: "\(program.dayCount)", caption: "Days")
                        StatChip(emoji: "\u{1F3AF}", value: "\(program.peakSet)", caption: "Peak set")
                        StatChip(emoji: "\u{1F634}",
                                 value: "\(program.days.filter(\.isRecoveryDay).count)",
                                 caption: "Rest days")
                    }

                    Text("The first week").font(Push.Typography.label)
                        .foregroundStyle(Push.Palette.textSecondary)

                    ForEach(program.days.prefix(7)) { day in
                        HStack {
                            Text("Day \(day.dayIndex + 1)")
                                .font(Push.Typography.caption)
                                .foregroundStyle(Push.Palette.textSecondary)
                                .frame(width: 60, alignment: .leading)
                            Text(day.summary)
                                .font(Push.Typography.headline)
                                .foregroundStyle(day.isRecoveryDay ? Push.Palette.textSecondary : Push.Palette.textPrimary)
                            Spacer()
                            if !day.isRecoveryDay {
                                Text("\(day.totalReps)")
                                    .font(Push.Typography.caption)
                                    .foregroundStyle(Push.Palette.textSecondary)
                            }
                        }
                        .padding(.vertical, 6)
                    }

                    PrimaryButton("Start this program", action: onStart)
                }
                .padding(Push.Metrics.gutter)
            }
            .background(Push.Palette.background)
            .navigationTitle(program.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
