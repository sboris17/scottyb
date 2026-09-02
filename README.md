# Push-Up App (working name TBD)

A native iOS app built entirely around one movement: push-ups.

Open the app. Do push-ups. The phone counts them.

The bet is focus. Most fitness apps cover hundreds of exercises and ask the user
to configure their way to a workout. This one owns a single, universally
recognizable exercise and removes as much friction as possible from doing it
every day.

**North star:** make doing push-ups every day ridiculously easy, measurable, and
motivating. The app succeeds when opening it and doing a set becomes a habit.

## Build

The four packages under `Packages/` are plain SwiftPM and need no project file:

```sh
make test          # all package tests
make test-engine   # just the rep counter
```

The app target is generated from `project.yml`:

```sh
brew install xcodegen
make project       # xcodegen generate
open Push.xcodeproj
```

The counting algorithm has a Python reference implementation that runs anywhere:

```sh
make sim           # accuracy across every scenario
make sweep         # re-run across 40 noise seeds
make fixtures      # regenerate the fixtures the Swift tests replay
```

## Layout

```
App/Sources/           SwiftUI app: onboarding, home, session, stats, profile
Packages/RepEngine/    Pose -> reps. No Vision, AVFoundation or SwiftUI.
Packages/PushCore/     SwiftData models + derived stats (streaks, records)
Packages/TrainingEngine/  Programs and adaptive progression
Packages/PushUI/       Design tokens, components, haptics and speech
Tools/RepEngineSim/    Python reference engine + synthetic fixture generator
```

`RepEngine` deliberately imports nothing Apple-specific, which is what lets the
whole counting engine run against recorded fixtures in a unit test instead of
requiring somebody on the floor in front of a device.

## Status

Builds clean and all tests pass in CI: the packages, the app target
(`xcodebuild` for iOS Simulator), and the Python reference engine.

The counting algorithm was developed and measured in Python first
(`Tools/RepEngineSim`), then transcribed to Swift. Both are driven by the same
exported fixtures, so the Swift engine is verified to agree with the reference
implementation it was measured from.

What CI does *not* prove: that Vision returns usable joints for a real person
in a real room. Nothing here has run on a physical device, and no recorded
video of an actual human has gone through it. That is the M0 gate in the
[roadmap](docs/05-roadmap.md) and it is still open.

Rep counter, measured across 40 noise seeds per scenario:

| | |
| --- | --- |
| Scenarios exact | 14 / 14 |
| Seed sweep | 549 / 560 (98.0%) |
| False positives on negative clips | 0 in the fixture set |

Known limitations are documented in [rep detection](docs/03-rep-detection.md)
rather than rounded away.

### Built

Core loop end to end: onboarding, adaptive program selection, camera counting
with a manual fallback, sets and rest, streaks, records, achievements, stats,
data export.

### Not built

Friends, challenges, leaderboards, verified reps, Apple Watch, HealthKit —
all V2 in the [roadmap](docs/05-roadmap.md). The app has no backend and no
account system by design; V1 is local-first with CloudKit private mirroring.

## Docs

| Doc | What's in it |
| --- | --- |
| [Product one-pager](docs/01-product-one-pager.md) | The concept, features, business model |
| [iOS architecture](docs/02-ios-architecture.md) | Stack, module layout, screen inventory |
| [Rep detection](docs/03-rep-detection.md) | The counting algorithm, its guards, and what they measure |
| [Data model](docs/04-data-model.md) | SwiftData entities, derived stats, sync |
| [Roadmap](docs/05-roadmap.md) | V1 scope, V2 scope, sequencing, open risks |
| [Naming](docs/06-naming.md) | Criteria and candidate shortlist |
