"""
What does the counter still see as the phone moves around you?

The engine was built for a side-on camera, and side-on is the one placement
that puts the screen several feet away pointing at a wall. This sweeps the
camera around the body and measures, at each angle, what the engine actually
gets: how far the projected elbow angle still swings, how far the body appears
to travel, and how many reps come out.

    python3 Tools/RepEngineSim/angles.py
"""

from __future__ import annotations

import math
import random
import sys

import repengine
import synth3d


def clip(azimuth, count=10, top=168.0, bottom=82.0, period=2.0,
         height=0.35, distance=0.95, noise=0.004, seed=5, flare=44.0):
    """One set of push-ups filmed from a given azimuth."""
    rng = random.Random(seed)
    cam = synth3d.Camera(azimuth, distance=distance, height=height)
    frames = []
    t, dt = 0.0, 1.0 / synth3d.FPS

    def emit(theta):
        nonlocal t
        world = synth3d.body(theta, flare_deg=flare)
        joints = {}
        for name, point in world.items():
            side = "right" if name.startswith("left") else "left"
            twin = world[name.replace(name.split("_")[0], side, 1)]
            x, y, _ = cam.project(point)
            conf = cam.visibility(point, twin)
            joints[name] = (x + rng.gauss(0, noise), y + rng.gauss(0, noise), conf)
        frames.append((round(t, 4), joints))
        t += dt

    for _ in range(int(synth3d.FPS)):          # a second of stillness at the top
        emit(top)
    for _ in range(count):
        steps = max(int(period * synth3d.FPS / 2), 2)
        for i in range(steps):                 # down
            emit(top + (bottom - top) * (i + 1) / steps)
        for i in range(steps):                 # up
            emit(bottom + (top - bottom) * (i + 1) / steps)
    for _ in range(int(synth3d.FPS)):
        emit(top)
    return frames


def measure(azimuth, **kw):
    frames = clip(azimuth, **kw)
    interpreter = repengine.PoseInterpreter()
    counter = repengine.RepCounter()

    angles, usable, shoulder_ratio = [], 0, []
    for t, joints in frames:
        sample = interpreter.sample(t, joints)
        if sample.confident:
            usable += 1
            angles.append(sample.elbow_angle)
            ls, rs, lh = joints["left_shoulder"], joints["right_shoulder"], joints["left_hip"]
            torso = math.dist(ls[:2], lh[:2]) or 1e-6
            shoulder_ratio.append(abs(ls[0] - rs[0]) / torso)
        counter.process(sample)

    span = (max(angles) - min(angles)) if angles else 0.0
    return {
        "azimuth": azimuth,
        "counted": len(counter.reps),
        "span": span,
        "usable": usable / len(frames),
        "spread": sum(shoulder_ratio) / len(shoulder_ratio) if shoulder_ratio else 0.0,
    }


def table(rows, title):
    print(f"\n{title}")
    print(f"  {'camera':>8}  {'reps':>5}  {'elbow span':>11}  {'frames':>7}  "
          f"{'shoulders':>10}  verdict")
    print("  " + "-" * 66)
    for r in rows:
        expected = r.pop("expected", 10)
        if r["counted"] == expected:
            verdict = "counts"
        elif r["counted"] == 0:
            verdict = "NOTHING"
        else:
            verdict = f"{r['counted']}/{expected}"
        blocked = " (framing guard blocks)" if r["spread"] > 0.55 else ""
        print(f"  {r['azimuth']:>6}°  {r['counted']:>5}  {r['span']:>9.0f}°  "
              f"{r['usable']*100:>6.0f}%  {r['spread']:>10.2f}  {verdict}{blocked}")


if __name__ == "__main__":
    print("Ten push-ups, filmed from every angle. 90° is side-on (what the")
    print("engine was built for); 0° is straight down the body from the head.")

    rows = []
    for azimuth in (0, 15, 30, 45, 60, 75, 90):
        r = measure(azimuth)
        r["expected"] = 10
        rows.append(r)
    table(rows, "Camera 0.95 m away, 0.35 m off the floor")

    rows = []
    for height in (0.05, 0.20, 0.35, 0.60, 1.00):
        r = measure(90, height=height)
        r["expected"] = 10
        r["azimuth"] = int(height * 100)
        rows.append(r)
    print("\nSide-on, varying the height off the floor (cm, shown in the")
    print("camera column):")
    table(rows, "")

    if "--near" in sys.argv:
        rows = []
        for distance in (0.5, 0.7, 0.95, 1.3, 1.8):
            r = measure(90, distance=distance)
            r["expected"] = 10
            r["azimuth"] = int(distance * 100)
            rows.append(r)
        table(rows, "Side-on, varying distance (cm, in the camera column)")


