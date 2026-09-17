#!/usr/bin/env python3
"""Build the Sunday Night Football 'Parley' edit.

Renders every frame with Pillow, synthesizes the score with numpy, muxes with
ffmpeg, and writes an EDL whose timecodes come from the real timeline.

    python3 build.py [--config config.json] [--out out/parley_edit.mp4]
"""
import argparse, json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- look & feel
INK        = (8, 10, 14)
GOLD       = (227, 178, 60)
GOLD_DIM   = (138, 106, 34)
PARCHMENT  = (238, 224, 192)
BLOOD      = (168, 32, 38)
SEA        = (18, 38, 52)
WHITE      = (245, 245, 240)
GREEN      = (46, 158, 92)

F_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
F_SANS  = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
F_MONO  = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
_fc = {}
def font(path, size):
    key = (path, size)
    if key not in _fc:
        _fc[key] = ImageFont.truetype(path, size)
    return _fc[key]

# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(x, p=3.0):     return 1.0 - (1.0 - clamp(x)) ** p
def ease_in(x, p=3.0):      return clamp(x) ** p
def ease_io(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - ((-2 * x + 2) ** 3) / 2

def fade_env(t, dur, fin=0.25, fout=0.25):
    """1.0 in the body of a scene, ramped at both ends."""
    return min(ease_out(t / fin) if fin > 0 else 1.0,
               ease_out((dur - t) / fout) if fout > 0 else 1.0)

# ---------------------------------------------------------------- text tools
def measure(d, text, f):
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    return r - l, b - t

def text_c(d, xy, text, f, fill, stroke=0, stroke_fill=INK, anchor="mm"):
    d.text(xy, text, font=f, fill=fill, anchor=anchor,
           stroke_width=stroke, stroke_fill=stroke_fill)

def fit_font(path, text, max_w, start, floor=28):
    """Largest size at or below `start` that keeps `text` inside max_w."""
    size = start
    probe = Image.new("L", (8, 8))
    d = ImageDraw.Draw(probe)
    while size > floor:
        f = font(path, size)
        if max(measure(d, ln, f)[0] for ln in text.split("\n")) <= max_w:
            return f
        size -= 4
    return font(path, floor)

def block(d, cx, cy, lines, f, fill, lead=1.25, stroke=0, stroke_fill=INK):
    lh = int(f.size * lead)
    y = cy - (len(lines) - 1) * lh / 2
    for ln in lines:
        text_c(d, (cx, y), ln, f, fill, stroke, stroke_fill)
        y += lh

# ---------------------------------------------------------------- textures
class Grain:
    """Pre-rolled film grain + a fixed vignette, applied to the finished frame."""
    def __init__(self, w, h, n=14):
        self.tiles = []
        rng = np.random.default_rng(7)
        for _ in range(n):
            small = rng.normal(0, 1, (h // 6, w // 6)).astype(np.float32)
            img = Image.fromarray(((small * 26) + 128).clip(0, 255).astype(np.uint8))
            img = img.resize((w, h), Image.BILINEAR)
            self.tiles.append(np.asarray(img, dtype=np.float32) - 128.0)
        yy, xx = np.mgrid[0:h, 0:w]
        r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
        self.vig = (1.0 - 0.52 * np.clip(r - 0.35, 0, None) ** 1.6).astype(np.float32)[..., None]

    def apply(self, arr, i, amount=1.0):
        arr = arr * self.vig
        arr = arr + self.tiles[i % len(self.tiles)][..., None] * (0.10 * amount)
        return arr

def parchment_panel(w, h, seed=3):
    """Torn, stained parchment card."""
    rng = np.random.default_rng(seed)
    base = np.zeros((h, w, 3), np.float32)
    base[:, :] = PARCHMENT
    stain = rng.normal(0, 1, (h // 16, w // 16)).astype(np.float32)
    stain = np.asarray(Image.fromarray(((stain * 40) + 128).clip(0, 255).astype(np.uint8))
                       .resize((w, h), Image.BICUBIC), np.float32) - 128.0
    base += stain[..., None] * 0.35
    base[..., 2] -= 8
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8))

    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    pad = 10
    pts = []
    for x in range(0, w + 1, 18):
        pts.append((x, pad + rng.integers(0, 12)))
    for y in range(0, h + 1, 18):
        pts.append((w - pad - rng.integers(0, 12), y))
    for x in range(w, -1, -18):
        pts.append((x, h - pad - rng.integers(0, 12)))
    for y in range(h, -1, -18):
        pts.append((pad + rng.integers(0, 12), y))
    md.polygon(pts, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    out = Image.new("RGBA", (w, h))
    out.paste(img, (0, 0))
    out.putalpha(mask)
    return out

def gold_rule(d, cx, y, w, thick=6, col=GOLD):
    d.rectangle([cx - w // 2, y, cx + w // 2, y + thick], fill=col)
    d.polygon([(cx - w // 2 - 22, y + thick // 2), (cx - w // 2, y - 6),
               (cx - w // 2, y + thick + 6)], fill=col)
    d.polygon([(cx + w // 2 + 22, y + thick // 2), (cx + w // 2, y - 6),
               (cx + w // 2, y + thick + 6)], fill=col)

# ---------------------------------------------------------------- odds math
def american_to_dec(odds):
    o = str(odds).strip().replace(" ", "")
    v = float(o)
    return 1.0 + (v / 100.0 if v > 0 else 100.0 / abs(v))

def dec_to_american(dec):
    if dec >= 2.0:
        return "+%d" % round((dec - 1) * 100)
    return "-%d" % round(100 / (dec - 1))

def money(x):
    return "${:,.2f}".format(x)

# ---------------------------------------------------------------- scenes
class Renderer:
    def __init__(self, cfg):
        m = cfg["meta"]
        self.cfg = cfg
        self.W, self.H, self.FPS = m["width"], m["height"], m["fps"]
        self.legs = cfg["legs"]
        self.stake = float(m["stake"])
        self.dec = 1.0
        for lg in self.legs:
            self.dec *= american_to_dec(lg["odds"])
        self.payout = self.stake * self.dec
        self.towin = self.payout - self.stake
        self.grain = Grain(self.W, self.H)
        self.parch = parchment_panel(int(self.W * 0.80), int(self.H * 0.40), 11)
        self.scenes = []
        t = 0.0
        for s in cfg["timeline"]:
            s = dict(s)
            s["t0"], s["t1"] = t, t + s["dur"]
            t += s["dur"]
            self.scenes.append(s)
        self.total = t
        self._cache = {}

    # -- layer helpers -----------------------------------------------------
    # NB: ImageDraw.Draw(im, "RGBA") blends shapes but ignores alpha on text, so
    # every scene draws onto a transparent layer and composites once.
    def layers(self, arr):
        img = Image.fromarray(arr.clip(0, 255).astype(np.uint8)).convert("RGBA")
        lay = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        return img, lay, ImageDraw.Draw(lay)

    def flatten(self, img, lay):
        return np.asarray(Image.alpha_composite(img, lay).convert("RGB"), np.float32)

    # -- backgrounds -------------------------------------------------------
    def bg_sea(self, t):
        key = "sea"
        if key not in self._cache:
            h, w = self.H, self.W
            yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
            top = np.array(SEA, np.float32)
            bot = np.array(INK, np.float32)
            g = top * (1 - yy)[..., None] + bot * yy[..., None]
            self._cache[key] = np.repeat(g, w, axis=1)
        arr = self._cache[key].copy()
        # slow swell of light off the water
        yy = np.arange(self.H, dtype=np.float32)[:, None]
        swell = 12.0 * np.exp(-((yy - (self.H * 0.62 + 90 * math.sin(t * 0.7))) ** 2) / (2 * 260.0 ** 2))
        arr += swell[..., None] * np.array([1.0, 0.85, 0.45], np.float32)
        return arr

    def bg_flat(self, col):
        return np.zeros((self.H, self.W, 3), np.float32) + np.array(col, np.float32)

    # -- individual scenes -------------------------------------------------
    def sc_cold_open(self, t, dur):
        arr = self.bg_sea(t)
        img, lay, d = self.layers(arr)
        cx = self.W // 2
        # lantern flicker on the horizon
        fl = 0.6 + 0.4 * math.sin(t * 9.1) * math.sin(t * 3.3)
        for r, a in ((260, 22), (150, 34), (70, 60), (26, 190)):
            d.ellipse([cx - r, self.H * 0.30 - r, cx + r, self.H * 0.30 + r],
                      fill=(GOLD[0], GOLD[1], GOLD[2], int(a * fl)))
        k = self.cfg["meta"]["kicker"]
        a1 = ease_out(t / 0.9) * (1 - ease_in(max(0, t - (dur - 0.7)) / 0.7))
        f1 = font(F_SANS, 86)
        d.text((cx, self.H * 0.54), k, font=f1, anchor="mm",
               fill=(*WHITE, int(220 * a1)), stroke_width=2, stroke_fill=INK)
        if t > 1.1:
            a2 = ease_out((t - 1.1) / 0.9) * (1 - ease_in(max(0, t - (dur - 0.7)) / 0.7))
            f2 = font(F_SANS, 128)
            d.text((cx, self.H * 0.54 + 130), "FOOTBALL", font=f2, anchor="mm",
                   fill=(*GOLD, int(240 * a2)), stroke_width=3, stroke_fill=INK)
        if t > 2.3:
            a3 = ease_out((t - 2.3) / 0.8)
            f3 = font(F_MONO, 40)
            d.text((cx, self.H * 0.72), "four legs. one ticket.", font=f3, anchor="mm",
                   fill=(*PARCHMENT, int(200 * a3)))
        return self.flatten(img, lay)

    def sc_title(self, t, dur):
        arr = self.bg_flat(INK)
        # gold slam-in
        img, lay, d = self.layers(arr)
        cx, cy = self.W // 2, int(self.H * 0.44)
        p = ease_out(t / 0.45, 4.0)
        scale = 2.6 - 1.6 * p
        shake = 0 if t > 0.5 else int(14 * (1 - p) * math.sin(t * 60))
        title = self.cfg["meta"]["title"]
        base = fit_font(F_SERIF, title, int(self.W * 0.86), 150, 56).size
        f = font(F_SERIF, max(20, int(base * scale)))
        d.text((cx + shake, cy), title, font=f, anchor="mm",
               fill=(*GOLD, int(255 * clamp(t / 0.25))), stroke_width=4, stroke_fill=INK)
        if t > 0.55:
            a = ease_out((t - 0.55) / 0.5)
            gold_rule(d, cx, cy + 120, int(self.W * 0.62 * a))
            f2 = font(F_SANS, 46)
            d.text((cx, cy + 210), self.cfg["meta"]["subtitle"].upper(), font=f2, anchor="mm",
                   fill=(*PARCHMENT, int(230 * a)))
        if t > 1.3:
            a = ease_out((t - 1.3) / 0.5)
            f3 = font(F_MONO, 38)
            d.text((cx, cy + 320), "(it's a parlay. we're doing a bit.)", font=f3, anchor="mm",
                   fill=(*GOLD_DIM, int(255 * a)))
        arr = self.flatten(img, lay)
        if t < 0.18:   # white flash on the slam
            arr = arr + (255 - arr) * (1 - t / 0.18) * 0.85
        return arr

    def sc_slate(self, t, dur, s):
        """Placeholder card marking where a Pirates 'parley' clip drops in."""
        arr = self.bg_flat((12, 12, 16))
        img, lay, d = self.layers(arr)
        cx = self.W // 2
        m = 60
        # dashed drop-zone
        col = GOLD if (t % 1.0) < 0.75 else GOLD_DIM
        step, on = 38, 22
        for x in range(m, self.W - m, step):
            d.rectangle([x, m, min(x + on, self.W - m), m + 5], fill=col)
            d.rectangle([x, self.H - m - 5, min(x + on, self.W - m), self.H - m], fill=col)
        for y in range(m, self.H - m, step):
            d.rectangle([m, y, m + 5, min(y + on, self.H - m)], fill=col)
            d.rectangle([self.W - m - 5, y, self.W - m, min(y + on, self.H - m)], fill=col)

        f_lab = font(F_MONO, 34)
        d.text((m + 30, m + 46), "PARLEY CLIP %02d" % s["slot"], font=f_lab, fill=GOLD)
        d.text((self.W - m - 30, m + 46), "%.1fs" % dur, font=f_lab, fill=GOLD, anchor="ra")
        if (t % 1.0) < 0.5:   # record blip
            d.ellipse([m + 30, m + 92, m + 62, m + 124], fill=BLOOD)
        d.text((m + 80, m + 108), "INSERT FOOTAGE", font=font(F_MONO, 28), fill=(*WHITE, 150), anchor="lm")

        quote = s["quote"]
        fq = fit_font(F_SERIF, quote, self.W - 2 * m - 120, 92, 40)
        a = fade_env(t, dur, 0.3, 0.3)
        lines = quote.split("\n")
        block(d, cx, int(self.H * 0.44), lines, fq, (*PARCHMENT, int(255 * a)), 1.3, 3, INK)

        f_ch = font(F_SANS, 44)
        d.text((cx, self.H * 0.44 + fq.size * 1.3 * len(lines) / 2 + 90), s["character"],
               font=f_ch, anchor="mm", fill=(*GOLD, int(255 * a)))
        d.text((cx, self.H * 0.44 + fq.size * 1.3 * len(lines) / 2 + 150),
               "— %s" % s["source"], font=font(F_MONO, 30), anchor="mm",
               fill=(*GOLD_DIM, int(255 * a)))
        d.text((cx, self.H - m - 150), s.get("direction", ""), font=font(F_MONO, 28),
               anchor="mm", fill=(*WHITE, 130))
        # scrub bar counting the slot down
        bw = self.W - 2 * m - 120
        bx, by = cx - bw // 2, self.H - m - 90
        d.rectangle([bx, by, bx + bw, by + 10], fill=(*GOLD_DIM, 120))
        d.rectangle([bx, by, bx + int(bw * clamp(t / dur)), by + 10], fill=GOLD)
        return self.flatten(img, lay)

    def sc_code(self, t, dur):
        arr = self.bg_sea(t * 0.5)
        img, lay, d = self.layers(arr)
        pw, ph = self.parch.size
        px, py = (self.W - pw) // 2, int(self.H * 0.28)
        rise = int(60 * (1 - ease_out(t / 0.6)))
        panel = self.parch.copy()
        panel.putalpha(panel.getchannel("A").point(lambda v: int(v * fade_env(t, dur, 0.4, 0.35))))
        img.paste(panel, (px, py + rise), panel)
        cx = self.W // 2
        a = int(255 * fade_env(t, dur, 0.45, 0.35))
        d.text((cx, py + rise + 90), "THE CODE", font=font(F_SERIF, 78), anchor="mm",
               fill=(60, 40, 18, a))
        gold_rule(d, cx, py + rise + 150, int(pw * 0.6), 5, (120, 88, 30))
        rules = ["%d legs. one ticket." % len(self.legs),
                 "no cash out. no hedging.",
                 "we go down with the ship."]
        y = py + rise + 320
        for i, r in enumerate(rules):
            ra = int(a * ease_out((t - 0.5 - i * 0.28) / 0.4)) if t > 0.5 + i * 0.28 else 0
            d.text((cx, y), r, font=font(F_MONO, 40), anchor="mm", fill=(40, 28, 14, ra))
            y += 100
        return self.flatten(img, lay)

    def sc_leg(self, t, dur, idx):
        leg = self.legs[idx]
        arr = self.bg_flat(INK)
        img, lay, d = self.layers(arr)
        cx, cy = self.W // 2, int(self.H * 0.52)
        a = fade_env(t, dur, 0.22, 0.22)

        # big ghosted leg number sliding by
        fn = font(F_SERIF, 740)
        d.text((cx, cy + 30 + int(40 * (1 - ease_out(t / 0.6)))), str(idx + 1), font=fn,
               anchor="mm", fill=(*GOLD, int(34 * a)))

        d.text((cx, cy - 300), "LEG %d OF %d" % (idx + 1, len(self.legs)),
               font=font(F_MONO, 40), anchor="mm", fill=(*GOLD, int(230 * a)))
        d.text((cx, cy - 235), leg["market"], font=font(F_MONO, 30), anchor="mm",
               fill=(*WHITE, int(120 * a)))

        slide = int(70 * (1 - ease_out(t / 0.45, 4)))
        fp = fit_font(F_SANS, leg["pick"], self.W - 160, 110, 48)
        d.text((cx + slide, cy - 60), leg["pick"], font=fp, anchor="mm",
               fill=(*WHITE, int(255 * a)), stroke_width=3, stroke_fill=INK)

        # odds chip
        odds = leg["odds"]
        fo = font(F_SANS, 92)
        ow, oh = measure(d, odds, fo)
        bx0, by0 = cx - ow // 2 - 44, cy + 40
        bx1, by1 = cx + ow // 2 + 44, cy + 40 + oh + 54
        pop = ease_out(max(0.0, t - 0.35) / 0.4, 4)
        if pop > 0:
            d.rounded_rectangle([bx0, by0, bx1, by1], 20,
                                fill=(*GOLD, int(255 * a * pop)))
            d.text(((bx0 + bx1) / 2, (by0 + by1) / 2), odds, font=fo, anchor="mm",
                   fill=(*INK, int(255 * a * pop)))
        if t > 0.8:
            d.text((cx, by1 + 90), leg.get("note", ""), font=font(F_MONO, 34), anchor="mm",
                   fill=(*PARCHMENT, int(200 * a * ease_out((t - 0.8) / 0.4))))

        # running parlay odds in the corner
        run = 1.0
        for j in range(idx + 1):
            run *= american_to_dec(self.legs[j]["odds"])
        d.text((cx, self.H - 240), "TICKET SO FAR   %s" % dec_to_american(run),
               font=font(F_MONO, 36), anchor="mm", fill=(*GOLD_DIM, int(255 * a)))
        # progress pips
        pw_ = 46
        total_w = len(self.legs) * pw_ + (len(self.legs) - 1) * 18
        x = cx - total_w // 2
        for j in range(len(self.legs)):
            filled = j <= idx
            d.rounded_rectangle([x, self.H - 180, x + pw_, self.H - 168], 6,
                                fill=(*(GOLD if filled else GOLD_DIM), int((255 if filled else 110) * a)))
            x += pw_ + 18
        return self.flatten(img, lay)

    def sc_ticket(self, t, dur):
        arr = self.bg_sea(t * 0.4)
        img, lay, d = self.layers(arr)
        cx = self.W // 2
        a = fade_env(t, dur, 0.3, 0.3)

        cw, ch = int(self.W * 0.84), int(self.H * 0.60)
        x0, y0 = cx - cw // 2, int(self.H * 0.17)
        rise = int(50 * (1 - ease_out(t / 0.5)))
        d.rounded_rectangle([x0, y0 + rise, x0 + cw, y0 + ch + rise], 26,
                            fill=(14, 16, 22, int(242 * a)), outline=(*GOLD, int(255 * a)), width=4)
        d.text((cx, y0 + rise + 70), self.cfg["meta"]["book"], font=font(F_MONO, 34),
               anchor="mm", fill=(*GOLD, int(255 * a)))
        gold_rule(d, cx, y0 + rise + 110, int(cw * 0.7), 4)

        y = y0 + rise + 200
        for i, leg in enumerate(self.legs):
            la = a * (ease_out((t - 0.35 - i * 0.16) / 0.3) if t > 0.35 + i * 0.16 else 0)
            if la <= 0:
                y += 110
                continue
            d.text((x0 + 44, y), "✓", font=font(F_SANS, 42), anchor="lm",
                   fill=(*GREEN, int(255 * la)))
            fp = fit_font(F_SANS, leg["pick"], cw - 300, 46, 26)
            d.text((x0 + 104, y), leg["pick"], font=fp, anchor="lm", fill=(*WHITE, int(255 * la)))
            d.text((x0 + cw - 44, y), leg["odds"], font=font(F_MONO, 40), anchor="rm",
                   fill=(*GOLD, int(255 * la)))
            y += 96

        yb = y0 + ch + rise - 360
        d.line([x0 + 44, yb, x0 + cw - 44, yb], fill=(*GOLD_DIM, int(255 * a)), width=3)
        d.text((x0 + 44, yb + 60), "WAGER", font=font(F_MONO, 34), anchor="lm",
               fill=(*PARCHMENT, int(200 * a)))
        d.text((x0 + cw - 44, yb + 60), money(self.stake), font=font(F_MONO, 40), anchor="rm",
               fill=(*WHITE, int(255 * a)))
        d.text((x0 + 44, yb + 122), "PARLAY ODDS", font=font(F_MONO, 34), anchor="lm",
               fill=(*PARCHMENT, int(200 * a)))
        d.text((x0 + cw - 44, yb + 122), dec_to_american(self.dec), font=font(F_MONO, 40),
               anchor="rm", fill=(*GOLD, int(255 * a)))

        # payout odometer
        cnt = ease_out(clamp((t - 1.3) / 2.2), 2.2) * self.towin
        d.text((cx, yb + 205), "TO WIN", font=font(F_MONO, 34), anchor="mm",
               fill=(*PARCHMENT, int(200 * a)))
        pulse = 1.0 + 0.04 * math.sin(t * 7) * clamp((t - 3.4) / 0.6)
        base = fit_font(F_SANS, money(self.towin), cw - 120, 104, 48).size
        fw = font(F_SANS, int(base * pulse))
        d.text((cx, yb + 290), money(cnt), font=fw, anchor="mm",
               fill=(*GOLD, int(255 * a)), stroke_width=3, stroke_fill=INK)
        return self.flatten(img, lay)

    def sc_outro(self, t, dur):
        arr = self.bg_flat(INK)
        img, lay, d = self.layers(arr)
        cx, cy = self.W // 2, int(self.H * 0.42)
        a = fade_env(t, dur, 0.4, 0.8)
        f = font(F_SERIF, 118)
        d.text((cx, cy), "PARLEY.", font=f, anchor="mm", fill=(*GOLD, int(255 * a)),
               stroke_width=4, stroke_fill=INK)
        if t > 0.7:
            aa = a * ease_out((t - 0.7) / 0.6)
            d.text((cx, cy + 140), "see you sunday night", font=font(F_MONO, 44), anchor="mm",
                   fill=(*PARCHMENT, int(230 * aa)))
        if t > 1.5:
            aa = a * ease_out((t - 1.5) / 0.6)
            d.text((cx, self.H - 300), "21+. entertainment only.", font=font(F_MONO, 32),
                   anchor="mm", fill=(*WHITE, int(150 * aa)))
            d.text((cx, self.H - 240), "problem gambling? call 1-800-GAMBLER",
                   font=font(F_MONO, 30), anchor="mm", fill=(*WHITE, int(150 * aa)))
        return self.flatten(img, lay)

    # -- dispatch ----------------------------------------------------------
    def frame(self, n):
        t = n / self.FPS
        s = self.scenes[-1]
        for cand in self.scenes:
            if cand["t0"] <= t < cand["t1"]:
                s = cand
                break
        lt, dur = t - s["t0"], s["dur"]
        k = s["type"]
        if   k == "cold_open": arr = self.sc_cold_open(lt, dur)
        elif k == "title":     arr = self.sc_title(lt, dur)
        elif k == "slate":     arr = self.sc_slate(lt, dur, s)
        elif k == "code":      arr = self.sc_code(lt, dur)
        elif k == "leg":       arr = self.sc_leg(lt, dur, s["index"])
        elif k == "ticket":    arr = self.sc_ticket(lt, dur)
        else:                  arr = self.sc_outro(lt, dur)

        # cut impact: quick punch-in + flash on the first frames of a scene
        if lt < 0.14 and s["t0"] > 0:
            p = lt / 0.14
            z = 1.0 + 0.05 * (1 - p)
            im = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
            zw, zh = int(self.W * z), int(self.H * z)
            im = im.resize((zw, zh), Image.BILINEAR).crop(
                ((zw - self.W) // 2, (zh - self.H) // 2,
                 (zw - self.W) // 2 + self.W, (zh - self.H) // 2 + self.H))
            arr = np.asarray(im, np.float32)
            arr = arr + (255 - arr) * (1 - p) * 0.18

        arr = self.grain.apply(arr, n)
        if t < 0.6:                       # fade up from black
            arr *= ease_out(t / 0.6)
        if t > self.total - 0.8:          # fade to black
            arr *= clamp((self.total - t) / 0.8)
        return arr.clip(0, 255).astype(np.uint8)

# ---------------------------------------------------------------- score
def synth(scenes, total, sr=44100):
    n = int(total * sr) + sr // 2
    mix = np.zeros(n, np.float32)
    def add(sig, at):
        i = int(at * sr)
        j = min(n, i + len(sig))
        if i < n:
            mix[i:j] += sig[:j - i]

    def env(ln, atk, dec, p=2.0):
        e = np.ones(ln, np.float32)
        a = max(1, int(atk * sr))
        e[:a] = np.linspace(0, 1, a)
        d = np.linspace(1, 0, max(1, ln - a)) ** p
        e[a:] = d
        return e

    def kick(amp=1.0):
        ln = int(0.34 * sr)
        tt = np.arange(ln) / sr
        f = 120 * np.exp(-tt * 26) + 44
        s = np.sin(2 * np.pi * np.cumsum(f) / sr)
        return (s * env(ln, 0.002, 0.3, 2.4) * amp).astype(np.float32)

    def snare(amp=0.7):
        ln = int(0.22 * sr)
        rng = np.random.default_rng(5)
        nz = rng.normal(0, 1, ln).astype(np.float32)
        nz = np.diff(np.concatenate([[0], nz]))          # cheap high-pass
        tt = np.arange(ln) / sr
        body = 0.5 * np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30)
        return ((nz * 0.5 + body) * env(ln, 0.001, 0.2, 2.0) * amp).astype(np.float32)

    def hat(amp=0.22):
        ln = int(0.05 * sr)
        rng = np.random.default_rng(9)
        nz = rng.normal(0, 1, ln).astype(np.float32)
        nz = np.diff(np.concatenate([[0], nz]))
        nz = np.diff(np.concatenate([[0], nz]))
        return (nz * env(ln, 0.001, 0.045, 3.0) * amp).astype(np.float32)

    def sub(freq, ln_s, amp=0.5):
        ln = int(ln_s * sr)
        tt = np.arange(ln) / sr
        s = np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(2 * np.pi * freq * 2 * tt)
        return (s * env(ln, 0.01, ln_s, 1.3) * amp).astype(np.float32)

    def pluck(freq, ln_s, amp=0.22):
        ln = int(ln_s * sr)
        tt = np.arange(ln) / sr
        s = (np.sin(2 * np.pi * freq * tt)
             + 0.5 * np.sin(2 * np.pi * freq * 2.01 * tt)
             + 0.25 * np.sin(2 * np.pi * freq * 3.02 * tt))
        return (s * env(ln, 0.004, ln_s, 2.6) * amp).astype(np.float32)

    def boom(amp=1.0):
        ln = int(1.3 * sr)
        tt = np.arange(ln) / sr
        f = 90 * np.exp(-tt * 6) + 32
        s = np.sin(2 * np.pi * np.cumsum(f) / sr)
        rng = np.random.default_rng(3)
        nz = rng.normal(0, 1, ln).astype(np.float32) * np.exp(-tt * 9) * 0.25
        return ((s * 0.9 + nz) * env(ln, 0.002, 1.2, 1.6) * amp).astype(np.float32)

    def riser(ln_s, amp=0.5):
        ln = int(ln_s * sr)
        tt = np.arange(ln) / sr
        f = 180 * (2 ** (tt / ln_s * 3.2))
        s = np.sin(2 * np.pi * np.cumsum(f) / sr)
        rng = np.random.default_rng(11)
        nz = rng.normal(0, 1, ln).astype(np.float32)
        nz = np.diff(np.concatenate([[0], nz])) * 0.4
        ramp = (tt / ln_s) ** 2
        return ((s * 0.5 + nz) * ramp * amp).astype(np.float32)

    # D minor bed, half-time feel
    bpm = 84.0
    beat = 60.0 / bpm
    bar = beat * 4
    notes = {"D": 73.42, "F": 87.31, "A": 110.0, "C": 65.41, "G": 98.0}
    motif = ["D", "F", "A", "F", "D", "C", "D", "A"]

    first_music = scenes[1]["t0"] if len(scenes) > 1 else 0.0
    t = first_music
    i = 0
    while t < total - 0.3:
        b = i % 4
        add(kick(0.95 if b == 0 else 0.7), t)
        if b == 2:
            add(snare(0.65), t)
        for h in range(2):
            add(hat(0.18), t + h * beat / 2)
        if b in (0, 2):
            root = ["D", "D", "F", "C"][(i // 4) % 4]
            add(sub(notes[root], beat * 1.6, 0.42), t)
        # motif plays on the off beats, every other bar
        if (i // 4) % 2 == 1:
            add(pluck(notes[motif[i % len(motif)]] * 4, beat * 0.9, 0.16), t + beat * 0.5)
        t += beat
        i += 1

    for s in scenes:
        if s["t0"] == 0:
            continue
        amp = {"title": 1.0, "ticket": 1.0, "slate": 0.7, "outro": 0.85}.get(s["type"], 0.55)
        add(boom(amp), s["t0"])
        if s["type"] == "ticket":
            add(riser(1.6, 0.45), max(0.0, s["t0"] - 1.6))
        if s["type"] == "title":
            add(riser(1.2, 0.4), max(0.0, s["t0"] - 1.2))

    mix = mix / max(1e-6, np.abs(mix).max()) * 0.92
    mix = np.tanh(mix * 1.25) * 0.86
    st = np.stack([mix, mix], 1)
    return (st * 32767).astype(np.int16)

# ---------------------------------------------------------------- output
def write_wav(path, pcm, sr=44100):
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())

def tc(sec):
    m, s = divmod(sec, 60)
    return "%d:%05.2f" % (int(m), s)

def write_edl(r, path):
    L = ["# THE PARLEY — edit decision list",
         "",
         "Auto-generated by `build.py` from `config.json`. Timecodes are the real cut points",
         "in `out/parley_edit.mp4`.",
         "",
         "| # | in | out | dur | scene | contents |",
         "|---|-----|-----|-----|-------|----------|"]
    for i, s in enumerate(r.scenes, 1):
        if s["type"] == "leg":
            leg = r.legs[s["index"]]
            what = "LEG %d — %s (%s)" % (s["index"] + 1, leg["pick"], leg["odds"])
        elif s["type"] == "slate":
            what = "**PARLEY CLIP %02d** — %s: “%s”" % (
                s["slot"], s["character"], s["quote"].replace("\n", " "))
        elif s["type"] == "ticket":
            what = "ticket reveal — %s to win %s" % (money(r.stake), money(r.towin))
        else:
            what = {"cold_open": "cold open, lantern on the water",
                    "title": "title slam",
                    "code": "'THE CODE' parchment card",
                    "outro": "outro + responsible-gambling card"}[s["type"]]
        L.append("| %d | %s | %s | %.1fs | %s | %s |" % (
            i, tc(s["t0"]), tc(s["t1"]), s["dur"], s["type"], what))
    L += ["", "## Clips to source", "",
          "The cut ships with designed placeholder slates at each of these points — no",
          "copyrighted footage is included. Supply your own clips and run `splice.py`.", ""]
    for s in r.scenes:
        if s["type"] != "slate":
            continue
        L += ["### PARLEY CLIP %02d — `clips/parley%02d.mp4`" % (s["slot"], s["slot"]),
              "",
              "- **in/out:** %s → %s (%.1fs)" % (tc(s["t0"]), tc(s["t1"]), s["dur"]),
              "- **moment:** %s — “%s” (%s)" % (
                  s["character"], s["quote"].replace("\n", " "), s["source"]),
              "- **direction:** %s" % s.get("direction", ""),
              ""]
    L += ["## Ticket math", "",
          "| leg | odds | decimal |", "|---|---|---|"]
    for leg in r.legs:
        L.append("| %s | %s | %.4f |" % (leg["pick"], leg["odds"], american_to_dec(leg["odds"])))
    L += ["", "- parlay decimal: **%.4f** (%s)" % (r.dec, dec_to_american(r.dec)),
          "- wager %s → payout %s, to win **%s**" % (money(r.stake), money(r.payout), money(r.towin)),
          ""]
    open(path, "w").write("\n".join(L))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(HERE, "config.json"))
    ap.add_argument("--out", default=os.path.join(HERE, "out", "parley_edit.mp4"))
    a = ap.parse_args()

    cfg = json.load(open(a.config))
    r = Renderer(cfg)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)

    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = os.path.join(os.path.dirname(a.out), "score.wav")
    write_wav(wav, synth(r.scenes, r.total))

    nframes = int(round(r.total * r.FPS))
    cmd = [ff, "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", "%dx%d" % (r.W, r.H), "-r", str(r.FPS), "-i", "-",
           "-i", wav, "-shortest",
           "-c:v", "libx264", "-preset", "slow", "-crf", "25",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "192k", a.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(nframes):
        p.stdin.write(r.frame(n).tobytes())
        if n % 60 == 0:
            print("  %4d/%d frames (%.1fs)" % (n, nframes, n / r.FPS), flush=True)
    p.stdin.close()
    if p.wait() != 0:
        sys.exit("ffmpeg failed")

    os.remove(wav)
    write_edl(r, os.path.join(HERE, "EDL.md"))
    print("\nwrote %s  (%.1fs, %d frames)" % (a.out, r.total, nframes))
    print("wrote %s" % os.path.join(HERE, "EDL.md"))

if __name__ == "__main__":
    main()
