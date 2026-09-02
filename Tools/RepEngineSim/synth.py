"""
Synthetic side-view pose sequences for exercising the rep counter.

These are not a substitute for the real fixture corpus described in
docs/03-rep-detection.md -- recorded video of real people is the only thing
that proves accuracy in the field. They exist so the *logic* (thresholds,
guards, backfill, calibration drift) is regression-tested from day one, and so
the Swift engine can be proven to agree with the reference implementation.

The body is modelled side-on, driven by a target elbow-angle profile so every
clip has exact ground truth for depth as well as count.
"""

from __future__ import annotations

import math
import random

FPS = 15.0
UPPER_ARM = 0.16
FOREARM = 0.16
WRIST = (0.66, 0.05)
SHOULDER_X = 0.62
ANKLE = (0.15, 0.03)
HIP_X = 0.40
HIP_FRACTION = (HIP_X - ANKLE[0]) / (SHOULDER_X - ANKLE[0])

JOINT_NAMES = [
    "left_shoulder", "left_elbow", "left_wrist", "left_hip", "left_knee", "left_ankle",
    "right_shoulder", "right_elbow", "right_wrist", "right_hip", "right_knee", "right_ankle",
]


def shoulder_for_angle(theta_deg, wrist=WRIST, shoulder_x=SHOULDER_X):
    """Shoulder position that produces the requested elbow angle."""
    th = math.radians(theta_deg)
    d2 = UPPER_ARM ** 2 + FOREARM ** 2 - 2 * UPPER_ARM * FOREARM * math.cos(th)
    d = math.sqrt(max(d2, 0.0))
    dx = shoulder_x - wrist[0]
    dy2 = d * d - dx * dx
    return (shoulder_x, wrist[1] + math.sqrt(max(dy2, 1e-6)))


def elbow_position(shoulder, wrist):
    """Two-bone IK. The elbow flares toward the feet, as it does in a push-up."""
    dx, dy = wrist[0] - shoulder[0], wrist[1] - shoulder[1]
    d = math.hypot(dx, dy)
    d = min(d, UPPER_ARM + FOREARM - 1e-6)
    a = (UPPER_ARM ** 2 - FOREARM ** 2 + d * d) / (2 * d)
    h = math.sqrt(max(UPPER_ARM ** 2 - a * a, 0.0))
    ux, uy = dx / d, dy / d
    base = (shoulder[0] + a * ux, shoulder[1] + a * uy)
    return (base[0] - h * uy, base[1] + h * ux)


def body_from_shoulder(shoulder, sag=0.0):
    hip_y = ANKLE[1] + HIP_FRACTION * (shoulder[1] - ANKLE[1]) - sag
    hip = (HIP_X, hip_y)
    knee = ((HIP_X + ANKLE[0]) / 2, (hip_y + ANKLE[1]) / 2)
    return hip, knee


def frame(theta_deg, sag=0.0, wrist=WRIST, shoulder_x=SHOULDER_X,
          noise=0.0035, near_conf=0.88, far_conf=0.42, rng=random):
    shoulder = shoulder_for_angle(theta_deg, wrist, shoulder_x)
    elbow = elbow_position(shoulder, wrist)
    hip, knee = body_from_shoulder(shoulder, sag)

    def jitter(p, conf):
        return (p[0] + rng.gauss(0, noise), p[1] + rng.gauss(0, noise), conf)

    near = {
        "left_shoulder": jitter(shoulder, near_conf),
        "left_elbow": jitter(elbow, near_conf),
        "left_wrist": jitter(wrist, near_conf),
        "left_hip": jitter(hip, near_conf),
        "left_knee": jitter(knee, near_conf),
        "left_ankle": jitter(ANKLE, near_conf),
    }
    # The far side is occluded by the body: noisier and much less confident.
    far = {
        name.replace("left", "right"): (p[0] + rng.gauss(0, noise * 3),
                                        p[1] + rng.gauss(0, noise * 3), far_conf)
        for name, p in near.items()
    }
    return {**near, **far}


def rep_profile(top, bottom, period, hold_top=0.0, hold_bottom=0.0):
    """Angle over one rep: top -> bottom -> top, with optional holds."""
    def theta(u):  # u in [0, 1] over the moving portion
        mid, amp = (top + bottom) / 2, (top - bottom) / 2
        return mid + amp * math.cos(2 * math.pi * u)
    return theta, period, hold_top, hold_bottom


