#!/usr/bin/env python3
"""Generate the illustration prompt sheet for Hooked's freshwater species dex.

The whole point is that only ONE thing varies between prompts: the species and
its diagnostic markings. Everything about framing, lighting, and finish is
locked in STYLE so 91 separate generations still look like one set.

Tweak STYLE, re-run, regenerate. Don't hand-edit the CSV.

    python3 tools/species_prompts.py            # -> data/freshwater_species.csv
    python3 tools/species_prompts.py --json     # also emit JSON for the app
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

STYLE = (
    "Cartoon-style illustration of a {name}. {diagnostic}. "
    "Full lateral profile facing left, entire animal inside the frame, "
    "clean bold outlines, smooth soft shading, slightly saturated natural "
    "coloration, flat plain white background, no water, no scenery, no shadow, "
    "no text or labels, even lighting from the upper left, centered."
)

# (category, common name, diagnostic features that distinguish it visually)
SPECIES: list[tuple[str, str, str]] = [
    # --- Bass ---
    ("Bass", "Largemouth Bass", "olive-green with a dark blotchy horizontal stripe down the side, upper jaw extending past the rear of the eye, deep notch between the two dorsal fins"),
    ("Bass", "Smallmouth Bass", "bronze-brown with dark vertical bars, upper jaw ending below the eye, red-brown eye, shallow notch between dorsal fins"),
    ("Bass", "Spotted Bass", "olive with a broken lateral blotch stripe and distinct rows of small dark spots below the lateral line, jaw ending level with the eye"),
    ("Bass", "Striped Bass", "streamlined silver body with seven or eight unbroken dark horizontal stripes, two clearly separated dorsal fins"),
    ("Bass", "White Bass", "deep compressed silvery body, faint and broken horizontal stripes, high arched back"),
    ("Bass", "Yellow Bass", "brassy gold body with dark stripes that are distinctly offset and broken toward the belly, deep body"),
    ("Bass", "Rock Bass", "sunfish-shaped brassy olive body, bright red eye, rows of dark spots following the scale rows"),
    ("Bass", "Guadalupe Bass", "small olive-green bass with dark lateral blotches extending low onto the belly, slender profile"),

    # --- Trout & Salmon ---
    ("Trout & Salmon", "Rainbow Trout", "silvery olive-green with a broad pink-red lateral band, heavy small black spotting across the body and the whole tail, white mouth"),
    ("Trout & Salmon", "Brown Trout", "golden-brown with black and red-orange spots ringed by pale halos, few or no spots on the tail"),
    ("Trout & Salmon", "Brook Trout", "dark olive back with pale worm-like vermiculation, red spots with blue halos on the flanks, white leading edges on the orange lower fins"),
    ("Trout & Salmon", "Lake Trout", "grey-green with irregular pale cream spots over the body, deeply forked tail"),
    ("Trout & Salmon", "Bull Trout", "olive-green with pale yellow and orange spots, no black spots on the dorsal fin, notably large head"),
    ("Trout & Salmon", "Cutthroat Trout", "olive-gold with a vivid red-orange slash under each side of the lower jaw, spotting heaviest toward the tail"),
    ("Trout & Salmon", "Chinook Salmon", "blue-green back, black spots on both lobes of the tail, black gums inside the mouth, thick body"),
    ("Trout & Salmon", "Coho Salmon", "silver-blue with black spots only on the upper lobe of the tail, white gums with a dark tongue"),
    ("Trout & Salmon", "Atlantic Salmon", "bright silver with scattered black X-shaped and cross-shaped marks above the lateral line, narrow caudal peduncle"),
    ("Trout & Salmon", "Sockeye Salmon", "spawning form: brilliant crimson-red body with a bright green head and no distinct spotting, humped back"),
    ("Trout & Salmon", "Steelhead", "sea-run rainbow trout: chrome-silver flanks with only a faint pink band and sparse fine black spotting, more streamlined than a resident rainbow"),

    # --- Panfish ---
    ("Panfish", "Bluegill", "deep round compressed body, solid black opercular ear flap, dark blotch at the rear base of the soft dorsal fin, faint vertical bars, very small mouth"),
    ("Panfish", "Redear Sunfish", "deep olive body with a bright red-orange crescent on the margin of the black ear flap, small mouth"),
    ("Panfish", "Green Sunfish", "elongated body with a noticeably larger mouth than a bluegill, blue-green wavy lines on the cheek, pale yellow-white fin margins"),
    ("Panfish", "Pumpkinseed", "olive body speckled with orange and gold, wavy blue lines across the cheek, bright red-orange spot at the edge of the ear flap"),
    ("Panfish", "Warmouth", "mottled dark red-brown body, large mouth, three to five dark lines radiating backward from a red eye"),
    ("Panfish", "Longear Sunfish", "orange-red body with wavy blue lines on the head, very long flexible dark ear flap edged in white"),
    ("Panfish", "Black Crappie", "deep silvery compressed body with irregular scattered black speckling and seven or eight dorsal spines"),
    ("Panfish", "White Crappie", "silvery compressed body with dark markings organized into faint vertical bars, five or six dorsal spines, more elongated than black crappie"),
    ("Panfish", "Yellow Perch", "golden-yellow body with six to eight dark vertical bars, orange lower fins, two separate dorsal fins"),
    ("Panfish", "White Perch", "plain silvery-grey deep body with no bars in the adult, arched back, two joined dorsal fins"),
    ("Panfish", "Redbreast Sunfish", "bright orange-red breast, long narrow all-black ear flap, blue streaks across the cheek"),

    # --- Catfish ---
    ("Catfish", "Channel Catfish", "slender silvery-olive body with scattered small dark spots, deeply forked tail, long whisker barbels"),
    ("Catfish", "Blue Catfish", "slate blue-grey unspotted body, deeply forked tail, straight-edged anal fin with a long base"),
    ("Catfish", "Flathead Catfish", "mottled yellow-brown body, broad flattened head, protruding lower jaw, squared tail that is NOT forked, small high-set eyes"),
    ("Catfish", "Black Bullhead", "stocky dark body, black chin barbels, squared tail with a pale bar at its base"),
    ("Catfish", "Brown Bullhead", "mottled brown body, dark mottled chin barbels, slightly notched tail"),
    ("Catfish", "Yellow Bullhead", "yellow-olive body with clean white or pale yellow chin barbels, rounded tail"),
    ("Catfish", "Madtom", "very small mottled brown catfish with the adipose fin fused to the tail fin, stout barbels"),

    # --- Pike & Muskie ---
    ("Pike & Muskie", "Northern Pike", "long torpedo body, flat duck-bill snout, rows of light bean-shaped spots on a dark green background, rounded tail lobes"),
    ("Pike & Muskie", "Muskellunge", "long body with dark vertical bars and spots on a light silver-olive background, the reverse of a pike's pattern, pointed tail lobes"),
    ("Pike & Muskie", "Tiger Muskie", "bold irregular dark vertical tiger stripes over a gold-green background, rounded fins, hybrid build"),
    ("Pike & Muskie", "Chain Pickerel", "slender green body with a bold dark chain-link reticulated pattern, dark vertical teardrop bar below the eye"),
    ("Pike & Muskie", "Redfin Pickerel", "small slender pickerel with orange-red fins and a dark teardrop bar below the eye"),

    # --- Walleye & Sauger ---
    ("Walleye & Sauger", "Walleye", "gold-olive body, large glassy opaque white eye, dark blotch at the rear of the spiny dorsal fin, distinct white tip on the lower tail lobe"),
    ("Walleye & Sauger", "Sauger", "brassy body with dark saddle-shaped blotches, rows of distinct spots across the spiny dorsal fin, no white tail tip"),
    ("Walleye & Sauger", "Saugeye", "hybrid intermediate: faint dark saddles plus some spotting on the spiny dorsal, faint white tail tip"),

    # --- Carp, Gar & Rough Fish ---
    ("Carp, Gar & Rough Fish", "Common Carp", "heavy brassy-gold body with large visible scales, two pairs of barbels at the mouth, long serrated dorsal fin"),
    ("Carp, Gar & Rough Fish", "Grass Carp", "elongated olive-silver body with large dark-edged scales, no barbels, short dorsal fin, blunt head"),
    ("Carp, Gar & Rough Fish", "Bighead Carp", "very large head with low-set eyes below the mouth line, dark grey blotchy mottling, no barbels"),
    ("Carp, Gar & Rough Fish", "Silver Carp", "bright silver body, smaller head than bighead, eyes set very low, upturned mouth, keeled belly"),
    ("Carp, Gar & Rough Fish", "Bigmouth Buffalo", "dark bronze sucker-like body with a large terminal mouth angled upward, long dorsal fin"),
    ("Carp, Gar & Rough Fish", "Smallmouth Buffalo", "bronze body with a steeply arched back and a small downturned subterminal mouth"),
    ("Carp, Gar & Rough Fish", "Black Buffalo", "dark bronze-black cylindrical body, mouth intermediate between the other buffalo species"),
    ("Carp, Gar & Rough Fish", "Freshwater Drum", "silvery body with a high arched back, blunt snout with a subterminal mouth, rounded tail"),
    ("Carp, Gar & Rough Fish", "Bowfin", "long cylindrical olive body, very long undulating dorsal fin running most of the back, bony plated head, black eyespot ringed in orange at the tail base"),
    ("Carp, Gar & Rough Fish", "Longnose Gar", "cylindrical armored body with an extremely long narrow toothed beak roughly twice the length of the head, diamond-shaped scales"),
    ("Carp, Gar & Rough Fish", "Shortnose Gar", "cylindrical olive-brown gar with a short broad snout and dark spots on the rear fins"),
    ("Carp, Gar & Rough Fish", "Spotted Gar", "gar with bold dark round spots across the head, body, and all fins, medium-length snout"),
    ("Carp, Gar & Rough Fish", "Alligator Gar", "massive heavy-bodied gar with a broad short alligator-like snout and two rows of teeth in the upper jaw"),
    ("Carp, Gar & Rough Fish", "Quillback", "deep silvery compressed sucker with a dramatically elongated first dorsal ray forming a tall quill, downturned mouth"),

    # --- Sturgeon ---
    ("Sturgeon", "Lake Sturgeon", "olive-brown prehistoric body with five rows of bony scutes, four barbels ahead of a protrusible mouth, shark-like upturned tail"),
    ("Sturgeon", "White Sturgeon", "very large grey sturgeon with a short blunt snout and barbels set closer to the snout tip than the mouth"),
    ("Sturgeon", "Shovelnose Sturgeon", "small pale sturgeon with a broad flattened shovel-shaped snout and a long trailing filament on the upper tail lobe"),
    ("Sturgeon", "Pallid Sturgeon", "pale grey-white slender sturgeon with a long flattened pointed snout"),

    # --- Other Freshwater Fish ---
    ("Other Freshwater Fish", "Cisco", "slender silvery herring-like body with a terminal mouth, small adipose fin, deeply forked tail"),
    ("Other Freshwater Fish", "Lake Whitefish", "silvery body with a distinctly humped back behind the head and a small subterminal mouth beneath a blunt snout"),
    ("Other Freshwater Fish", "Burbot", "elongated eel-like cod with mottled brown and yellow marbling, a single barbel on the chin, very long second dorsal fin"),
    ("Other Freshwater Fish", "Mooneye", "deep compressed bright silver body with a very large silver eye and a keeled belly"),
    ("Other Freshwater Fish", "Goldeye", "deep compressed silver body with a striking gold-yellow eye and a fleshy keel along the belly"),
    ("Other Freshwater Fish", "American Shad", "deep compressed silver body with a row of dark shoulder spots behind the gill, sharp sawtooth belly scutes, deeply forked tail"),
    ("Other Freshwater Fish", "Hickory Shad", "silver compressed body with a lower jaw projecting well past the upper and a single faint shoulder spot"),
    ("Other Freshwater Fish", "White Sucker", "cylindrical olive-brown body fading to a white belly, ventral sucker mouth with thick fleshy lips"),
    ("Other Freshwater Fish", "Longnose Sucker", "dark olive elongated sucker with a long fleshy snout overhanging the mouth"),
    ("Other Freshwater Fish", "Redhorse Sucker", "bronze-gold sucker body with bright red-orange tail and lower fins, thick-lipped ventral mouth"),

    # --- Turtles ---
    ("Turtles", "Common Snapping Turtle", "massive head with a strongly hooked beak, rough ridged carapace, very long saw-toothed tail, small cross-shaped plastron"),
    ("Turtles", "Common Musk Turtle", "small dark domed shell, two pale yellow stripes running along the head, small barbels beneath the chin"),
    ("Turtles", "Painted Turtle", "smooth flattened olive shell edged with red bars on the marginal scutes, yellow head stripes, red-orange plastron"),
    ("Turtles", "Red-Eared Slider", "olive-green shell with yellow striping and a prominent broad red stripe just behind each eye"),
    ("Turtles", "Map Turtle", "olive shell marked with fine contour-line map patterning, a raised keel ridge down the back, thin yellow head lines"),
    ("Turtles", "Spiny Softshell Turtle", "flat leathery pancake-shaped olive shell with small spines along the front edge, long neck and a tubular snorkel snout"),
    ("Turtles", "Florida Softshell Turtle", "dark grey-brown leathery shell with a bumpy front margin, very wide flattened body, long neck and tubular snout"),
    ("Turtles", "Alligator Snapping Turtle", "three prominent ridged keels running down a spiked carapace, enormous armored head with a strongly hooked beak, long tail"),
    ("Turtles", "Diamondback Terrapin", "grey shell marked with concentric diamond growth rings, pale grey skin covered in fine black speckles"),
    ("Turtles", "Chicken Turtle", "very long striped neck, narrow oval shell with a fine net-like pattern, bold yellow striping on the hind legs"),
    ("Turtles", "Spotted Turtle", "small smooth black shell scattered with round bright yellow spots, black head with yellow spots"),
    ("Turtles", "Box Turtle", "high domed shell with radiating orange and yellow patterning, hinged plastron that closes tight"),

    # --- Amphibians & Other ---
    ("Amphibians & Other", "American Bullfrog", "large green-brown frog with a prominent round eardrum behind the eye, no ridges along the back, heavily webbed hind feet"),
    ("Amphibians & Other", "American Eel", "long snake-like bronze-olive body with a single continuous dorsal fin running to the tail and small rounded pectoral fins"),
    ("Amphibians & Other", "Crayfish", "red-brown lobster-like crustacean with large front claws, segmented body and a fanned tail"),
    ("Amphibians & Other", "Freshwater Mussel", "elongated oval bivalve shell in dark brown with visible concentric growth rings and iridescent nacre at the opening"),
    ("Amphibians & Other", "Freshwater Shrimp", "small translucent grey shrimp with a curved body and long antennae"),
    ("Amphibians & Other", "Salamander", "elongated smooth-skinned amphibian with four short legs, a long tail, and mottled dark markings"),
]


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def build() -> list[dict]:
    return [
        {
            "id": i,
            "category": category,
            "common_name": name,
            "slug": slug(name),
            "diagnostic": diagnostic,
            "prompt": STYLE.format(name=name, diagnostic=diagnostic),
            "status": "",
        }
        for i, (category, name, diagnostic) in enumerate(SPECIES, start=1)
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=Path("data/freshwater_species.csv"))
    ap.add_argument("--json", action="store_true", help="also emit a .json alongside")
    args = ap.parse_args()

    rows = build()
    args.out.parent.mkdir(parents=True, exist_ok=True)

    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    if args.json:
        args.out.with_suffix(".json").write_text(
            json.dumps(rows, indent=2), encoding="utf-8")

    by_category: dict[str, int] = {}
    for row in rows:
        by_category[row["category"]] = by_category.get(row["category"], 0) + 1
    for category, count in by_category.items():
        print(f"  {count:>3}  {category}")
    print(f"\n{len(rows)} species -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
