# Getting this on your phone

Written for a Claude Code session on your MacBook. The goal of the first build
is one thing: **find out whether the camera counts your real push-ups.**

## 0. Get the code

```sh
git clone https://github.com/sboris17/scottyb.git
cd scottyb
git checkout claude/pushup-app-concept-65wnld
```

## 1. Bump the build number

The bundle id and team are already committed, so there is nothing to edit
before a normal build. The one thing that must change for every upload is
`CURRENT_PROJECT_VERSION` in `project.yml` — App Store Connect rejects a
build number it has already accepted, and it does so *after* the upload,
which is a slow way to find out.

## 2. Generate and open

```sh
brew install xcodegen   # if you don't have it
xcodegen generate
open Push.xcodeproj
```

`Push.xcodeproj` is generated, never committed. Re-run `xcodegen generate`
after changing `project.yml` — and note it overwrites the project, so make
settings changes in `project.yml` rather than in Xcode's UI.

## 3. Before archiving

- In App Store Connect, create the app record using the same bundle id.
- Xcode: select your team under Signing & Capabilities. Automatic signing is
  already set.
- **Run on your own device first (⌘R).** Do this before bothering with
  TestFlight: it is a two-minute loop instead of a thirty-minute one, and the
  camera path has never executed on real hardware. Anything broken will be
  broken here too, and you can see the console.

## 4. Archive and upload

Product → Destination → Any iOS Device, then Product → Archive → Distribute
App → TestFlight & App Store.

Export compliance is already answered in `Info.plist`
(`ITSAppUsesNonExemptEncryption = false`), so it will not prompt.

Processing usually takes 5-30 minutes. Internal testers need no review.

## 5. Testing the counter properly

Prop the phone on the floor, **to your side**, roughly level with your chest,
1.5-2m away. It needs to see one shoulder, elbow, wrist and hip. The app has a
framing check that tells you if it cannot.

Worth trying deliberately, because each one exercises a different part of the
engine:

| Test | What it is checking |
| --- | --- |
| 10 normal reps | The basic path |
| 10 deliberately shallow reps | Adaptive thresholds. Fixed thresholds score 0 here |
| A set to actual failure | Whether counting keeps up as your depth collapses |
| Rest in a plank for 20s | Must count nothing |
| Sit and bend your arms | Must count nothing |
| Phone slightly too far / too close | Framing check |

Count out loud yourself and compare. Where the app disagrees, note what you
were doing — that is the data that fixes it.

## Known unknowns on device

Nothing here has run on hardware. The most likely first-run problems:

- **Orientation.** The engine assumes image-up is world-up. It picks
  orientation from the device, and a phone flat on the floor reports
  ambiguous orientation. If counts are wildly wrong, this is the first
  suspect.
- **Vision confidence** may be lower in a real room than the synthetic
  fixtures assume, which would show up as the manual fallback appearing.
- **Thermals** on a long session at 15fps.

The in-app debug overlay (Profile → Show counting debug) shows live elbow
angle, thresholds, travel and confidence. Turn it on for the first session —
it turns "it doesn't work" into "here is what it saw".
