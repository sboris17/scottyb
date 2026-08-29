#!/usr/bin/env python3
"""Normalize generated fish illustrations into a consistent, app-ready set.

Replaces the manual Adobe pass: background knockout, trim, uniform scale,
centered canvas, @1x/@2x/@3x export, plus a contact sheet for spotting
style outliers before they ship.

    pip install Pillow numpy
    python3 normalize_species.py raw/ out/

Input files should be named for the species ("Flathead Catfish.png"); the
name becomes flathead_catfish.png in the output.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Missing deps. Run: pip install Pillow numpy")

# Improbable color used to mark background before we punch it out.
KEY = (255, 0, 255)


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def knockout(img: Image.Image, thresh: int) -> Image.Image:
    """Flood-fill the flat background in from all four corners, then drop it.

    Only removes background connected to an edge, so an enclosed white belly
    or eye highlight survives. Raise thresh for noisier backgrounds -- but if
    the fish starts losing pale edges, lower it again.
    """
    rgb = img.convert("RGB")
    w, h = rgb.size
    for corner in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(rgb, corner, KEY, thresh=thresh)

    arr = np.array(rgb)
    background = np.all(arr == KEY, axis=-1)
    alpha = np.where(background, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, alpha]), "RGBA")


def fit_to_canvas(fish: Image.Image, canvas: tuple[int, int], fill: float) -> Image.Image:
    """Trim to the fish, scale it to occupy `fill` of the canvas, center it.

    Scaling off the trimmed bounding box is what makes every species read at
    the same visual weight in the dex grid, regardless of how the generator
    framed it.
    """
    bbox = fish.getbbox()
    if bbox is None:
        raise ValueError("image is fully transparent after knockout")
    fish = fish.crop(bbox)

    cw, ch = canvas
    scale = min(cw * fill / fish.width, ch * fill / fish.height)
    fish = fish.resize(
        (max(1, round(fish.width * scale)), max(1, round(fish.height * scale))),
        Image.LANCZOS,
    )

    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    out.paste(fish, ((cw - fish.width) // 2, (ch - fish.height) // 2), fish)
    return out


def contact_sheet(images: list[tuple[str, Image.Image]], cell: int = 200) -> Image.Image:
    """Grid of every species on one dark sheet, so drift is obvious at a glance."""
    cols = math.ceil(math.sqrt(len(images))) or 1
    rows = math.ceil(len(images) / cols)
    sheet = Image.new("RGB", (cols * cell, rows * cell), (12, 26, 18))
    for i, (_, img) in enumerate(images):
        thumb = img.copy()
        thumb.thumbnail((cell - 16, cell - 16), Image.LANCZOS)
        x = (i % cols) * cell + (cell - thumb.width) // 2
        y = (i // cols) * cell + (cell - thumb.height) // 2
        sheet.paste(thumb, (x, y), thumb)
    return sheet


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", type=Path, help="folder of generated PNGs")
    ap.add_argument("dst", type=Path, help="output folder")
    ap.add_argument("--canvas", default="512x288", help="1x canvas WxH (default 512x288)")
    ap.add_argument("--fill", type=float, default=0.92,
                    help="fraction of canvas the fish should span (default 0.92)")
    ap.add_argument("--thresh", type=int, default=40,
                    help="background color tolerance (default 40)")
    args = ap.parse_args()

    cw, ch = (int(v) for v in args.canvas.lower().split("x"))
    args.dst.mkdir(parents=True, exist_ok=True)

    sources = sorted(
        p for p in args.src.iterdir()
        if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not sources:
        return print(f"No images found in {args.src}") or 1

    done: list[tuple[str, Image.Image]] = []
    for path in sources:
        try:
            fish = knockout(Image.open(path), args.thresh)
            base = fit_to_canvas(fish, (cw, ch), args.fill)
        except Exception as exc:
            print(f"  SKIP {path.name}: {exc}")
            continue

        name = slug(path.stem)
        for scale in (1, 2, 3):
            suffix = "" if scale == 1 else f"@{scale}x"
            img = base if scale == 1 else base.resize(
                (cw * scale, ch * scale), Image.LANCZOS)
            img.save(args.dst / f"{name}{suffix}.png")

        done.append((name, base))
        print(f"  ok   {name}")

    if done:
        contact_sheet(done).save(args.dst / "contact_sheet.png")

    print(f"\n{len(done)}/{len(sources)} normalized -> {args.dst}")
    print("Open contact_sheet.png and look for the ones that don't match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
