# Roadmap

## Sequencing principle

Build the risky thing first. Almost every V1 feature — streaks, goals, programs,
achievements, stats — is well-understood work that will land on schedule. Rep
detection is the only item that could turn out not to work, and it determines
whether this is "the push-up app" or just another tracker with a number pad.

So the first milestone ships nothing to users and answers one question: **can a
phone on the floor count push-ups reliably enough to trust?**

## Milestones

### M0 — Detection spike (2–3 weeks)

A throwaway single-screen app: camera in, count on screen. No persistence, no
design, no navigation.

Deliverables:
- `RepEngine` package with the state machine from [rep detection](03-rep-detection.md)
- Fixture corpus of 40–60 recorded pose sequences with hand-labeled ground truth
- Accuracy report against that corpus

**Go/no-go gate:** ≥ 98% total-rep accuracy, zero false positives on negative
clips. If it lands at 90%, decide deliberately whether to push on the camera
path, pivot to Apple Watch as the primary sensor, or lead with manual entry and
a great habit loop. All three are viable products. Guessing in month four is not.

### M1 — Core loop (3–4 weeks)

Home → session → summary, end to end. Manual mode at full parity with camera
mode from day one. SwiftData model, daily goal, streak, session history.
Internally usable every day — that's the real test.

### M2 — Programs and progression (2–3 weeks)

Onboarding with the optional max test, bundled program JSON, First 10 and Road to
25/50/100, program-day prescription driving the Home card, rest timer, recovery
days that preserve the streak.

### M3 — Feel (2–3 weeks)

The differentiator, and it is not a polish pass tacked on the end. Big-number
typography, progress rings, rep haptics, spoken counts, PR and achievement
celebrations, Reduce Motion paths, Dynamic Type. This milestone is what makes the
app feel like the visual direction rather than a spreadsheet.

### M4 — Ship V1

Stats screen with Swift Charts, achievements grid, data export, App Store assets,
TestFlight beta with 20–50 real users across body types and home setups. Watch
where their counts disagree with the app's — that feedback is worth more than
any internal testing.

### M5 — V2

In rough priority order:

1. **Apple Watch app.** Removes framing entirely, is the strongest verification
   signal, and unlocks HealthKit workout sessions properly.
2. **Adaptive training.** The `adaptationOffset` hook is already in the model;
   this is tuning the rules, not new architecture.
3. **Friends and 1v1 challenges.** The first feature that requires a real
   backend and a real account system — see below.
4. **Leaderboards + verified reps.** Only after friends works and there's
   something to compete over.
5. Monthly challenges, shareable PR cards, deeper form analysis.

## The backend decision

V1 has no server: SwiftData + CloudKit private DB means no infrastructure, no
accounts, no privacy policy complexity, and no ops burden while the product is
still finding out whether people like it.

Social changes that. When it's time:

| Option | Verdict |
| --- | --- |
| CloudKit public DB | Free, no ops, Apple-account identity. Weak querying, painful leaderboards, and it locks out any future Android app. |
| Supabase / Firebase | Fast to build, real queries, real leaderboards, cross-platform later. Adds ops and cost. |
| Custom API | Only worth it if verification logic gets genuinely adversarial. |

Recommendation: stay on CloudKit private for V1, then move to a managed backend
(Supabase) when friends ship — and migrate the user's data, don't ask them to
start over.

## Open questions

These are product calls, not engineering ones, and they're worth deciding
before they get expensive:

1. **Do leaderboards require verified reps?** Splitting stats into "verified" and
   "all" is the safe answer but adds real UI complexity everywhere. Decide before
   building leaderboards, not during.
2. **Streak freezes?** Much easier to add before people have 200-day streaks.
3. **What does a rest day look like?** The one-pager says recovery days preserve
   the streak. Confirm that means the streak metric is "showed up as prescribed",
   not "did push-ups" — the whole streak implementation follows from that.
4. **Does the max test gate onboarding?** Asking someone to do max push-ups
   before they've seen the app is a real drop-off risk. Recommend making it
   genuinely skippable with a good default program.
5. **Pro pricing and timing.** The one-pager says launch free — agreed. But
   decide early which V2 features are Pro, because building them Pro-aware from
   the start is far cheaper than retrofitting a paywall.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Detection accuracy misses the bar | High — it's the whole differentiator | M0 gate before any other investment |
| Camera framing friction kills the flow in practice | High | Framing check + instant manual fallback; measure in TestFlight how often people abandon the camera path |
| Battery/thermals during long sessions | Medium | 15 fps, 640×480, drop late frames; measure on the oldest supported device |
| App Store review flags camera use | Low | Nothing is recorded or transmitted; say so in the permission string and the review notes |
| Single-exercise scope limits retention | Medium | It's also the entire positioning. Programs, challenges, and streaks are the retention mechanic — not exercise variety |
