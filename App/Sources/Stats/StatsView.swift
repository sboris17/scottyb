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
                    chartCard
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

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Last 14 days").font(Push.Typography.label)
                .foregroundStyle(Push.Palette.textSecondary)
            Chart(lastFourteenDays, id: \.day) { record in
                BarMark(
                    x: .value("Day", record.day, unit: .day),
                    y: .value("Reps", record.totalReps)
                )
                .foregroundStyle(record.qualifies ? Push.Palette.accent : Push.Palette.track)
                .cornerRadius(4)
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
