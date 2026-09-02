# Data Model

SwiftData, local-first, mirrored to the CloudKit private database. Every entity
carries a UUID `id` and a `modifiedAt` so a future server can sync without a
migration.

## Entities

```
Profile ──┬──▶ Session ──▶ WorkoutSet ──▶ RepSample
          ├──▶ ProgramEnrollment ──▶ Program ──▶ ProgramDay
          ├──▶ Goal
          └──▶ AchievementUnlock ──▶ Achievement
```

### Profile
One row. `displayName`, `createdAt`, `maxRepsAtOnboarding`, `currentMax`,
`difficultyPreference`, `dailyGoal`, `preferredCountingMode`, `unitsPreference`.

### Session
One workout. `startedAt`, `endedAt`, `source` (`.program` / `.justPush` /
`.manual`), `programDayID?`, `totalReps`, `totalSets`, `countingMode`
(`.camera` / `.watch` / `.manual`), `isVerified`.

### WorkoutSet
`sessionID`, `index`, `targetReps?`, `completedReps`, `startedAt`, `endedAt`,
`restDurationAfter`, `formScore?`.

### RepSample
One row per detected rep, camera/watch sessions only. `setID`, `timestamp`,
`durationSeconds`, `minElbowAngle`, `hipDeviation`, `confidence`.

Cheap to store (a few dozen bytes per rep; even 10,000 lifetime reps is under a
megabyte) and it's what makes V2 form trends possible without re-recording
anything. Prune samples older than a year if size ever becomes a concern.

### Program / ProgramDay
`Program`: `slug` (`first-10`, `road-to-25`, `road-to-50`, `road-to-100`,
`daily-push`, `personalized`), `title`, `summary`, `dayCount`.
`ProgramDay`: `programID`, `dayIndex`, `prescription` (array of set targets),
`isRecoveryDay`, `notes`.

Built-in programs ship as JSON in the bundle and are seeded on first launch —
not hard-coded in Swift — so a program can be tuned without an App Store release
once remote config exists.

### ProgramEnrollment
`programID`, `startedAt`, `currentDayIndex`, `completedDayIndices`,
`adaptationOffset` (the signed difficulty adjustment the adaptive engine has
accumulated), `completedAt?`.

### Goal
`kind` (`.dailyReps` / `.monthlyTotal` / `.consecutiveReps` / `.lifetimeTotal` /
`.custom`), `targetValue`, `periodStart`, `periodEnd?`, `isActive`,
`completedAt?`.

### Achievement / AchievementUnlock
`Achievement` is static catalog data seeded from the bundle: `slug`, `title`,
`emoji`, `criteria`. `AchievementUnlock` records `achievementID` and `unlockedAt`
so the celebration only ever fires once.

## Derived stats — compute, don't store

Daily totals, weekly totals, streaks, and personal records are **derived** from
sessions, not stored as their own mutable rows. Denormalized counters are the
classic source of "my streak is wrong" bugs, and a streak bug in a habit app is
a churn event.

The one exception is a `DailyRollup` cache (`date`, `totalReps`, `sessionCount`,
`goalMet`) rebuilt on write. It exists purely so the stats screen and the streak
calculation don't scan every session on every launch. It must always be
reconstructible from `Session` alone, and there should be a test that proves it.

### Streak rules

A day counts toward the streak if **any** of these is true:

- the day's total reps ≥ the active daily goal, or
- the day's prescribed program day was completed, or
- the program scheduled a recovery day.

Streak boundaries use the user's **local** calendar day, resolved at read time.
Store timestamps in UTC; never store a "streak day" as a date string, or
travelling across a timezone will silently break a 90-day streak.

Decide explicitly and early whether streaks get a grace/freeze mechanic. It is
much easier to add one before people have long streaks than after.

### Personal records

`bestSet` (max reps in a single set), `bestDay`, `bestWeek`, `bestMonth`,
`longestStreak`, `lifetimeTotal`. All queries over `WorkoutSet` / `DailyRollup`.
A PR is detected by comparing the just-finished session against the pre-session
record, so the summary screen can celebrate it in the moment.

## Sync and privacy

- CloudKit private DB via SwiftData's CloudKit mirroring. No account to create,
  nothing for us to operate, and the user's data is theirs.
- CloudKit mirroring requires every relationship to be optional and every
  attribute to have a default — design for that from the first model version
  rather than fighting a migration later.
- No video, no frames, no images ever leave the device — nothing is even
  persisted locally.
- Ship data export (JSON + CSV) in V1. It's a day of work, it's a real trust
  signal for a daily-habit app, and it makes GDPR/CCPA answers trivial.
