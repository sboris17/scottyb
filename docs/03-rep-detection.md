# Automatic Rep Detection

This is the feature the product is betting on, and the only part with real
technical risk. Everything else in V1 is a well-understood tracking app.

The bar: **counting must be more trustworthy than the user's own head count.**
An app that counts 19 when you did 20 is worse than no counter at all, because it
breaks the one thing the product is selling — you stop thinking about counting.

## Pipeline

```
AVCaptureVideoDataOutput (640×480, back camera)
        │  ~15 fps, frames dropped if busy
        ▼
VNDetectHumanBodyPoseRequest  (on-device, per frame)
        ▼
Pick highest-confidence observation → 19 normalized joint points
        ▼
Confidence gate + One-Euro smoothing filter
        ▼
Derive scalar signals:  elbow angle · torso-normalized shoulder height · hip angle
        ▼
Adaptive-threshold state machine  ──▶ rep events
        ▼
Per-rep form metrics ──▶ coaching hints
```

Everything runs on-device. Frames are analyzed and discarded — never written to
disk, never uploaded.

## The counting signal

Primary signal is the **elbow angle** — the angle at the elbow formed by
shoulder → elbow → wrist. It is the right choice because it is *scale- and
distance-invariant*: it doesn't matter how far the phone is from the user or how
tall they are.

```swift
/// Interior angle at `vertex`, in degrees.
func angle(_ a: CGPoint, _ vertex: CGPoint, _ c: CGPoint) -> Double {
    let v1 = CGVector(dx: a.x - vertex.x, dy: a.y - vertex.y)
    let v2 = CGVector(dx: c.x - vertex.x, dy: c.y - vertex.y)
    let dot = v1.dx * v2.dx + v1.dy * v2.dy
    let mag = hypot(v1.dx, v1.dy) * hypot(v2.dx, v2.dy)
    guard mag > 0 else { return .nan }
    return acos(max(-1, min(1, dot / mag))) * 180 / .pi
}

let elbow = angle(shoulder, elbow: elbowJoint, wrist)   // ~170° top, ~70–90° bottom
```

Use whichever arm has higher joint confidence, and average the two when both are
confident. A secondary signal — shoulder height divided by shoulder-to-hip
distance — is tracked in parallel and used to reject false positives (see below).

## Adaptive thresholds

Fixed thresholds fail across body types, camera angles, and depth of movement.
A user whose honest bottom is 118 degrees never crosses a hard 100-degree
threshold and gets counted as zero, which is the worst possible failure.

So the thresholds live inside whatever range the user is actually producing:

1. Start with defaults (top 150, bottom 100) until there is movement to learn from.
2. Track the median min and max elbow angle across the last four reps.
3. Set `bottom = min + 0.30 x range` and `top = min + 0.70 x range`.

**Hysteresis must be proportional, not absolute.** An early version used a
fixed 20-degree minimum gap; on a shallow user that pushes the band wider than
their entire range of motion, so they cross the bottom once and can never get
back to "top". One rep, then silence for the rest of the set. The gap is now
`max(8 degrees, 22% of range)`.

### Two recovery mechanisms

Calibration creates two failure modes that need explicit handling. Both are
solved by replaying a rolling buffer of recent signal.

**Bootstrap.** The first reps happen before there is enough movement to
calibrate. Rather than lose them, the engine buffers samples and replays them
once thresholds are known. Without this, a shallow-range user loses every rep
until the window fills.

**Stall.** Thresholds derived from rep history can only update when a rep
completes. If the user's depth collapses from fatigue, no rep completes, so the
thresholds freeze describing a range the user can no longer reach and counting
silently stops mid-set. The engine detects the stall, re-reads thresholds from
raw signal, and replays to recover the reps performed during it.

## Guards

Elbow angle alone cannot tell a push-up from someone sitting on the floor
bending their arms. Four guards decide whether a candidate becomes a rep, and
each threshold was set from measured separation rather than picked by feel.

| Guard | Rule | Why |
| --- | --- | --- |
| Duration | 0.45s to 12s | Faster is a bounce or a glitch; longer is a pause or a walk-away. |
| Vertical travel | shoulder drops >= 3% of torso length | The *body* must move, not just the arms. |
| Correlation | elbow angle vs shoulder height, r >= 0.5 | The body must descend *because* the elbows bend. |
| Smoothness | <= 4 direction reversals | A push-up travels; jitter judders. |

**Travel is measured median-to-median**, between the top hold and the frames
nearest the elbow minimum -- never max-minus-min. The extremes of a noisy
signal *are* the noise, and sampling them both rejected honest shallow reps and
let pose jitter fake reps on a body that never moved.

Measured separation across 25 noise seeds:

