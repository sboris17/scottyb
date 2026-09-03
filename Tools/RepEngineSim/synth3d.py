"""
A push-up modelled in three dimensions, so it can be filmed from any angle.

The existing synth.py draws the body flat and side-on, which is fine for
exercising thresholds but cannot answer the question this file exists for:
what survives when the phone is in front of you rather than beside you?

Side-on is the placement the engine was designed around and the one a person
is least able to use, because the screen ends up several feet away pointing at
a wall. Every other placement has to be measured rather than assumed, so the
body here is built once in world space and projected through a real pinhole
camera at whatever azimuth is asked for.

Axes, in metres:

    X   along the floor from hands (0) toward the feet
    Y   across the body, +Y out to the person's left
    Z   up from the floor

Azimuth 0 puts the camera off the head end looking down the body; azimuth 90
puts it out to the side. Everything in between is a real placement somebody
might reasonably choose.
"""

from __future__ import annotations

import math

FPS = 15.0

UPPER_ARM = 0.30
FOREARM = 0.30
HAND_HALF_WIDTH = 0.22      # hands a little wider than the shoulders
SHOULDER_HALF_WIDTH = 0.20
HIP_HALF_WIDTH = 0.12
ANKLE = (1.45, 0.10)        # toes: X along the floor, Z off it
SHOULDER_X_AT_TOP = 0.10    # shoulders sit slightly behind the hands
HIP_FRACTION = 0.45         # along the shoulder-to-ankle line
KNEE_FRACTION = 0.72

JOINT_NAMES = [
    "left_shoulder", "left_elbow", "left_wrist", "left_hip", "left_knee", "left_ankle",
    "right_shoulder", "right_elbow", "right_wrist", "right_hip", "right_knee", "right_ankle",
]


# --------------------------------------------------------------------------
# Body
# --------------------------------------------------------------------------

def _shoulder_height(theta_deg, dx, dy):
    """Shoulder height above the floor for a given elbow angle.

    The shoulder-to-wrist distance follows from the elbow angle by the cosine
    rule; the height is whatever is left once the horizontal offset from the
    hand is taken out.
    """
    th = math.radians(theta_deg)
    d2 = UPPER_ARM ** 2 + FOREARM ** 2 - 2 * UPPER_ARM * FOREARM * math.cos(th)
    return math.sqrt(max(d2 - dx * dx - dy * dy, 1e-6))


_TOP_SHOULDER_Z = _shoulder_height(170.0, SHOULDER_X_AT_TOP, HAND_HALF_WIDTH - SHOULDER_HALF_WIDTH)
_BODY_LENGTH = math.hypot(ANKLE[0] - SHOULDER_X_AT_TOP, _TOP_SHOULDER_Z - ANKLE[1])


def _elbow(shoulder, wrist, out_sign, flare_deg=44.0):
    """Two-bone IK with the elbow flaring back toward the feet and outward.

    `flare_deg` is how far the elbow goes out to the side rather than straight
    back: near 0 is a tucked, triceps-style push-up, 60+ is elbows wide. It is
    a parameter because how much of the arm's movement lands in the camera's
    image plane depends on it, and so therefore does the best placement.
    """
    vx, vy, vz = (wrist[0] - shoulder[0], wrist[1] - shoulder[1], wrist[2] - shoulder[2])
    d = math.sqrt(vx * vx + vy * vy + vz * vz)
    d = min(d, UPPER_ARM + FOREARM - 1e-6)
    a = (UPPER_ARM ** 2 - FOREARM ** 2 + d * d) / (2 * d)
    h = math.sqrt(max(UPPER_ARM ** 2 - a * a, 0.0))
    ux, uy, uz = vx / d, vy / d, vz / d
    base = (shoulder[0] + a * ux, shoulder[1] + a * uy, shoulder[2] + a * uz)

    # Flare toward the feet and away from the midline, the way a push-up elbow
    # actually goes; then take out any component along the arm.
    fr = math.radians(flare_deg)
    fx, fy, fz = math.cos(fr), math.sin(fr) * out_sign, 0.0
    dot = fx * ux + fy * uy + fz * uz
    px, py, pz = fx - dot * ux, fy - dot * uy, fz - dot * uz
    plen = math.sqrt(px * px + py * py + pz * pz) or 1.0
    return (base[0] + h * px / plen, base[1] + h * py / plen, base[2] + h * pz / plen)


