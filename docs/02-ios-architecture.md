# iOS Architecture

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Minimum OS | iOS 17 | SwiftData, `@Observable`, `ContentUnavailableView`, modern `.symbolEffect` animation. Covers the large majority of active devices by launch. |
| UI | SwiftUI | The app is ~8 screens of big type, rings, and transitions. SwiftUI's animation and haptics story is exactly the visual direction. |
| State | `@Observable` + a small number of environment-injected services | No third-party architecture framework. The app is not complex enough to earn one. |
| Persistence | SwiftData | Local-first, iOS 17 native, migrations are manageable, CloudKit mirroring is one flag. |
| Sync | SwiftData + CloudKit private database | Free, no backend to run, no account system to build for V1. |
| Camera | AVFoundation (`AVCaptureVideoDataOutput`) | Need raw sample buffers for Vision; `AVCaptureSession` gives frame-level control and lets us drop frames under load. |
| Pose | Vision `VNDetectHumanBodyPoseRequest` | On-device, no model to ship, no network, works back to A11-era hardware. See [rep detection](03-rep-detection.md). |
| Charts | Swift Charts | Weekly/monthly bars and PR trends. |
| Health | HealthKit (V2) | Write workouts + active energy. Read nothing initially. |
| Analytics | TelemetryDeck or self-hosted PostHog | Privacy-respecting; App Store nutrition label stays clean. |

**No backend in V1.** Everything is local + CloudKit private DB. A server only
becomes necessary for friends, leaderboards, and verified reps — see
[roadmap](05-roadmap.md).

## Module layout

A single app target with SPM local packages, so the counting engine can be
tested and iterated without launching the UI.

```
PushApp/
├── App/                     # entry point, root navigation, environment wiring
├── Features/
│   ├── Onboarding/          # ability questions, optional max test
│   ├── Home/                # today's card, streak, quick stats
│   ├── Session/             # live camera counter, sets, rest timer
│   ├── Summary/             # post-session recap, PR celebration
│   ├── Programs/            # program browser + detail + progress
│   ├── Stats/               # history, charts, records
│   ├── Achievements/
│   └── Profile/
└── Packages/
    ├── RepEngine/           # pose → reps. Pure Swift, no UIKit/SwiftUI.
    ├── TrainingEngine/      # program generation + adaptation. Pure Swift.
    ├── PushKit/             # SwiftData models, repositories, derived stats
    └── PushUI/              # design tokens, rings, big-number type, haptics
```

`RepEngine` and `TrainingEngine` take plain value types in and return plain
value types out. That is what makes them testable — `RepEngine` in particular
must be driven by recorded pose fixtures in unit tests, not by a person doing
push-ups in front of a simulator.

## Screen inventory (V1)

| Screen | Job |
| --- | --- |
| Onboarding (3–5 cards) | Ability, goal, difficulty, optional max test |
| Home | "What do I do today?" + START + streak/PR/weekly |
| Session setup | Camera framing guide, or switch to manual |
| Live session | Giant rep count, set progress, form hint line |
| Rest timer | Countdown, next set preview, skip |
| Session summary | Reps, sets, duration, PR/achievement celebration |
| Programs | Browse, start, view progress |
| Stats | Day/week/month totals, lifetime, records, charts |
| Achievements | Grid, locked/unlocked |
| Profile/Settings | Units, notifications, camera vs. manual default, data export |

## Session flow

```
Home ──START──▶ Framing check ──▶ Set 1 (live count) ──▶ Rest timer ──▶ Set 2 …
                     │                    │
                     └── manual mode ─────┴──▶ Summary ──▶ PR / achievement
```

Rules that keep it frictionless:

- **Never block on the camera.** If pose confidence stays low for ~5 seconds, the
  app surfaces a one-tap "count manually" path rather than nagging about framing.
- **Auto-advance sets.** Reaching the target rep count starts the rest timer
  automatically; the user never has to reach for the phone mid-workout.
- **Voice + haptics as the primary feedback channel.** The user is face-down on
  the floor and cannot read the screen at the bottom of a rep. Every rep gets a
  light haptic; milestones get a distinct one; count is announced on a
  configurable cadence (every rep / every 5 / silent).
- **The session survives interruption.** State is checkpointed to SwiftData after
  every set so a phone call, timer, or backgrounding never costs a workout.

## Performance and power

- Run Vision at **~15 fps**, not the camera's 30/60. A push-up takes 1–3 seconds;
  15 fps is ~20–45 samples per rep, far more than the state machine needs.
- Use `.vga640x480` capture preset. Higher resolution buys nothing for
  full-body pose and costs battery and thermals.
- Process on a dedicated serial queue and drop frames while one is in flight
  (`alwaysDiscardsLateVideoFrames = true`).
- Never write video to disk, never upload frames. The camera buffer is analyzed
  and discarded. This is both a privacy promise and an App Store review point —
  state it plainly in the camera permission string.

## Accessibility

- The hero rep count must scale with Dynamic Type; the whole point is legibility.
- Everything the camera path does must be reachable through manual mode — the
  automatic counter is an accelerator, never a gate.
- Announce reps and milestones through VoiceOver-compatible speech, and honor
  Reduce Motion by swapping celebration animations for a static state change.