| | genuine reps | arm flexion, body still |
| --- | --- | --- |
| vertical travel | 0.057 - 0.39 | max 0.021 |
| correlation | 0.53 - 0.99 | median 0.00 |
| direction reversals | 1 - 5 | up to 20 |

## Form feedback

Metrics are computed per rep and surfaced as at most **one** hint at a time, no
more than once every few reps. Constant correction is the fastest way to make a
coach feel like a referee.

| Metric | How | Hint |
| --- | --- | --- |
| Depth | Minimum elbow angle in the rep | > 110° → *"Try going a little lower"* |
| Back line | Angle at hip (shoulder → hip → knee); deviation from 180° | Sag > 15° → *"Try keeping your back straighter"*; pike > 15° → *"Hips a little lower"* |
| Tempo | Rep duration | < 0.7 s → *"Slow down"* |
| Consistency | Rolling stddev of per-rep depth | Rising late in a set → *"Nice work — form's slipping, finish strong"* |

**Every rep still counts.** Form data is stored on the rep so V2 can show a
session form score and trends without ever having withheld a count.

## Failure modes

| Failure | Mitigation |
| --- | --- |
| Bad framing (user cut off) | Pre-session framing check: overlay a silhouette guide, confirm all four arm joints and both hips are visible before enabling START. |
| Camera can't see a side view | The framing check detects a near-frontal view (shoulder points nearly coincident horizontally) and asks the user to move the phone to their side. |
| Low light | Vision confidence collapses; after ~5 s of low confidence, offer one-tap manual mode. Never silently miscount. |
| Multiple people in frame | Use the highest-confidence observation only, and lock onto it by centroid proximity across frames. |
| Phone falls over mid-set | Sudden global pose translation + confidence drop → pause the session, preserve the count, resume when the pose returns. |
| Loose clothing / dark background | No good fix. This is precisely why manual entry is a first-class path, not a fallback buried in a menu. |

## Validating accuracy

The algorithm was developed against synthetic pose fixtures before any Swift
was written, in `Tools/RepEngineSim`. A side-on body is modelled from a target
elbow-angle profile, so every clip has exact ground truth for both count and
depth, and the engine has to recover it through inverse kinematics and noise.

`make sim` reports scenario accuracy; `make sweep` re-runs everything across 40
noise seeds, because a single passing seed only proves the thresholds fit one
noise realisation.

Current state: **14/14 scenarios exact, 549/560 (98.0%) across the seed
sweep.**

The fixtures are exported to `Packages/RepEngine/Tests/RepEngineTests/Fixtures`
and replayed by the Swift tests, so the two implementations are driven by the
same bytes and any divergence shows up as a failing test rather than as a
miscount on somebody's living room floor.

### Known limitations

Stated plainly because they are real:

- Shallow-range sets (roughly 20-degree range of motion) can lose one rep under
  heavy jitter, on about 17% of noise seeds.
- The deliberately extreme "noisy idle" negative -- resting in a plank while
  tracking is very unstable -- yields one phantom rep on about 5% of seeds.

Both sit at the genuine limit of what these signals separate; per-rep angle
excursion was measured as a possible fifth guard and overlaps too much to help.
The synthetic generator also holds joint confidence artificially high while
adding heavy positional noise, which real Vision would not do, so this negative
is harsher than reality.

### What this does not prove

Synthetic fixtures validate the *logic*: thresholds, guards, calibration drift,
replay. They say nothing about whether Vision returns usable joints for a real
person in a real room. Only the recorded-video corpus settles that, and the
ship gate below is written against that corpus, not against these:

> 40-60 clips across body types, skin tones, clothing, lighting, camera heights
> and angles, plus deliberate negatives. Ship gate: >= 98% total-rep accuracy,
> zero false positives on the negative clips.

## Alternative sensing paths (V2)

- **Apple Watch.** Wrist accelerometer + gyro gives a clean periodic signal and
  removes the framing problem entirely. Probably the strongest V2 investment —
  and it makes "verified" reps far more practical.
- **AirPods head motion.** `CMHeadphoneMotionManager` exposes head pitch and
  acceleration; the head oscillates vertically through a push-up. Plenty of
  people already train with AirPods in. Worth a spike — no framing, no camera,
  works in the dark.
- **Phone-on-floor audio/proximity.** Rejected: too gimmicky and too easy to fool.

## Verified reps

If leaderboards ever require verification (an open product question), the honest
position is that no on-device signal is unforgeable. Realistic layering:

- Reps counted by a sensing path (camera or Watch) are flagged `verified`;
  manual entries are not.
- App Attest establishes the submitting client is a genuine, unmodified build.
- Server-side plausibility checks on submitted sessions — rep tempo distribution,
  session duration versus rep count, day-over-day deltas.

That's enough to keep a public leaderboard credible. It is not enough to stop a
determined cheater, and the product should not pretend otherwise. Manual reps
stay fully valid for personal stats, streaks, and goals.
