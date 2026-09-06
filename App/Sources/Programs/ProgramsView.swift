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
                VStack(spacing: 22) {
                    if let suggestion = misfit, let active = store.activeProgram {
                        misfitCard(active: active, suggestion: suggestion)
                    }
                    if let program = store.activeProgram, let enrollment = store.enrollment {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHeader("Your program")
                            activeCard(program: program, enrollment: enrollment)
                        }
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        SectionHeader("All programs", detail: "\(ProgramLibrary.all.count)")
                        VStack(spacing: 0) {
                            ForEach(Array(ProgramLibrary.all.enumerated()), id: \.element.id) { pair in
                                if pair.offset > 0 {
                                    Rectangle().fill(Push.Palette.stroke)
                                        .frame(height: 1).padding(.leading, 18)
                                }
                                Button { selected = pair.element } label: {
                                    programRow(pair.element,
                                               isActive: pair.element.slug == store.enrollment?.programSlug,
                                               isRecommended: pair.element.slug == recommended?.slug)
                                }
                                .buttonStyle(PushPressStyle())
                            }
                        }
                        .pushCard(padding: 0)
                    }
                }
                .padding(.horizontal, Push.Metrics.gutter)
                .padding(.top, 4)
                .padding(.bottom, 28)
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
        let outgrown = ProgramFit.evaluate(program: active, bestSet: store.records.bestSet) == .outgrown
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                SymbolBadge(outgrown ? "arrow.up.forward" : "exclamationmark.triangle.fill",
                            diameter: 36,
                            tint: outgrown ? Push.Palette.accent : Push.Palette.flame)
                Text(outgrown ? "You've outgrown this one" : "This one's a stretch")
                    .font(Push.Typography.title)
                    .foregroundStyle(Push.Palette.textPrimary)
            }
            Text("Your best set is \(store.records.bestSet). \(active.title) tops out at \(active.peakSet). \(suggestion.title) fits what you can actually do.")
                .font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            PrimaryButton("Switch to \(suggestion.title)") { selected = suggestion }
        }
        .pushCard()
    }

    private func activeCard(program: Program, enrollment: ProgramEnrollment) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(program.title).font(Push.Typography.title)
                    .foregroundStyle(Push.Palette.textPrimary)
                Spacer(minLength: 8)
                PushTag("In progress", systemImage: "circle.fill")
            }
            ProgressView(value: Double(enrollment.currentDayIndex),
                         total: Double(max(program.dayCount, 1)))
                .tint(Push.Palette.accent)
            HStack {
                Text("Day \(min(enrollment.currentDayIndex + 1, program.dayCount)) of \(program.dayCount)")
                    .font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textTertiary)
                Spacer()
                if enrollment.adaptationOffset != 0 {
                    // Visible on purpose: silent difficulty changes read as bugs.
                    Text(enrollment.adaptationOffset > 0 ? "Adjusted up" : "Adjusted down")
                        .font(Push.Typography.caption)
                        .foregroundStyle(Push.Palette.textTertiary)
                }
            }
        }
        .pushCard()
    }

    private func programRow(_ program: Program, isActive: Bool, isRecommended: Bool) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(program.title).font(Push.Typography.headline)
                        .foregroundStyle(Push.Palette.textPrimary)
                    if isRecommended && !isActive {
                        PushTag("Recommended", systemImage: "sparkles")
                    }
                }
                Text(program.summary).font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
                    .multilineTextAlignment(.leading)
                // The two numbers that decide whether a programme is for you,
                // rather than making you open it to find out.
                Text("\(program.dayCount) days · builds to \(program.peakSet) in a set")
                    .font(Push.Typography.micro)
                    .foregroundStyle(Push.Palette.textTertiary)
            }
            Spacer(minLength: 0)
            Image(systemName: isActive ? "checkmark.circle.fill" : "chevron.right")
                .font(.system(size: isActive ? 17 : 13, weight: .semibold))
                .foregroundStyle(isActive ? Push.Palette.accent : Push.Palette.textTertiary)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 15)
        .contentShape(Rectangle())
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
                VStack(alignment: .leading, spacing: 20) {
                    Text(program.summary)
                        .font(Push.Typography.body)
                        .foregroundStyle(Push.Palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    MetricStrip([
                        .init("\(program.dayCount)", "Days"),
                        .init("\(program.peakSet)", "Peak set"),
                        .init("\(program.days.filter(\.isRecoveryDay).count)", "Rest days"),
                    ])
                    .pushCard()

                    if fit != .good {
                        HStack(spacing: 10) {
                            Image(systemName: "info.circle.fill")
                                .font(.system(size: 14, weight: .semibold))
                            Text(fit == .outgrown
                                 ? "You can already do this program's final target in one set."
                                 : "Day one of this asks for more than your best set so far.")
                                .font(Push.Typography.caption)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                        .foregroundStyle(Push.Palette.flame)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        SectionHeader("The first week")
                        VStack(spacing: 0) {
                            ForEach(Array(program.days.prefix(7).enumerated()), id: \.element.id) { pair in
                                if pair.offset > 0 {
                                    Rectangle().fill(Push.Palette.stroke)
                                        .frame(height: 1).padding(.leading, 16)
                                }
                                HStack {
                                    Text("Day \(pair.element.dayIndex + 1)")
                                        .font(Push.Typography.caption)
                                        .foregroundStyle(Push.Palette.textTertiary)
                                        .frame(width: 56, alignment: .leading)
                                    Text(pair.element.summary)
                                        .font(Push.Typography.body)
                                        .foregroundStyle(pair.element.isRecoveryDay ? Push.Palette.textTertiary : Push.Palette.textPrimary)
                                    Spacer()
                                    if !pair.element.isRecoveryDay {
                                        Text("\(pair.element.totalReps)")
                                            .font(Push.Typography.stat(15))
                                            .foregroundStyle(Push.Palette.textSecondary)
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                            }
                        }
                        .pushCard(padding: 0)
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