def stress(azimuth, **kw):
    """Same angle, harder conditions. A placement is only worth recommending
    if it survives shallow reps and noisy tracking, not just the ideal set."""
    out = []
    for label, opts in (
        ("ideal",        dict()),
        ("shallow",      dict(top=160, bottom=120)),
        ("very shallow", dict(top=158, bottom=128)),
        ("noisy",        dict(noise=0.012)),
        ("fast",         dict(period=1.0)),
        ("shallow+noisy", dict(top=160, bottom=120, noise=0.012)),
    ):
        merged = dict(kw); merged.update(opts)
        r = measure(azimuth, **merged)
        out.append((label, r["counted"], r["span"]))
    return out


if "--stress" in sys.argv:
    print("\n\nHow much margin does each placement have?  (10 reps expected)")
    print(f"\n  {'condition':>14} " + "".join(f"{a:>10}°" for a in (0, 30, 45, 60, 90)))
    print("  " + "-" * 70)
    results = {a: dict((l, (c, s)) for l, c, s in stress(a)) for a in (0, 30, 45, 60, 90)}
    for label in ("ideal", "shallow", "very shallow", "noisy", "fast", "shallow+noisy"):
        cells = "".join(f"{results[a][label][0]:>11}" for a in (0, 30, 45, 60, 90))
        print(f"  {label:>14} {cells}")
    print(f"\n  {'elbow span':>14} " + "".join(
        f"{results[a]['ideal'][1]:>10.0f}°" for a in (0, 30, 45, 60, 90)))


if "--flare" in sys.argv:
    print("\n\nDoes the best placement depend on how wide the elbows go?")
    print("Ten shallow reps (160 to 120 degrees) - the case that separates them.")
    print(f"\n  {'elbows':>16} " + "".join(f"{a:>10}°" for a in (0, 30, 45, 60, 90)))
    print("  " + "-" * 72)
    for label, flare in (("tucked (15°)", 15), ("moderate (30°)", 30),
                         ("standard (44°)", 44), ("wide (60°)", 60), ("very wide (75°)", 75)):
        cells = ""
        for a in (0, 30, 45, 60, 90):
            r = measure(a, top=160, bottom=120, flare=flare)
            cells += f"{r['counted']:>11}"
        print(f"  {label:>16} {cells}")


if "--corner" in sys.argv:
    print("\n\nThe 45-degree corner placement, across everything a person varies.")
    print("Count out of 10, then the shoulder-spread ratio the framing guard")
    print("tests against 0.55 - over that and the app refuses to start.\n")
    for dist in (0.5, 0.7, 0.95, 1.3):
        row = []
        for height in (0.05, 0.20, 0.35, 0.60):
            worst, spread = 10, 0.0
            for flare in (15, 30, 44, 60, 75):
                for top, bottom, noise in ((168, 82, 0.004), (160, 120, 0.004),
                                           (158, 128, 0.004), (160, 120, 0.012)):
                    r = measure(45, distance=dist, height=height, flare=flare,
                                top=top, bottom=bottom, noise=noise)
                    worst = min(worst, r["counted"])
                    spread = max(spread, r["spread"])
            row.append(f"{worst:>2}/10 ({spread:.2f})")
        print(f"  {dist:>4.2f} m away:  " + "   ".join(row))
    print("\n  heights across:  0.05 m    0.20 m    0.35 m    0.60 m")


if "--breakdown" in sys.argv:
    print("\n\nWhich conditions survive where, with the picture's edges modelled.")
    print("Each cell: reps counted out of 10, worst across five elbow styles.\n")
    conds = (("full depth",   dict(top=168, bottom=82)),
             ("shallow",      dict(top=160, bottom=120)),
             ("very shallow", dict(top=158, bottom=128)),
             ("noisy",        dict(top=168, bottom=82, noise=0.012)))
    for dist in (0.7, 0.95, 1.3, 1.8):
        print(f"  --- phone {dist:.2f} m away ({dist*3.28:.1f} ft) ---")
        for label, opts in conds:
            cells = ""
            for az in (0, 30, 45, 60, 90):
                worst = min(measure(az, distance=dist, flare=f, **opts)["counted"]
                            for f in (15, 30, 44, 60, 75))
                cells += f"{worst:>9}"
            print(f"  {label:>14} {cells}")
        print()
    print(f"  {'':>14} " + "".join(f"{a:>8}°" for a in (0, 30, 45, 60, 90)))
