"""
Reference implementation of the push-up counting engine.

This is the executable spec. The Swift `RepEngine` package is a direct
transcription of this file, and both are driven by the same JSON fixtures so
they must agree on every count.

Signals, all derived from Vision's normalized body-pose joints:

  elbowAngle   shoulder -> elbow -> wrist. Scale and distance invariant, which
               is why it is the primary counting signal.
  shoulderY    raw normalized image height of the shoulder. Valid because the
               phone is stationary during a set; used only as a ratio against
               torso length, so body size cancels out.
  hipAngle     shoulder -> hip -> knee. Form only, never gates a count.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from statistics import median

# --- Tunables -------------------------------------------------------------
# Defaults, used until the engine has enough of the user's own movement to
# calibrate. Deliberately generous: a missed rep is worse than a late one.
DEFAULT_TOP_ANGLE = 150.0
DEFAULT_BOTTOM_ANGLE = 100.0

MIN_CALIBRATION_RANGE = 18.0   # degrees of travel before we trust adaptation
BOTTOM_FRACTION = 0.30         # of the observed range, measured from the floor
TOP_FRACTION = 0.70
# Hysteresis has to be a fraction of the user's own range, not an absolute
# number of degrees. An absolute floor of 20 degrees pushes the band wider
# than a shallow user's entire range of motion, so they cross the bottom once
# and can never get back to "top" -- one rep, then silence for the whole set.
MIN_GAP_DEGREES = 8.0
MIN_GAP_FRACTION = 0.22
ANGLE_CEILING = 170.0
ANGLE_FLOOR = 55.0

MIN_REP_SECONDS = 0.45         # faster is a bounce or a tracking glitch
MAX_REP_SECONDS = 12.0         # longer is a pause or a walk-away
MIN_JOINT_CONFIDENCE = 0.30
# Elbow angle and shoulder height must move together: the body descends
# *because* the elbows bend. Jitter moves them independently, so this rejects
# noise that happens to clear the travel guard. Real reps sit near +0.95.
MIN_SIGNAL_CORRELATION = 0.60
# A push-up is one descent and one ascent, so the height signal changes
# direction about once. Jitter reverses constantly. Measured: real reps never
# exceed 5 reversals (typically 1), noise reaches 20.
MAX_DIRECTION_REVERSALS = 4
# Rep-height drop as a fraction of torso length. Measured separation on the
# fixture set: genuine reps land at 0.057 (a 22-degree range of motion) up to
# 0.39 (full depth), while arm-flexion-without-body-movement tops out at 0.021.
# 0.040 sits between them with roughly 2x margin either side.
# Body travel required, as a fraction of torso length. Retuned when the
# measurement became a rotation-free distance: a distance is always positive,
# so jitter accumulates instead of cancelling, and the old 1D figure no longer
# applied. Chosen by grid search against the whole fixture set.
MIN_BODY_TRAVEL = 0.023

DEBOUNCE_FRAMES = 2            # consecutive frames needed to change state
CALIBRATION_WINDOW = 4         # reps of history feeding the adaptive thresholds
BOOTSTRAP_SECONDS = 6.0        # rolling window of signal used to calibrate
STALL_SECONDS = 4.0            # no rep for this long => re-read the room
REPLAY_SECONDS = 15.0          # how much signal we keep to recover missed reps

# Form thresholds
SHALLOW_DEPTH_ANGLE = 110.0
BACK_DEVIATION_DEGREES = 15.0
FAST_TEMPO_SECONDS = 0.70

ARM_JOINTS = ("shoulder", "elbow", "wrist")


def angle_between(a, vertex, c):
    """Interior angle at `vertex` in degrees, or None if degenerate."""
    v1 = (a[0] - vertex[0], a[1] - vertex[1])
    v2 = (c[0] - vertex[0], c[1] - vertex[1])
    mag = math.hypot(*v1) * math.hypot(*v2)
    if mag <= 1e-9:
        return None
    dot = v1[0] * v2[0] + v1[1] * v2[1]
    return math.degrees(math.acos(max(-1.0, min(1.0, dot / mag))))


class LowPass:
    def __init__(self):
        self.value = None

    def filter(self, x, alpha):
        self.value = x if self.value is None else alpha * x + (1 - alpha) * self.value
        return self.value


class OneEuroFilter:
    """Jitter filter that stops lagging when the movement is genuinely fast.

    A plain EMA heavy enough to kill pose jitter at the top of a rep also
    rounds off the bottom of a fast rep, which costs counts. One-Euro widens
    its own cutoff with speed, so it smooths the hold and tracks the descent.
    """

    def __init__(self, min_cutoff=1.2, beta=0.05, d_cutoff=1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        self.x_filter = LowPass()
        self.dx_filter = LowPass()
        self.last_time = None
        self.last_value = None

    @staticmethod
    def _alpha(cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def filter(self, x, t):
        if self.last_time is None or t <= self.last_time:
            self.last_time, self.last_value = t, x
            self.x_filter.filter(x, 1.0)
            return x
        dt = t - self.last_time
        dx = (x - self.last_value) / dt
        dx_hat = self.dx_filter.filter(dx, self._alpha(self.d_cutoff, dt))
        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        result = self.x_filter.filter(x, self._alpha(cutoff, dt))
        self.last_time, self.last_value = t, x
        return result


@dataclass
class Sample:
    """One frame reduced to what the counter needs.

    The shoulder is kept as a 2D point rather than a height. Measuring the
    drop along the image's y axis silently assumes the phone knows which way
    is up -- and a phone propped on a floor does not. Distance is the same in
    any rotation, so nothing downstream depends on orientation.
    """
    t: float
    elbow_angle: float
    # Midpoint of shoulder and hip. Two joints averaged rather than one
    # tracked: their pose jitter is independent so it partly cancels, while a
    # real push-up moves both together. Kept as a point, never a height.
    shoulder: tuple[float, float]
    torso_length: float
    hip_angle: float | None
    confident: bool


@dataclass
class Rep:
    index: int
    started_at: float
    ended_at: float
    min_elbow_angle: float
    max_elbow_angle: float
    vertical_travel: float
    hip_deviation: float | None

    @property
    def duration(self):
        return self.ended_at - self.started_at


@dataclass
class Thresholds:
    top: float = DEFAULT_TOP_ANGLE
    bottom: float = DEFAULT_BOTTOM_ANGLE
    calibrated: bool = False


class AdaptiveThresholds:
    """Calibrates the count thresholds to this person, on this day.

    Fixed thresholds are the single biggest source of missed reps: someone
    whose honest bottom is 115 degrees never crosses a hard 100 and gets
    counted as zero, which is the worst failure the app can have. So the
    thresholds live inside whatever range the user is actually producing.
    """

    def __init__(self):
        self.reps = deque(maxlen=CALIBRATION_WINDOW)
        self.window: deque[Sample] = deque()
        self.current = Thresholds()

    def observe(self, sample: Sample):
        self.window.append(sample)
        while self.window and sample.t - self.window[0].t > BOOTSTRAP_SECONDS:
            self.window.popleft()
        if not self.reps:
            self._recompute_from_window()

    def record_rep(self, min_angle, max_angle):
        self.reps.append((min_angle, max_angle))
        self._recompute_from_reps()

    def _apply(self, low, high):
        rng = high - low
        if rng < MIN_CALIBRATION_RANGE:
            return False
        top = low + TOP_FRACTION * rng
        bottom = low + BOTTOM_FRACTION * rng
        min_gap = max(MIN_GAP_DEGREES, MIN_GAP_FRACTION * rng)
        if top - bottom < min_gap:
            mid = (top + bottom) / 2
            top, bottom = mid + min_gap / 2, mid - min_gap / 2
        self.current = Thresholds(
            top=min(top, ANGLE_CEILING),
            bottom=max(bottom, ANGLE_FLOOR),
            calibrated=True,
        )
        return True

    def recalibrate_from_window(self):
        """Re-read the thresholds from raw signal, ignoring rep history.

        Used when reps stop completing: the user has changed how they move
        (fatigue is the common case) and the rep-derived thresholds now
        describe a range they can no longer reach.
        """
        return self._recompute_from_window()

    def _recompute_from_window(self):
        """Calibrate from raw signal -- but only if the body actually moved.

        Pose jitter on a static plank can swing the elbow angle far enough to
        look like a range worth calibrating to, and once the thresholds
        collapse onto noise the engine starts counting noise. Shoulder
        movement is the tell: jitter does not move the torso, push-ups do.

        Measured as distance from the shoulder's own centre, so it holds at
        any camera rotation.
        """
        if len(self.window) < 8:
            return False
        angles = [s.elbow_angle for s in self.window]
        torso = median([s.torso_length for s in self.window]) or 1e-6
        centre = (median([s.shoulder[0] for s in self.window]),
                  median([s.shoulder[1] for s in self.window]))
        # Percentiles rather than min/max: over a 6-second window the extremes
        # are by definition the two noisiest samples in it.
        spread = sorted(math.dist(s.shoulder, centre) for s in self.window)
        if 2 * spread[int(0.90 * (len(spread) - 1))] / torso < MIN_BODY_TRAVEL:
            return False
        return self._apply(min(angles), max(angles))

    def _recompute_from_reps(self):
        lows = [r[0] for r in self.reps]
        highs = [r[1] for r in self.reps]
        self._apply(median(lows), median(highs))


class RepCounter:
    """The counting state machine.

    TOP --(angle < bottom)--> BOTTOM --(angle > top)--> guards --> rep

    Guards exist because the arm angle alone cannot tell a push-up apart from
    someone sitting on the floor bending their elbows. The vertical-travel
    guard is the one that matters: it demands the *body* move, not just arms.

    Two recovery mechanisms sit on top of the machine, both driven by the same
    rolling sample buffer:

      bootstrap replay  The first reps happen before the engine has seen enough
                        movement to calibrate. Rather than lose them, replay
                        the buffered signal once thresholds are known.
      stall replay      If reps stop completing while the signal is still
                        oscillating, the thresholds no longer describe how the
                        user is moving -- typically fatigue shortening their
                        range. Re-read thresholds from raw signal and replay,
                        so the reps during the stall are recovered too.
    """

    def __init__(self, on_rep=None):
        self.thresholds_model = AdaptiveThresholds()
        self.reps: list[Rep] = []
        self.on_rep = on_rep
        self.rejections: list[str] = []
        self.recent: deque[Sample] = deque()
        self.calibrated_once = False
        self.last_rep_time = 0.0
        self.last_recalibration = 0.0
        self._reset_state()

    def _reset_state(self):
        self.state = "unknown"
        self.rep_start_time = None
        self.last_above_top = None
        self.min_angle = None
        self.max_angle = None
        self.pos_at_top = None
        self.max_hip_deviation = None
        self.below_frames = 0
        self.top_positions: deque[tuple[float, float]] = deque(maxlen=6)
        self.rep_samples: list[tuple[float, tuple[float, float]]] = []

    @property
    def thresholds(self):
        return self.thresholds_model.current

    # --- public entry point ------------------------------------------------

    def process(self, s: Sample):
        if not s.confident:
            # A skeleton that vanishes and returns must never read as a rep.
            if self.state == "bottom":
                self.rejections.append("lost-pose-mid-rep")
            self._reset_state()
            return

        self.thresholds_model.observe(s)
        self.recent.append(s)
        while self.recent and s.t - self.recent[0].t > REPLAY_SECONDS:
            self.recent.popleft()

        if not self.calibrated_once and self.thresholds.calibrated:
            self.calibrated_once = True
            self._replay("bootstrap")
            return

        if self._should_recalibrate(s):
            self.last_recalibration = s.t
            if self.thresholds_model.recalibrate_from_window():
                self._replay("stall")
                return

        self._step(s)

    def _should_recalibrate(self, s: Sample):
        if not self.calibrated_once or self.state == "unknown":
            return False
        if (s.t - self.last_recalibration) < STALL_SECONDS:
            return False
        return (s.t - self.last_rep_time) > STALL_SECONDS

    # --- replay ------------------------------------------------------------

    def _replay(self, reason: str):
        """Re-run the buffered signal under the current thresholds.

        Only reps that start after the last rep we already counted are kept, so
        replaying can add reps but never double-count them.
        """
        cutoff = self.reps[-1].ended_at if self.reps else float("-inf")
        shadow = RepCounter()
        shadow.thresholds_model.current = self.thresholds
        for sample in self.recent:
            shadow._step(sample, suppress_recalibration=True)

        for rep in shadow.reps:
            if rep.started_at <= cutoff:
                continue
            rep.index = len(self.reps) + 1
            self.reps.append(rep)
            self.last_rep_time = rep.ended_at
            if self.on_rep:
                self.on_rep(rep)
            self.thresholds_model.record_rep(rep.min_elbow_angle, rep.max_elbow_angle)

        self.rejections.append(f"replay:{reason}")
        # Adopt the shadow machine's in-flight state so counting continues
        # seamlessly from wherever the replay left off.
        self.state = shadow.state
        self.rep_start_time = shadow.rep_start_time
        self.last_above_top = shadow.last_above_top
        self.min_angle = shadow.min_angle
        self.max_angle = shadow.max_angle
        self.pos_at_top = shadow.pos_at_top
        self.max_hip_deviation = shadow.max_hip_deviation

    # --- machine -----------------------------------------------------------

    def _step(self, s: Sample, suppress_recalibration=False):
        t = self.thresholds

        if s.elbow_angle >= t.top:
            self.last_above_top = s.t

        if self.state == "unknown":
            if s.elbow_angle >= t.top:
                self._enter_top(s)
            return

        if self.state == "top":
            self.max_angle = max(self.max_angle, s.elbow_angle)
            self.top_positions.append(s.shoulder)
            self.pos_at_top = (median([p[0] for p in self.top_positions]),
                               median([p[1] for p in self.top_positions]))
            self.below_frames = self.below_frames + 1 if s.elbow_angle <= t.bottom else 0
            if self.below_frames >= DEBOUNCE_FRAMES:
                self.below_frames = 0
                self.state = "bottom"
                self.rep_start_time = self.last_above_top or s.t
                self.min_angle = s.elbow_angle
                self.rep_samples = [(s.elbow_angle, s.shoulder)]
                self.max_hip_deviation = self._hip_deviation(s)
            return

        # state == "bottom"
        self.min_angle = min(self.min_angle, s.elbow_angle)
        self.rep_samples.append((s.elbow_angle, s.shoulder))
        dev = self._hip_deviation(s)
        if dev is not None:
            self.max_hip_deviation = dev if self.max_hip_deviation is None else max(self.max_hip_deviation, dev)

        if s.t - self.rep_start_time > MAX_REP_SECONDS:
            self.rejections.append("too-slow")
            self._reset_state()
            return

        if s.elbow_angle >= t.top:
            self._try_complete(s, suppress_recalibration)

    def _enter_top(self, s: Sample):
        self.state = "top"
        self.max_angle = s.elbow_angle
        self.top_positions = deque([s.shoulder], maxlen=6)
        self.pos_at_top = s.shoulder
        self.rep_samples = []
        self.last_above_top = s.t

    def _depth_series(self):
        """Shoulder travel along its own axis of motion, per frame.

        The rep defines its own "down": the direction from the shoulder's
        resting position at the top to where it ends up at the bottom. Depth
        is displacement projected onto that axis, so it is 0 at the top and
        largest at the bottom no matter how the phone is rotated. Nothing here
        refers to the image's x or y axis, which is the whole point -- a phone
        propped on a floor cannot reliably say which way is up.
        """
        if not self.rep_samples or self.pos_at_top is None:
            return []
        deepest = self._deepest_position()
        if deepest is None:
            return []
        ax, ay = deepest[0] - self.pos_at_top[0], deepest[1] - self.pos_at_top[1]
        length = math.hypot(ax, ay)
        if length < 1e-9:
            return [0.0] * len(self.rep_samples)
        ux, uy = ax / length, ay / length
        return [((p[0] - self.pos_at_top[0]) * ux + (p[1] - self.pos_at_top[1]) * uy)
                for _, p in self.rep_samples]

    def _deepest_position(self):
        """Median shoulder position across the frames nearest full flexion.

        Median rather than the single deepest frame: the extreme of a noisy
        signal is the noise. Tying it to the elbow minimum also forces the
        body's low point to coincide with the arms' -- true of a push-up, not
        true of jitter.
        """
        angles = [a for a, _ in self.rep_samples]
        if not angles:
            return None
        deepest = min(angles)
        band = deepest + 0.15 * max(max(angles) - deepest, 1e-6)
        near = [p for a, p in self.rep_samples if a <= band]
        if not near:
            return None
        return (median([p[0] for p in near]), median([p[1] for p in near]))

    def _body_travel(self, torso_length):
        """How far the body moved, as a fraction of torso length.

        A distance, so it is identical under any rotation of the camera.
        """
        deepest = self._deepest_position()
        if deepest is None or self.pos_at_top is None:
            return 0.0
        return math.dist(self.pos_at_top, deepest) / max(torso_length, 1e-6)

    @staticmethod
    def _direction_reversals(depths):
        """How many times the body reversed direction during the rep."""
        if len(depths) < 6:
            return 0
        span = (max(depths) - min(depths)) or 1e-9
        deltas = [depths[i + 1] - depths[i] for i in range(len(depths) - 1)]
        deltas = [d for d in deltas if abs(d) > 0.04 * span]  # ignore micro-steps
        return sum(1 for i in range(len(deltas) - 1) if deltas[i] * deltas[i + 1] < 0)

    @staticmethod
    def _correlation(pairs):
        """Pearson r between the two components of a paired sample."""
        n = len(pairs)
        if n < 4:
            return 0.0
        xs = [a for a, _ in pairs]
        ys = [b for _, b in pairs]
        mx, my = sum(xs) / n, sum(ys) / n
        num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
        dy = math.sqrt(sum((y - my) ** 2 for y in ys))
        return 0.0 if dx * dy < 1e-12 else num / (dx * dy)

    def _hip_deviation(self, s: Sample):
        return None if s.hip_angle is None else abs(180.0 - s.hip_angle)

    def _try_complete(self, s: Sample, suppress_recalibration=False):
        duration = s.t - self.rep_start_time
        travel = self._body_travel(s.torso_length)
        depths = self._depth_series()
        angles = [a for a, _ in self.rep_samples]
        # Depth rises as the elbow angle falls, so pair the angle against
        # negated depth and the expected correlation stays positive.
        coupling = self._correlation(list(zip(angles, [-d for d in depths])))

        if duration < MIN_REP_SECONDS:
            self.rejections.append("too-fast")
        elif travel < MIN_BODY_TRAVEL:
            # Arms moved, body did not. Not a push-up.
            self.rejections.append("no-body-travel")
        elif coupling < MIN_SIGNAL_CORRELATION:
            # Body moved, but not in time with the arms. Not a push-up.
            self.rejections.append("uncorrelated")
        elif self._direction_reversals(depths) > MAX_DIRECTION_REVERSALS:
            # The body juddered rather than travelled. Tracking noise.
            self.rejections.append("not-smooth")
        else:
            rep = Rep(
                index=len(self.reps) + 1,
                started_at=self.rep_start_time,
                ended_at=s.t,
                min_elbow_angle=self.min_angle,
                max_elbow_angle=max(self.max_angle, s.elbow_angle),
                vertical_travel=travel,
                hip_deviation=self.max_hip_deviation,
            )
            self.reps.append(rep)
            self.last_rep_time = s.t
            if not suppress_recalibration:
                self.thresholds_model.record_rep(rep.min_elbow_angle, rep.max_elbow_angle)
            if self.on_rep:
                self.on_rep(rep)

        self._enter_top(s)


class PoseInterpreter:
    """Turns raw joint dictionaries into `Sample`s, picking the better arm."""

    def __init__(self, frequency=15.0):
        self.angle_filter = OneEuroFilter()
        self.torso_filter_x = OneEuroFilter(min_cutoff=1.0, beta=0.02)
        self.torso_filter_y = OneEuroFilter(min_cutoff=1.0, beta=0.02)

    def sample(self, t, joints):
        best = None
        for side in ("left", "right"):
            pts = [joints.get(f"{side}_{j}") for j in ARM_JOINTS]
            if any(p is None for p in pts):
                continue
            conf = min(p[2] for p in pts)
            if best is None or conf > best[0]:
                best = (conf, side, pts)

        if best is None or best[0] < MIN_JOINT_CONFIDENCE:
            return Sample(t, 0.0, (0.0, 0.0), 1.0, None, confident=False)

        conf, side, (shoulder, elbow, wrist) = best
        raw_angle = angle_between(shoulder[:2], elbow[:2], wrist[:2])
        hip = joints.get(f"{side}_hip")
        knee = joints.get(f"{side}_knee")
        if raw_angle is None or hip is None or hip[2] < MIN_JOINT_CONFIDENCE:
            return Sample(t, 0.0, 0.0, 1.0, None, confident=False)

        torso = math.dist(shoulder[:2], hip[:2])
        hip_angle = None
        if knee is not None and knee[2] >= MIN_JOINT_CONFIDENCE:
            hip_angle = angle_between(shoulder[:2], hip[:2], knee[:2])

        return Sample(
            t=t,
            elbow_angle=self.angle_filter.filter(raw_angle, t),
            shoulder=(self.torso_filter_x.filter((shoulder[0] + hip[0]) / 2, t),
                      self.torso_filter_y.filter((shoulder[1] + hip[1]) / 2, t)),
            torso_length=torso,
            hip_angle=hip_angle,
            confident=True,
        )


def form_hint(rep: Rep):
    """At most one hint per rep. Constant correction turns a coach into a
    referee, and the product is explicit that it should be a coach."""
    if rep.hip_deviation is not None and rep.hip_deviation > BACK_DEVIATION_DEGREES:
        return "Try keeping your back straighter"
    if rep.min_elbow_angle > SHALLOW_DEPTH_ANGLE:
        return "Try going a little lower"
    if rep.duration < FAST_TEMPO_SECONDS:
        return "Slow down"
    return None


def count(frames, on_rep=None):
    interp = PoseInterpreter()
    counter = RepCounter(on_rep=on_rep)
    for t, joints in frames:
        counter.process(interp.sample(t, joints))
    return counter
