"""
Replay real recorded sets against the counting engine.

    python3 Tools/RepEngineSim/replay.py clips/*.json
    python3 Tools/RepEngineSim/replay.py clips/*.json --why
    python3 Tools/RepEngineSim/replay.py clips/*.json --sweep MIN_BODY_TRAVEL

This is the point of the recorder. Every counting problem before it was chased
by asking somebody to do push-ups, guessing, shipping a build and waiting - days
per iteration, paid for in press-ups. Worse, the guessing was done against a
synthetic body whose projected elbow swing disagreed with a real device by a
factor of three.

With clips, a change is measured in seconds against movement that actually
happened. A threshold that fixes one clip and breaks two others says so
immediately, which is the failure mode that matters: the engine has been tuned
into a corner more than once by a change that looked like an improvement
against a single case.

Recordings carry `expectedReps` (what the person said they really did) and
`countedAtRecording` (what the app thought at the time), so a clip is a record
of the miss as well as the truth.
"""

from __future__ import annotations

import glob
import json
import sys

import repengine


def load(path):
    with open(path) as handle:
        return json.load(handle)


def frames_of(clip):
    """Fixture rows back into the (time, joints) shape the engine consumes."""
    names = clip["joints"]
    out = []
    for row in clip["frames"]:
        joints = {}
        for i, name in enumerate(names):
            base = 1 + i * 3
            if base + 2 < len(row):
                joints[name] = (row[base], row[base + 1], row[base + 2])
        out.append((row[0], joints))
    return out


def run(clip):
    interpreter = repengine.PoseInterpreter()
    counter = repengine.RepCounter()

    usable = 0
    angles = []
    confidences = []
    frames = frames_of(clip)

    for t, joints in frames:
        sample = interpreter.sample(t, joints)
        if sample.confident:
            usable += 1
            angles.append(sample.elbow_angle)
        # The weakest joint the frame needed, which is the gate that silently
        # discards frames and the number no device screenshot ever showed.
        needed = [joints.get(n, (0, 0, 0))[2] for n in
                  ("left_shoulder", "left_elbow", "left_wrist", "left_hip",
                   "right_shoulder", "right_elbow", "right_wrist", "right_hip")]
        confidences.append(max(needed) if needed else 0.0)
        counter.process(sample)

    rejections = {}
    for rejection in counter.rejections:
        key = getattr(rejection, "value", str(rejection))
        rejections[key] = rejections.get(key, 0) + 1

    return {
        "counted": len(counter.reps),
        "expected": clip.get("expectedReps", 0),
        "on_device": clip.get("countedAtRecording"),
        "frames": len(frames),
        "usable": usable / len(frames) if frames else 0.0,
        "span": (max(angles) - min(angles)) if angles else 0.0,
        "confidence": sum(confidences) / len(confidences) if confidences else 0.0,
        "rejections": rejections,
        "seconds": frames[-1][0] - frames[0][0] if len(frames) > 1 else 0.0,
    }


def report(paths, explain=False):
    print(f"\n  {'clip':<34} {'real':>5} {'got':>5} {'phone':>6} "
          f"{'frames':>7} {'span':>7}  verdict")
    print("  " + "-" * 84)

    total_error = 0
    total_expected = 0
    for path in paths:
        clip = load(path)
        result = run(clip)
        name = clip.get("name", path.split("/")[-1])[:34]
        error = abs(result["counted"] - result["expected"])
        total_error += error
        total_expected += result["expected"]

        verdict = "exact" if error == 0 else f"off by {error}"
        phone = "-" if result["on_device"] is None else str(result["on_device"])
        print(f"  {name:<34} {result['expected']:>5} {result['counted']:>5} "
              f"{phone:>6} {result['usable']*100:>6.0f}% {result['span']:>6.0f}°  {verdict}")

        if explain:
            note = clip.get("note", "")
            if note:
                print(f"      note: {note}")
            print(f"      {result['seconds']:.0f}s, mean joint confidence "
                  f"{result['confidence']:.2f} (gate {repengine.MIN_JOINT_CONFIDENCE})")
            if result["rejections"]:
                pairs = ", ".join(f"{k} x{v}" for k, v in sorted(result["rejections"].items()))
                print(f"      rejected: {pairs}")

    if total_expected:
        accuracy = 1 - total_error / total_expected
        print("  " + "-" * 84)
        print(f"  {total_error} miscounted of {total_expected}  "
              f"({accuracy * 100:.1f}% accurate over {len(paths)} clips)")
        # The gate the roadmap sets, measured where it said to measure it.
        print(f"  ship gate is 98% on real recordings: "
              f"{'PASS' if accuracy >= 0.98 else 'NOT YET'}")


def sweep(paths, knob):
    """Try a range of values for one threshold across every clip at once.

    Tuning against a single clip is how the engine got tuned into a corner
    before. A value is only better if the total improves.
    """
    original = getattr(repengine, knob)
    print(f"\n  Sweeping {knob} (currently {original}) over {len(paths)} clips\n")
    clips = [load(p) for p in paths]

    if isinstance(original, int) and not isinstance(original, bool):
        values = [max(0, original + d) for d in range(-3, 4)]
    else:
        values = [round(original * f, 4) for f in (0.4, 0.6, 0.8, 1.0, 1.25, 1.6, 2.2)]

    # Seeded with the current value, and only replaced by something strictly
    # better. A tie is not a reason to move a threshold: every loosening buys
    # a false positive somewhere the clips do not cover.
    setattr(repengine, knob, original)
    baseline = sum(abs(run(c)["counted"] - c.get("expectedReps", 0)) for c in clips)
    best = (original, baseline)

    for value in values:
        setattr(repengine, knob, value)
        error = sum(abs(run(c)["counted"] - c.get("expectedReps", 0)) for c in clips)
        mark = "  <- current" if value == original else ""
        print(f"    {value:>10}  {error:>3} miscounted{mark}")
        if error < best[1]:
            best = (value, error)
    setattr(repengine, knob, original)

    if best[0] != original:
        print(f"\n  Best here: {knob} = {best[0]} ({best[1]} miscounted)")
        print("  Check it against the synthetic suite before keeping it:")
        print("      python3 Tools/RepEngineSim/run.py")
    else:
        print(f"\n  Nothing here beats {knob} = {original} ({baseline} miscounted)." )


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    paths = sorted(p for pattern in args for p in glob.glob(pattern))
    if not paths:
        print(__doc__)
        print("No clips given. Point it at the JSON files sent from the app.")
        raise SystemExit(1)

    if "--sweep" in sys.argv:
        knob = sys.argv[sys.argv.index("--sweep") + 1]
        sweep(paths, knob)
    else:
        report(paths, explain="--why" in sys.argv)
