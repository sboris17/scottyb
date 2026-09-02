import SwiftUI
import PushUI
import PushCore
import TrainingEngine

struct ProgramsView: View {
    @Environment(Store.self) private var store
    @State private var selected: Program?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Push.Metrics.gutter) {
                    if let program = store.activeProgram, let enrollment = store.enrollment {
                        activeCard(program: program, enrollment: enrollment)
                    }
                    ForEach(ProgramLibrary.all) { program in
                        Button { selected = program } label: {
                            programCard(program, isActive: program.slug == store.enrollment?.programSlug)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(Push.Metrics.gutter)
            }
            .background(Push.Palette.background)
            .navigationTitle("Programs")
            .sheet(item: $selected) { program in
                ProgramDetailView(program: program) {
                    store.enroll(in: program)
                    selected = nil
                }
            }
        }
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

    private func programCard(_ program: Program, isActive: Bool) -> some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(program.title).font(Push.Typography.headline)
                    .foregroundStyle(Push.Palette.textPrimary)
                Text(program.summary).font(Push.Typography.caption)
                    .foregroundStyle(Push.Palette.textSecondary)
                    .multilineTextAlignment(.leading)
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
    let onStart: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Push.Metrics.gutter) {
                    Text(program.summary)
                        .font(Push.Typography.body)
                        .foregroundStyle(Push.Palette.textSecondary)

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
