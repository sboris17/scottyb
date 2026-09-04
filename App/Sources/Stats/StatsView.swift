import SwiftUI
import Charts
import PushUI
import PushCore

struct StatsView: View {
    @Environment(Store.self) private var store

    private var lastFourteenDays: [DayRecord] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        return (0..<14).reversed().compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: -offset, to: today) else { return nil }
            let existing = store.dayRecords.first { calendar.isDate($0.day, inSameDayAs: day) }
            return existing ?? DayRecord(day: day, totalReps: 0, goalTarget: store.profile.dailyGoal)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Push.Metrics.gutter) {
                    lifetimeCard
                    momentumCard
                    chartCard
                    weeklyCard
                    recordsCard
                    AchievementsGrid(unlocked: store.unlockedAchievements)
                }
                .padding(Push.Metrics.gutter)
            }
            .background(Push.Palette.background)
            .navigationTitle("Stats")
        }
    }

    private var lifetimeCard: some View {
        VStack(spacing: 6) {
            HeroCount(store.records.lifetimeTotal, label: "lifetime push-ups")
        }
        .pushCard()
    }

    // MARK: - Momentum

    private var calendar: Calendar { Calendar.current }

    private func total(daysAgo range: Range<Int>) -> Int {
        let today = calendar.startOfDay(for: Date())
        return store.dayRecords.filter { record in
            guard let days = calendar.dateComponents([.day],
                                                     from: calendar.startOfDay(for: record.day),
                                                     to: today).day else { return false }
            return range.contains(days)
        }.reduce(0) { $0 + $1.totalReps }
    }

    /// The question a lifetime total cannot answer: am I actually going up?
    ///
    /// Deliberately this week against last week rather than a rolling average.
    /// A rolling average is smoother and means less - nobody has ever felt
    /// anything about their 28-day mean.
    private var momentumCard: some View {
        let thisWeek = total(daysAgo: 0..<7)
        let lastWeek = total(daysAgo: 7..<14)
        let delta = thisWeek - lastWeek
        let sessions = store.sessionCount
        let average = sessions > 0 ? store.records.lifetimeTotal / sessions : 0

        return VStack(alignment: .leading, spacing: 12) {
            Text("Momentum").font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            HStack(spacing: 10) {
                StatChip(emoji: "\u{1F4C8}", value: "\(thisWeek)", caption: "This week")
                StatChip(emoji: "\u{1F4C6}", value: "\(lastWeek)", caption: "Last week")
                StatChip(emoji: "\u{1F501}", value: "\(sessions)", caption: "Sessions")
                StatChip(emoji: "\u{2696}\u{FE0F}", value: "\(average)", caption: "Per session")
            }
            if lastWeek > 0 || thisWeek > 0 {
                Text(momentumSentence(delta: delta, lastWeek: lastWeek))
                    .font(Push.Typography.caption)
                    .foregroundStyle(delta < 0 ? Push.Palette.textSecondary : Push.Palette.accent)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .pushCard()
    }

    /// Down weeks are stated plainly and without scolding. A training app that
    /// editorialises about a bad week is one people delete after a bad week.
    private func momentumSentence(delta: Int, lastWeek: Int) -> String {
        if lastWeek == 0 { return "First week of data. Next week gets a comparison." }
        if delta > 0 { return "Up \(delta) on last week." }
        if delta == 0 { return "Level with last week." }
        return "Down \(abs(delta)) on last week."
    }

    /// Twelve weeks, because a fortnight of bars cannot show a trend and this
    /// is the only place in the app that tries to.
    private var weeklyCard: some View {
        let weeks: [(start: Date, total: Int)] = (0..<12).reversed().compactMap { offset in
            guard let start = calendar.date(byAdding: .day, value: -7 * offset,
                                            to: calendar.startOfDay(for: Date())) else { return nil }
            return (start, total(daysAgo: (offset * 7)..<((offset + 1) * 7)))
        }
        return VStack(alignment: .leading, spacing: 12) {
            Text("Last 12 weeks").font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            Chart(weeks, id: \.start) { week in
                BarMark(x: .value("Week", week.start, unit: .weekOfYear),
                        y: .value("Reps", week.total))
                    .foregroundStyle(Push.Palette.accent.opacity(0.85))
                    .cornerRadius(4)
            }
            .chartYAxis { AxisMarks(position: .leading) }
            .chartXAxis { AxisMarks(values: .stride(by: .month)) }
            .frame(height: 140)
            .accessibilityLabel("Push-ups per week for the last twelve weeks")
        }
        .pushCard()
    }

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Last 14 days").font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            Chart {
                ForEach(lastFourteenDays, id: \.day) { record in
                    BarMark(
                        x: .value("Day", record.day, unit: .day),
                        y: .value("Reps", record.totalReps)
                    )
                    .foregroundStyle(record.qualifies ? Push.Palette.accent : Push.Palette.track)
                    .cornerRadius(4)
                }
                // Bars without the line they are judged against make a good day
                // and a bad day look the same.
                if store.profile.dailyGoal > 0 {
                    RuleMark(y: .value("Goal", store.profile.dailyGoal))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .foregroundStyle(Push.Palette.textSecondary)
                        .annotation(position: .top, alignment: .leading) {
                            Text("goal \(store.profile.dailyGoal)")
                                .font(Push.Typography.caption)
                                .foregroundStyle(Push.Palette.textSecondary)
                        }
                }
            }
            .chartYAxis { AxisMarks(position: .leading) }
            .chartXAxis { AxisMarks(values: .stride(by: .day, count: 3)) }
            .frame(height: 160)
            .accessibilityLabel("Daily push-ups for the last fourteen days")
        }
        .pushCard()
    }

    private var recordsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Records").font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            row("Best set", store.records.bestSet)
            row("Best day", store.records.bestDay)
            row("Best week", store.records.bestWeek)
            row("Best month", store.records.bestMonth)
            row("Longest streak", store.records.longestStreak, suffix: " days")
        }
        .pushCard()
    }

    private func row(_ title: String, _ value: Int, suffix: String = "") -> some View {
        HStack {
            Text(title).font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
            Spacer()
            Text("\(value)\(suffix)")
                .font(Push.Typography.stat(18))
                .foregroundStyle(Push.Palette.textPrimary)
        }
    }
}

struct AchievementsGrid: View {
    let unlocked: Set<String>

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Achievements").font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(AchievementCatalog.all) { achievement in
                    let isUnlocked = unlocked.contains(achievement.slug)
                    VStack(spacing: 6) {
                        Text(achievement.emoji)
                            .font(.system(size: 26))
                            .grayscale(isUnlocked ? 0 : 1)
                            .opacity(isUnlocked ? 1 : 0.35)
                        Text(achievement.title)
                            .font(Push.Typography.caption)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(isUnlocked ? Push.Palette.textPrimary : Push.Palette.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Push.Palette.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(achievement.title), \(isUnlocked ? "unlocked" : "locked")")
                }
            }
        }
        .pushCard()
    }
}
