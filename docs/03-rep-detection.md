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

Fixed thresholds fail across body types, camera angles, and depth of movement. A
user with a shallow range of motion never crosses a hard 100° bottom threshold
and gets counted as zero, which is the worst possible failure.

Instead, calibrate to the individual, live:

1. Start with defaults: top ≥ 150°, bottom ≤ 100°.
2. Track a running min and max of the smoothed elbow angle over a sliding window
   of the last ~4 reps.
3. Once two reps are observed, set thresholds inside the observed range:
   `bottom = min + 0.30 × range`, `top = min + 0.70 × range`.
4. Require a minimum range of ~25° before adapting at all, so idle jitter can
   never collapse the thresholds and start counting noise.

The 40-point gap between the two thresholds *is* the hysteresis. A rep only
counts on a full traversal down and back up.

## State machine

```
        ┌──────────────────────────── rep++ ─────────────────────────────┐
        │                                                                │
   ┌────▼────┐  angle < bottom   ┌────────┐  angle > top    ┌──────────┐ │
   │   TOP   │ ────────────────▶ │ BOTTOM │ ──────────────▶ │ COUNTED  │─┘
   └─────────┘                   └────────┘                 └──────────┘
        ▲                             │
        └──── timeout / lost pose ────┘  (reset, no count)
```

Guards on the `BOTTOM → COUNTED` transition:

| Guard | Value | Why |
| --- | --- | --- |
| Minimum rep duration | 0.45 s | Faster than that is a bounce or a tracking glitch, not a push-up. |
| Maximum rep duration | 12 s | Longer means the user paused at the bottom or walked away; reset rather than count. |
| Pose confidence | ≥ 0.3 on all four arm joints, held across the transition | Prevents a lost-and-reacquired skeleton from registering as a rep. |
| Vertical corroboration | normalized shoulder height must have moved ≥ 15% of torso length | Rejects the user bending only their arms while standing, or sitting up and gesturing. |

The vertical corroboration guard is what stops the most common cheat and the most
common accident: it requires the *body* to move, not just the arms.

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

This cannot be tested by doing push-ups in front of a simulator. Build a fixture
corpus instead:

1. Record 40–60 short videos: varied body types, skin tones, clothing, lighting,
   camera heights and angles, floor vs. elevated phone, good and sloppy form,
   plus deliberate negatives (someone stretching, doing burpees, tying a shoe).
2. Run each through Vision **once**, offline, and serialize the pose sequence to
   JSON. These become test fixtures checked into the repo.
3. `RepEngine` tests replay the JSON and assert the counted total against a
   hand-labeled ground truth.

Ship gate: **≥ 98% total-rep accuracy** across the corpus with **zero false
positives** on the negative clips. Tuning a threshold then becomes a
sub-second test run rather than a trip to the floor.

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
