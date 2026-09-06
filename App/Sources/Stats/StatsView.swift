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
                VStack(spacing: 22) {
                    lifetimeHero
                    momentumBlock
                    chartBlock
                    weeklyBlock
                    recordsBlock
                    AchievementsGrid(unlocked: store.unlockedAchievements)
                }
                .padding(.horizontal, Push.Metrics.gutter)
                .padding(.bottom, 28)
            }
            .background(Push.Palette.background)
            .navigationTitle("Stats")
        }
    }

    /// On the background, not in a card. It is the headline of the screen.
    private var lifetimeHero: some View {
        HeroCount(store.records.lifetimeTotal, label: "push-ups, all time")
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
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
    private var momentumBlock: some View {
        let thisWeek = total(daysAgo: 0..<7)
        let lastWeek = total(daysAgo: 7..<14)
        let delta = thisWeek - lastWeek
        let sessions = store.sessionCount
        let average = sessions > 0 ? store.records.lifetimeTotal / sessions : 0

        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Momentum")
            VStack(spacing: 14) {
                MetricStrip([
                    .init("\(thisWeek)", "This week"),
                    .init("\(lastWeek)", "Last week"),
                    .init("\(sessions)", "Sessions"),
                    .init("\(average)", "Per session"),
                ], valueSize: 21)

                if lastWeek > 0 || thisWeek > 0 {
                    HStack(spacing: 8) {
                        Image(systemName: deltaSymbol(delta: delta, lastWeek: lastWeek))
                            .font(.system(size: 12, weight: .semibold))
                        Text(momentumSentence(delta: delta, lastWeek: lastWeek))
                            .font(Push.Typography.caption)
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(delta < 0 ? Push.Palette.textSecondary : Push.Palette.accent)
                }
            }
            .pushCard()
        }
    }

    private func deltaSymbol(delta: Int, lastWeek: Int) -> String {
        if lastWeek == 0 { return "clock" }
        if delta > 0 { return "arrow.up.right" }
        if delta == 0 { return "equal" }
        return "arrow.down.right"
    }

    /// Down weeks are stated plainly and without scolding. A training app that
    /// editorialises about a bad week is one people delete after a bad week.
    private func momentumSentence(delta: Int, lastWeek: Int) -> String {
        if lastWeek == 0 { return "First week of data. Next week gets a comparison." }
        if delta > 0 { return "Up \(delta) on last week." }
        if delta == 0 { return "Level with last week." }
        return "Down \(abs(delta)) on last week."
    }

    // MARK: - Charts

    private var chartBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Last 14 days", detail: store.profile.dailyGoal > 0 ? "goal \(store.profile.dailyGoal)" : nil)
            Chart {
                ForEach(lastFourteenDays, id: \.day) { record in
                    BarMark(
                        x: .value("Day", record.day, unit: .day),
                        y: .value("Reps", record.totalReps)
                    )
                    .foregroundStyle(record.qualifies ? Push.Palette.accent : Push.Palette.track)
                    .cornerRadius(3)
                }
                // Bars without the line they are judged against make a good day
                // and a bad day look the same.
                if store.profile.dailyGoal > 0 {
                    RuleMark(y: .value("Goal", store.profile.dailyGoal))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .foregroundStyle(Push.Palette.textTertiary)
                }
            }
            .chartYAxis { AxisMarks(position: .leading) }
            .chartXAxis { AxisMarks(values: .stride(by: .day, count: 3)) }
            .frame(height: 150)
            .accessibilityLabel("Daily push-ups for the last fourteen days")
            .pushCard()
        }
    }

    /// Twelve weeks, because a fortnight of bars cannot show a trend and this
    /// is the only place in the app that tries to.
    private var weeklyBlock: some View {
        let weeks: [(start: Date, total: Int)] = (0..<12).reversed().compactMap { offset in
            guard let start = calendar.date(byAdding: .day, value: -7 * offset,
                                            to: calendar.startOfDay(for: Date())) else { return nil }
            return (start, total(daysAgo: (offset * 7)..<((offset + 1) * 7)))
        }
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Last 12 weeks")
            Chart(weeks, id: \.start) { week in
                BarMark(x: .value("Week", week.start, unit: .weekOfYear),
                        y: .value("Reps", week.total))
                    .foregroundStyle(Push.Palette.accent.opacity(0.8))
                    .cornerRadius(3)
            }
            .chartYAxis { AxisMarks(position: .leading) }
            .chartXAxis { AxisMarks(values: .stride(by: .month)) }
            .frame(height: 130)
            .accessibilityLabel("Push-ups per week for the last twelve weeks")
            .pushCard()
        }
    }

    // MARK: - Records

    private var recordsBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Records")
            VStack(spacing: 0) {
                row("Best set", store.records.bestSet)
                divider
                row("Best day", store.records.bestDay)
                divider
                row("Best week", store.records.bestWeek)
                divider
                row("Best month", store.records.bestMonth)
                divider
                row("Longest streak", store.records.longestStreak, suffix: " days")
            }
            .pushCard(padding: 0)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Push.Palette.stroke)
            .frame(height: 1)
            .padding(.leading, 16)
    }

    private func row(_ title: String, _ value: Int, suffix: String = "") -> some View {
        HStack {
            Text(title).font(Push.Typography.body)
                .foregroundStyle(Push.Palette.textSecondary)
            Spacer()
            Text("\(value)\(suffix)")
                .font(Push.Typography.stat(17))
                .foregroundStyle(Push.Palette.textPrimary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
    }
}

struct AchievementsGrid: View {
    let unlocked: Set<String>

    private let columns = [GridItem(.adaptive(minimum: 100), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader("Achievements", detail: "\(unlocked.count) of \(AchievementCatalog.all.count)")
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(AchievementCatalog.all) { achievement in
                    let isUnlocked = unlocked.contains(achievement.slug)
                    VStack(spacing: 8) {
                        // A locked badge is dimmed and outlined rather than
                        // greyscaled: greyscale on an emoji only ever meant
                        // "this picture is broken".
                        Image(systemName: achievement.symbol)
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(isUnlocked ? Push.Palette.accent : Push.Palette.textTertiary)
                            .frame(width: 38, height: 38)
                            .background(isUnlocked ? Push.Palette.accentSoft : Color.clear, in: Circle())
                            .overlay {
                                if !isUnlocked {
                                    Circle().strokeBorder(Push.Palette.stroke, lineWidth: 1)
                                }
                            }
                        Text(achievement.title)
                            .font(Push.Typography.micro)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(isUnlocked ? Push.Palette.textPrimary : Push.Palette.textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(achievement.title), \(isUnlocked ? "unlocked" : "locked")")
                }
            }
            .pushCard(padding: 6)
        }
    }
}