def body(theta_deg, sag=0.0, flare_deg=44.0):
    """Every joint in world space at a given elbow angle."""
    side_offset = HAND_HALF_WIDTH - SHOULDER_HALF_WIDTH
    shoulder_z = _shoulder_height(theta_deg, SHOULDER_X_AT_TOP, side_offset)

    # The body is rigid from shoulder to toes and pivots about the toes, so
    # dropping the shoulder tips the whole body forward.
    reach = math.sqrt(max(_BODY_LENGTH ** 2 - (shoulder_z - ANKLE[1]) ** 2, 1e-6))
    shoulder_x = ANKLE[0] - reach

    joints = {}
    for name, sign in (("left", 1.0), ("right", -1.0)):
        shoulder = (shoulder_x, sign * SHOULDER_HALF_WIDTH, shoulder_z)
        wrist = (0.0, sign * HAND_HALF_WIDTH, 0.03)
        hip_x = shoulder_x + HIP_FRACTION * (ANKLE[0] - shoulder_x)
        hip_z = shoulder_z + HIP_FRACTION * (ANKLE[1] - shoulder_z) - sag
        knee_x = shoulder_x + KNEE_FRACTION * (ANKLE[0] - shoulder_x)
        knee_z = shoulder_z + KNEE_FRACTION * (ANKLE[1] - shoulder_z) - sag * 0.4
        joints[f"{name}_shoulder"] = shoulder
        joints[f"{name}_elbow"] = _elbow(shoulder, wrist, sign, flare_deg)
        joints[f"{name}_wrist"] = wrist
        joints[f"{name}_hip"] = (hip_x, sign * HIP_HALF_WIDTH, hip_z)
        joints[f"{name}_knee"] = (knee_x, sign * HIP_HALF_WIDTH, knee_z)
        joints[f"{name}_ankle"] = (ANKLE[0], sign * HIP_HALF_WIDTH, ANKLE[1])
    return joints


# --------------------------------------------------------------------------
# Camera
# --------------------------------------------------------------------------

class Camera:
    """A pinhole camera placed on a circle around the body.

    Azimuth is in degrees: 0 looks down the body from the head end, 90 looks
    at it from the side. Height is metres off the floor, which is the other
    thing a person gets to choose when they prop a phone up.
    """

    def __init__(self, azimuth_deg, distance=0.95, height=0.35, focal=1.0):
        self.target = (0.55, 0.0, 0.30)
        phi = math.radians(azimuth_deg)
        self.pos = (self.target[0] - distance * math.cos(phi),
                    self.target[1] + distance * math.sin(phi),
                    height)
        self.focal = focal

        fx, fy, fz = (self.target[0] - self.pos[0],
                      self.target[1] - self.pos[1],
                      self.target[2] - self.pos[2])
        fl = math.sqrt(fx * fx + fy * fy + fz * fz)
        self.fwd = (fx / fl, fy / fl, fz / fl)
        # Right = forward x world-up, then up = right x forward.
        rx, ry, rz = self.fwd[1] * 1.0 - 0.0, 0.0 - self.fwd[0] * 1.0, 0.0
        rl = math.hypot(rx, ry) or 1.0
        self.right = (rx / rl, ry / rl, 0.0)
        self.up = (self.right[1] * self.fwd[2] - self.right[2] * self.fwd[1],
                   self.right[2] * self.fwd[0] - self.right[0] * self.fwd[2],
                   self.right[0] * self.fwd[1] - self.right[1] * self.fwd[0])

    def project(self, point):
        """World point to normalised image coordinates, y pointing down."""
        vx, vy, vz = (point[0] - self.pos[0], point[1] - self.pos[1], point[2] - self.pos[2])
        depth = vx * self.fwd[0] + vy * self.fwd[1] + vz * self.fwd[2]
        depth = max(depth, 1e-3)
        u = (vx * self.right[0] + vy * self.right[1] + vz * self.right[2]) / depth
        v = (vx * self.up[0] + vy * self.up[1] + vz * self.up[2]) / depth
        return (0.5 + self.focal * u * 0.5, 0.5 - self.focal * v * 0.5, depth)

    def in_frame(self, point):
        """A joint projected outside the picture is not seen at all.

        Worth modelling rather than ignoring: it is the thing that punishes
        putting the phone too close, which is a mistake a person makes for a
        good reason - wanting to read the screen.
        """
        x, y, depth = self.project(point)
        return depth > 0.15 and 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0

    def visibility(self, point, other_side_point):
        """Rough occlusion: a joint hidden behind the torso is seen poorly.

        Filmed side-on the two sides of the body sit almost on top of each
        other and the far one is largely hidden, which is why the engine picks
        a side at all. Filmed head-on both sides are equally in view - the one
        thing that placement is unambiguously better at.
        """
        if not self.in_frame(point):
            return 0.0
        near = self.project(point)[2]
        far = self.project(other_side_point)[2]
        if near <= far:
            return 0.88
        # Behind the body. How badly hidden depends on how far behind.
        gap = near - far
        return max(0.10, 0.88 - 2.2 * gap)
