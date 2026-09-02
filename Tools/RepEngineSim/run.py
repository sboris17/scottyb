"""Run every scenario through the reference engine and report accuracy.

    python3 Tools/RepEngineSim/run.py            # report only
    python3 Tools/RepEngineSim/run.py --export   # also write Swift test fixtures
"""

from __future__ import annotations

import json
import os
import sys

import repengine
import synth

OUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..",
    "Packages", "RepEngine", "Tests", "RepEngineTests", "Fixtures",
)


def reps(n, **kw):
    return [dict(**kw) for _ in range(n)]


SCENARIOS = [
    # name, expected reps, builder(seed), note
    ("standard_10", 10,
     lambda s=7: synth.build(reps(10, top=165, bottom=80, period=2.0), seed=s),
     "Textbook set: full depth, steady tempo."),

    ("shallow_10", 10,
     lambda s=7: synth.build(reps(10, top=160, bottom=118, period=1.8), seed=s),
     "Never crosses a fixed 100-degree bottom. Fixed thresholds score 0 here."),

    ("very_shallow_8", 8,
     lambda s=7: synth.build(reps(8, top=158, bottom=128, period=1.7), seed=s),
     "Barely-there range of motion. Still the user's honest reps."),

    ("slow_deep_8", 8,
     lambda s=7: synth.build(reps(8, top=170, bottom=72, period=3.4), seed=s),
     "Slow controlled tempo."),

    ("fast_15", 15,
     lambda s=7: synth.build(reps(15, top=162, bottom=88, period=0.95, hold_top=0.1), seed=s),
     "Fast but legitimate; must clear the minimum-duration guard."),

    ("fatigue_12", 12,
     lambda s=7: synth.build(reps(8, top=166, bottom=82, period=2.0)
                             + reps(4, top=160, bottom=126, period=2.4), seed=s),
     "Depth collapses late in the set. Calibration must follow the user down."),

    ("sagging_back_10", 10,
     lambda s=7: synth.build(reps(10, top=165, bottom=85, period=2.1), sag=0.055, seed=s),
     "Hips dropping. Counts every rep and raises a form hint."),

    ("pause_at_bottom_6", 6,
     lambda s=7: synth.build(reps(6, top=166, bottom=78, period=2.0, hold_bottom=2.5), seed=s),
     "Long hold at the bottom, still inside the 12s ceiling."),

    ("dropout_8_of_10", 8,
     lambda s=7: synth.build(reps(10, top=165, bottom=80, period=2.0),
                             dropout=(10.05, 14.45), seed=s),
     "Tracking lost for ~5s. Must lose only what it could not see, never invent."),

    ("noisy_10", 10,
     lambda s=7: synth.build(reps(10, top=164, bottom=84, period=2.0), noise=0.011, seed=s),
     "Heavy pose jitter, e.g. loose clothing or a busy background."),

    # --- negatives: any count above zero here is a trust-destroying bug ---
    ("negative_idle_plank", 0,
     lambda s=7: synth.build(reps(1, top=166, bottom=164, period=8.0), seed=s),
     "Holding a plank. No reps."),

    ("negative_arm_bend", 0,
     lambda s=7: synth.build_arm_bend_only(6, seed=s),
     "Full-range elbow flexion with no body travel. The guard that matters."),

    ("negative_noisy_idle", 0,
     lambda s=7: synth.build(reps(2, top=166, bottom=163, period=8.0), noise=0.011, seed=s),
     "Resting in a plank with heavy tracking jitter. The hardest negative."),

    ("negative_bouncing", 0,
     lambda s=7: synth.build(reps(8, top=165, bottom=80, period=0.34, hold_top=0.0), seed=s),
     "Physically impossible tempo: twitching, not push-ups."),
]


def sweep(trials=25):
    """Re-run every scenario across many noise seeds.

    A single passing seed proves very little -- the thresholds could simply be
    fitted to one noise realisation. This is the check that they are not.
    """
    print(f"seed sweep: {trials} noise realisations per scenario\n")
    worst, total_fail, total_runs = [], 0, 0
    for name, expected, build, _ in SCENARIOS:
        fails, deltas = 0, []
        for s in range(1, trials + 1):
            got = len(repengine.count(build(s)).reps)
            total_runs += 1
            deltas.append(got - expected)
            if got != expected:
                fails += 1
                total_fail += 1
        span = f"{min(deltas):+d}..{max(deltas):+d}"
        status = "ok" if fails == 0 else f"{fails} FAIL"
        print(f"  {name:22} {status:>8}   delta {span}")
        if fails:
            worst.append(name)
    print(f"\n  {total_runs - total_fail}/{total_runs} runs exact"
          f"  ({100 * (total_runs - total_fail) / total_runs:.1f}%)")
    return 0 if total_fail == 0 else 1


def run_one(build):
    frames = build()
    counter = repengine.count(frames)
    return frames, counter


def main():
    if "--sweep" in sys.argv:
        return sweep()
    export = "--export" in sys.argv
    if export:
        os.makedirs(OUT_DIR, exist_ok=True)

    rows, total_err, total_expected, false_positives = [], 0, 0, 0
    for name, expected, build, note in SCENARIOS:
        frames, counter = run_one(build)
        got = len(counter.reps)
        err = abs(got - expected)
        total_err += err
        total_expected += expected
        if expected == 0 and got > 0:
            false_positives += got
        hints = [repengine.form_hint(r) for r in counter.reps]
        hint = next((h for h in hints if h), "-")
        rows.append((name, expected, got, "PASS" if got == expected else "FAIL",
                     f"{counter.thresholds.bottom:.0f}/{counter.thresholds.top:.0f}", hint, note))

        if export:
            payload = {
                "name": name,
                "note": note,
                "expectedReps": expected,
                "joints": synth.JOINT_NAMES,
                "frames": [
                    [round(t, 4)] + [round(v, 5) for jn in synth.JOINT_NAMES
                                     for v in joints[jn]]
                    for t, joints in frames
                ],
            }
            with open(os.path.join(OUT_DIR, f"{name}.json"), "w") as f:
                json.dump(payload, f, separators=(",", ":"))

    w = max(len(r[0]) for r in rows)
    print(f"{'scenario'.ljust(w)}  exp  got  result  thresh    hint")
    print("-" * (w + 46))
    for name, exp, got, res, th, hint, _ in rows:
        print(f"{name.ljust(w)}  {exp:>3}  {got:>3}  {res:<6}  {th:<8}  {hint}")

    accuracy = 1 - (total_err / total_expected) if total_expected else 0
    passed = sum(1 for r in rows if r[3] == "PASS")
    print("-" * (w + 46))
    print(f"scenarios passed : {passed}/{len(rows)}")
    print(f"rep accuracy     : {accuracy * 100:.1f}%  ({total_err} miscounted of {total_expected})")
    print(f"false positives  : {false_positives}")
    if export:
        print(f"fixtures written : {os.path.abspath(OUT_DIR)}")
    return 0 if passed == len(rows) and false_positives == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
