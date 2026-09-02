# Product One-Pager

**Working name:** TBD
**Platform:** iOS, native

## The idea

A modern fitness app built entirely around one movement: push-ups.

The app helps anyone — from complete beginners to experienced athletes — build a
daily push-up habit, increase strength, beat personal records, and compete with
friends.

Rather than becoming another all-purpose workout app, the goal is to do one
thing extremely well. Push-ups. Every day.

## Core concept

Open the app. Do push-ups.

Whenever possible the phone automatically detects and counts each push-up using
the camera and on-device pose detection.

The app tracks:

- Reps, sets, rest periods
- Daily totals, weekly/monthly totals
- Personal records
- Streaks
- Program progress
- Lifetime push-ups

Manual entry is always available for when automatic tracking isn't practical.

## Automatic push-up tracking

The standout feature. The user props the phone so the camera can see them from
the side; the app counts each completed rep and shows the count live.

```
        24
    PUSH-UPS
   Goal: 30
  ████████░░
```

It can also give simple movement feedback:

- *Good form*
- *Try keeping your back straighter*
- *Slow down*
- *Try going a little lower*

Poor-form reps still count. The app is a coach, not a referee.

Long term, automatic tracking makes logging effortless *and* makes competitive
totals harder to fake.

## Home

The home screen answers one question immediately: **what should I do today?**

```
TODAY
50 Push-Ups
20 / 50 completed

[ START ]

🔥 12 Day Streak
🏆 Best Set: 38
💪 428 This Week
```

A secondary action, **Just Push**, launches an unrestricted session with no
prescribed workout.

## Personalized training

Onboarding asks a few questions:

- Current push-up ability
- Goal
- Current max reps
- Preferred workout difficulty
- Optional max push-up test

The app generates a starting program that adapts to performance. If today's
workout is `3 × 15` and the user struggles on the final set, future workouts ease
off. Consistently outperforming the prescription increases difficulty.

## Programs

- **First 10** — beginner strength to 10 consecutive push-ups
- **Road to 25 / 50 / 100**
- **Daily Push** — build a consistent daily habit
- **Personalized** — adaptive workouts based on performance

There should always be something to complete each day. Scheduled recovery days
still maintain the streak through lighter workouts, recovery goals, or program
completion.

## Goals

User-created targets, for example:

- 25 push-ups every day
- 100 push-ups every day
- 1,000 push-ups this month
- Reach 50 consecutive push-ups
- Complete 10,000 lifetime push-ups
- Custom

## Challenges

Challenges turn repetition into something motivating.

```
SEPTEMBER CHALLENGE
1,000 PUSH-UPS
684 / 1,000
```

Monthly, community, personal, and friend challenges.

```
SCOTTY VS JAKE
First to 500
Scotty  342
Jake    287
```

## Achievements

Lightweight gamification without feeling childish.

🏅 First 100 · 🔥 7-Day Streak · 🔥 30-Day Streak · 💪 50 Consecutive ·
💯 1,000 Lifetime · 🏆 10,000 Lifetime · ⚡ New Personal Record

Animations, haptics, and subtle celebrations make these moments satisfying.

## Social

Social should support motivation, not become the app.

Add friends · compare weekly totals · friend challenges · community challenges ·
leaderboards · profile statistics · achievements.

**Open decision:** whether competitive leaderboards require automatically
tracked/verified push-ups while manually entered reps remain valid for personal
statistics.

## Visual direction

Modern. Clean. Fast. Energetic. Slightly playful.

Not military. Not overly serious. Not cartoonish.

Large numbers, smooth animations, minimal screens, satisfying progress rings,
strong typography, haptic feedback, occasional visual celebrations. The push-up
count itself is usually the hero of the screen.

## MVP

**Version 1**

- Account/profile
- Push-up tracking
- Automatic rep detection, if technically reliable
- Manual logging fallback
- Live rep counter
- Sets + rest timer
- Just Push mode
- Daily push-up goal
- Streaks
- Basic statistics
- Personal records
- Beginner programs, Road to 25 / 50 / 100
- Achievements
- Modern animated UI

**Version 2**

- Adaptive training
- Friends, 1v1 challenges, monthly challenges, leaderboards
- Verified push-up system
- More detailed form analysis
- Shareable PR cards
- Apple Health / wearable integration

## Why it could work

Fitness apps are usually built around hundreds of exercises. This one does the
opposite: it owns one extremely recognizable exercise and removes as much
friction as possible from doing it consistently. There is almost nothing to
learn. Open → Start → Push.

The narrow focus also gives a very clear identity. Not another workout tracker —
*the app for push-ups*.

## Business model

Launch free and focus on making something people want to use every day.

| Free | Optional Pro |
| --- | --- |
| Tracking | Advanced adaptive programs |
| Daily goals | Detailed form coaching |
| Basic programs | Advanced analytics |
| Statistics | Custom challenges |
| Streaks | Expanded competitive features, personalization |

Advertising should probably be avoided initially — interrupting a 30-second
push-up session would undercut the simplicity of the product.

## Naming direction

Short, easy to pronounce, easy to spell, modern, brandable, available as
app/domain/social handle. Ideally one word or two very short words. It doesn't
need "push-up" in it. The brand should be capable of becoming synonymous with
the activity. See [naming](06-naming.md).
