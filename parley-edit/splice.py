#!/usr/bin/env python3
"""Drop real footage into the PARLEY CLIP slots.

`build.py` renders the full cut with designed placeholder slates wherever a
`parley` clip belongs. Put your own files in `clips/` as `parley01.mp4`,
`parley02.mp4`, ... and this replaces the matching slate in place: each clip is
letterboxed to the project's frame, held or trimmed to the slot's exact length
so the rest of the timeline never shifts, and mixed over the ducked score.

    python3 splice.py                       # splice every clip present
    python3 splice.py --score-under 0.15    # push the score further down

Slots with no file keep their slate, so you can drop clips in one at a time.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
FF = imageio_ffmpeg.get_ffmpeg_exe()

def run(args):
    p = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y"] + args,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        sys.exit("ffmpeg failed:\n  %s\n%s" % (" ".join(args), p.stderr.decode()[-2000:]))

def probe(path):
    p = subprocess.run([FF, "-hide_banner", "-i", path],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    info = p.stderr.decode("utf-8", "replace")
    dur = None
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
    if m:
        dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return {"audio": bool(re.search(r"Stream #.*: Audio:", info)), "dur": dur}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(HERE, "config.json"))
    ap.add_argument("--base", default=os.path.join(HERE, "out", "parley_edit.mp4"))
    ap.add_argument("--clips", default=os.path.join(HERE, "clips"))
    ap.add_argument("--out", default=os.path.join(HERE, "out", "parley_edit_final.mp4"))
    ap.add_argument("--score-under", type=float, default=0.22,
                    help="score level under a spliced clip (0 = silent, 1 = full)")
    a = ap.parse_args()

    cfg = json.load(open(a.config))
    m = cfg["meta"]
    W, H, FPS = m["width"], m["height"], m["fps"]
    if not os.path.exists(a.base):
        sys.exit("no base cut at %s — run build.py first" % a.base)

    # rebuild the timeline exactly as build.py laid it out
    segs, t = [], 0.0
    for s in cfg["timeline"]:
        s = dict(s); s["t0"], s["t1"] = t, t + s["dur"]; t += s["dur"]
        segs.append(s)

    FIT = ("fps={fps},scale={w}:{h}:force_original_aspect_ratio=decrease,"
           "pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1").format(fps=FPS, w=W, h=H)
    VENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "25", "-pix_fmt", "yuv420p"]
    AENC = ["-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2"]

    work = tempfile.mkdtemp(prefix="parley-splice-")
    parts, spliced, missing = [], [], []
    try:
        for i, s in enumerate(segs):
            dst = os.path.join(work, "%03d.mp4" % i)
            clip = None
            if s["type"] == "slate":
                for ext in (".mp4", ".mov", ".m4v", ".mkv", ".webm"):
                    cand = os.path.join(a.clips, "parley%02d%s" % (s["slot"], ext))
                    if os.path.exists(cand):
                        clip = cand
                        break
                if clip is None:
                    missing.append(s["slot"])

            if clip is None:
                # keep the rendered segment (slate or regular scene) as-is
                run(["-ss", "%.3f" % s["t0"], "-i", a.base, "-t", "%.3f" % s["dur"],
                     "-vf", FIT, "-af", "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo"]
                    + VENC + AENC + [dst])
            else:
                info = probe(clip)
                if info["dur"] and info["dur"] < s["dur"] - 0.05:
                    print("  note: parley%02d is %.1fs for a %.1fs slot — holding the last frame"
                          % (s["slot"], info["dur"], s["dur"]))
                vf = ("[0:v]" + FIT + ",tpad=stop_mode=clone:stop_duration=%.3f[v]" % s["dur"])
                if info["audio"]:
                    af = ("[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
                          "apad[a0];"
                          "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
                          "volume=%.3f[a1];"
                          "[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,"
                          "alimiter=limit=0.95[a]" % a.score_under)
                else:
                    af = ("[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,"
                          "apad[a]")
                run(["-i", clip, "-ss", "%.3f" % s["t0"], "-t", "%.3f" % s["dur"], "-i", a.base,
                     "-filter_complex", vf + ";" + af, "-map", "[v]", "-map", "[a]",
                     "-t", "%.3f" % s["dur"]] + VENC + AENC + [dst])
                spliced.append(s["slot"])
            parts.append(dst)
            print("  [%2d/%2d] %-10s %6.2fs %s" % (i + 1, len(segs), s["type"], s["dur"],
                                                   os.path.basename(clip) if clip else ""))

        lst = os.path.join(work, "concat.txt")
        with open(lst, "w") as f:
            for p in parts:
                f.write("file '%s'\n" % p)
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
             "-movflags", "+faststart", a.out])
    finally:
        shutil.rmtree(work, ignore_errors=True)

    print("\nwrote %s" % a.out)
    print("spliced: %s" % (", ".join("parley%02d" % s for s in spliced) or "nothing"))
    if missing:
        print("still on slates: %s" % ", ".join("PARLEY CLIP %02d" % s for s in missing))

if __name__ == "__main__":
    main()
