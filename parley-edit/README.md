# THE PARLEY — a Sunday Night Football parlay edit

A 53-second vertical (1080×1920) hype edit for a four-leg SNF parlay, cut
around the *Pirates of the Caribbean* "parley" bit. Everything — frames, score,
timing, EDL — is generated from `config.json`, so swapping in your real picks is
one file edit and one command.

```
out/parley_edit.mp4     the cut (renders in ~3 min)
config.json             picks, odds, stake, and the timeline
build.py                renders every frame + synthesizes the score + writes EDL.md
splice.py               swaps the placeholder slates for real footage
EDL.md                  auto-generated shot list with real timecodes
clips/                  where your own parley clips go (git-ignored)
```

## About the Pirates clips

**No copyrighted footage is included, and none is downloaded.** Where each
parley clip belongs, the cut plays a designed slate — labelled `PARLEY CLIP 01`,
with the line, the character, the source, a direction note and a countdown bar —
so the video is watchable end to end and the joke reads on its own. The four
slots are fully specified in `EDL.md`.

To use the real thing, supply clips you have the right to use, drop them in
`clips/` as `parley01.mp4`…`parley04.mp4`, and run `splice.py`. Each clip gets
letterboxed to frame, held or trimmed to the slot's exact length (so nothing
downstream shifts), and mixed over the score ducked to 22%.

## Build it

```bash
pip install imageio-ffmpeg pillow numpy
python3 build.py                 # -> out/parley_edit.mp4 + EDL.md
python3 splice.py                # -> out/parley_edit_final.mp4, once clips/ has files
```

No system ffmpeg needed — `imageio-ffmpeg` ships a static binary.

## Swap in your picks

Edit `legs` in `config.json`. Parlay math is **computed, not hardcoded**:
American odds → decimal per leg, multiplied out, so the running ticket odds on
each leg card, the combined price and the payout counter all follow whatever you
put in. The picks that ship are placeholders.

```json
{ "pick": "CHIEFS -3.5", "market": "SPREAD", "odds": "-110", "note": "primetime, at home, rested" }
```

Re-run `build.py`. Legs are added or removed freely — add a matching
`{ "type": "leg", "index": N }` entry to `timeline` and the cards, pips and
ticket all follow.

## Retiming

`timeline` is the cut, in order, with each entry's `dur` in seconds. Reorder,
restretch or drop scenes there; `EDL.md` regenerates from the real result. Scene
types: `cold_open`, `title`, `slate`, `code`, `leg`, `ticket`, `outro`.

## How it's made

- **Picture** — every frame composed in Pillow: sea-gradient and lantern falloff
  in numpy, procedurally torn parchment, gold rules, a slam-in title, per-leg
  cards with a ghosted numeral and a counting ticket odometer, plus film grain,
  a vignette, and a punch-in + flash on each cut. Drawing goes onto a
  transparent layer and composites once, because `ImageDraw.Draw(im, "RGBA")`
  silently ignores alpha on text.
- **Sound** — original score synthesized in numpy: 84 BPM half-time kit, D-minor
  sub bass, a plucked motif, and impacts and risers placed on the actual scene
  boundaries, so the hits land on the cuts no matter how you retime.
- **Delivery** — raw RGB piped straight to x264, AAC audio, `+faststart`.

## Landscape instead of vertical

Set `width`/`height` in `config.json` to `1920`/`1080`. Layout is proportional,
though the leg cards are composed for a tall frame and will want their font
sizes revisited.

21+. Entertainment only. Problem gambling? Call 1-800-GAMBLER.