def build(reps, noise=0.0035, sag=0.0, seed=7, dropout=None, wrist_motion=False,
          flicker=0.0, weak_joints=()):
    """Render a list of rep specs into (t, joints) frames at FPS.

    Each spec: dict(top=, bottom=, period=, hold_top=, hold_bottom=, sag=)
    """
    rng = random.Random(seed)
    frames = []
    t = 0.0
    dt = 1.0 / FPS

    def emit(theta, local_sag, moving_wrist=None):
        nonlocal t
        w = moving_wrist or WRIST
        joints = frame(theta, sag=local_sag, wrist=w, noise=noise, rng=rng)
        if dropout and dropout[0] <= t <= dropout[1]:
            joints = {k: (v[0], v[1], 0.05) for k, v in joints.items()}
        # Brief single-frame dropouts, which is how real pose tracking behaves
        # on a distant or dimly lit subject: the skeleton is visible but blinks.
        elif flicker and rng.random() < flicker:
            joints = {k: (v[0], v[1], 0.05) for k, v in joints.items()}
        # Individual joints Vision reports but is unsure about - occluded by
        # the body, hidden by clothing, or simply far away.
        for name in weak_joints:
            if name in joints:
                x, y, _ = joints[name]
                joints[name] = (x, y, 0.12)
        frames.append((round(t, 4), joints))
        t += dt

    # Settle: a second of plank before anything happens.
    for _ in range(int(FPS)):
        emit(reps[0].get("top", 165.0), sag)

    for spec in reps:
        top = spec.get("top", 165.0)
        bottom = spec.get("bottom", 80.0)
        period = spec.get("period", 2.0)
        hold_top = spec.get("hold_top", 0.25)
        hold_bottom = spec.get("hold_bottom", 0.0)
        local_sag = spec.get("sag", sag)
        mid, amp = (top + bottom) / 2, (top - bottom) / 2

        steps = max(int(period * FPS), 2)
        for i in range(steps):
            u = i / steps
            theta = mid + amp * math.cos(2 * math.pi * u)
            if hold_bottom and abs(u - 0.5) < 1e-9:
                pass
            emit(theta, local_sag)
            if hold_bottom and i == steps // 2:
                for _ in range(int(hold_bottom * FPS)):
                    emit(bottom, local_sag)
        for _ in range(int(hold_top * FPS)):
            emit(top, local_sag)

    for _ in range(int(FPS)):
        emit(reps[-1].get("top", 165.0), sag)
    return frames


def build_arm_bend_only(count_cycles=6, seed=11):
    """Negative clip: elbows flexing with the body going nowhere.

    Someone sitting on the floor pushing an object, or waving. The elbow angle
    sweeps a full push-up range, so angle alone would count these as reps --
    the vertical-travel guard is the only thing that rejects them.
    """
    rng = random.Random(seed)
    frames, t, dt = [], 0.0, 1.0 / FPS
    shoulder = shoulder_for_angle(165.0)
    for _ in range(int(FPS)):
        joints = frame(165.0, noise=0.003, rng=rng)
        frames.append((round(t, 4), joints)); t += dt
    for _ in range(count_cycles):
        steps = int(2.0 * FPS)
        for i in range(steps):
            u = i / steps
            # Move the *wrist* toward the shoulder; the shoulder never drops.
            reach = 0.30 + 0.09 * math.cos(2 * math.pi * u)
            wrist = (shoulder[0] + 0.04, shoulder[1] - reach)
            elbow = elbow_position(shoulder, wrist)
            hip, knee = body_from_shoulder(shoulder)

            def j(p, c=0.88):
                return (p[0] + rng.gauss(0, 0.003), p[1] + rng.gauss(0, 0.003), c)

            near = {
                "left_shoulder": j(shoulder), "left_elbow": j(elbow), "left_wrist": j(wrist),
                "left_hip": j(hip), "left_knee": j(knee), "left_ankle": j(ANKLE),
            }
            far = {k.replace("left", "right"): (v[0], v[1], 0.40) for k, v in near.items()}
            frames.append((round(t, 4), {**near, **far})); t += dt
    return frames


def rotate(frames, degrees, about=(0.5, 0.5)):
    """Rotate every joint about a point, as a differently-propped phone would.

    The engine must not care. Any dependence on the image's x or y axis shows
    up here as a changed count, which is exactly the bug that shipped: the
    travel guard measured a drop along image-y, so a phone lying on a floor -
    where iOS reports no meaningful orientation - measured a push-up's descent
    as sideways movement and rejected every rep.
    """
    th = math.radians(degrees)
    cos_t, sin_t = math.cos(th), math.sin(th)
    ox, oy = about

    def spin(p):
        dx, dy = p[0] - ox, p[1] - oy
        return (ox + dx * cos_t - dy * sin_t, oy + dx * sin_t + dy * cos_t, p[2])

    return [(t, {name: spin(p) for name, p in joints.items()}) for t, joints in frames]
