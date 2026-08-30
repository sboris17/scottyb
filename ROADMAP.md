# Hooked — Roadmap to First Paying Customer

Ship free in 5 weeks. Paid tier 4 weeks later. First paying stranger by
mid-November, ahead of the December Apple Developer renewal.

**Why not one launch in December:** three more months with zero user feedback
is the exact pattern that cost four previous apps. Free app early, monetize
against real usage.

## v1 scope — locked

**In:** freshwater only · 91 species · scan → ID → log · dex with unlock ·
journal · trip weather header

**Out of v1, explicitly:** Fish with friends (social is Fishbrain's moat and
is dead weight at zero users) · saltwater (79 more illustrations) · anything
thought of after this line — it goes to POST-MVP.md instead.

## Schedule

| Week | Dates | Goal | Scotty | Claude |
|---|---|---|---|---|
| 1 | Sep 1–7 | Unblock | Push repo · silhouette asset · species 1–20 · 5 posts | Image persistence bug · competitor teardown |
| 2 | Sep 8–14 | Art sprint | Species 21–50 · 5 posts | RevenueCat + paywall architecture |
| 3 | Sep 15–21 | Art done | Species 51–91 · QA contact sheet · 5 posts | App Store copy + ASO keywords |
| 4 | Sep 22–28 | Ship prep | Wire art in · cut social + saltwater · TestFlight to 10 anglers · 5 posts | Analytics events · pre-submit review |
| 5 | Sep 29–Oct 5 | **v1 FREE LIVE** | Submit · launch posts | Crash triage |
| 6–7 | Oct 6–19 | Paid tier | Compile NC regs → Sheets · 5 posts/wk | RevenueCat integration · server-side entitlement |
| 8 | Oct 20–26 | Beta | TestFlight paid tier | Fixes |
| 9 | Oct 27–Nov 2 | **PAID LIVE** | Submit update · push content | Paywall QA |
| 10–14 | Nov 3–Dec 7 | First customers | Content · reply to every review · +2–3 states if regs land | Conversion analysis |

## Monetization

**Free forever:** scan, log, unlock the dex. The unlock loop is the growth
engine — never paywall it, including when revenue is slow.

**Paid — $4.99/mo, $29/yr:**
- State regulations by species: scan a fish, learn whether you can legally
  keep it, right now, where you are
- Trip insights and personal patterns
- Unlimited photo history

**The wedge:** [Fish Rules](https://fishrulesapp.com/) already does regs
lookup, but requires you to know what you caught. Hooked doesn't. The
integration is the product, not the data. Freshwater-first; Fish Rules is
largely coastal.

**Constraints:** no state API exists — manual compilation from NCWRC and
eRegulations. Start with NC only. Always show the source and link the
official regulation. Never present regs without a disclaimer.

## Stack

| Job | Tool | Cost |
|---|---|---|
| Species art generation | ChatGPT Plus | owned |
| Art normalization | `tools/normalize_species.py` | free |
| Silhouette, touch-ups | Adobe | owned |
| Tracking the 91 | Google Sheets + `data/freshwater_species.csv` | free |
| App code | Cursor + Xcode | owned |
| Architecture, bugs | Claude Code | owned |
| Subscriptions | RevenueCat — free to $2,500 MTR, then 1% | free |
| Analytics | RevenueCat built-in + TelemetryDeck | free tier |
| Video editing | CapCut | free |
| Screen recording | iOS built-in | free |
| Store screenshots | Figma | free |
| Regs data | NCWRC + eRegulations, manual | free |

**Net new spend: $0.**

**Do not switch image generators mid-set.** The Catfish style came from
ChatGPT; moving to Firefly or anything else guarantees drift across 91
images. Firefly's advantage is commercially-safe training data, which is
irrelevant here.

## Standing rules

1. **No new ideas until Hooked ships.** LEGO reseller tooling is business #2
   and is written down. It waits.
2. **The dex stays free.** Paywall the regulations instead.
3. **Content starts week 1**, not launch week. ReelView shipped to an
   audience of zero and earned zero.
4. Anything added after the v1 scope lock goes to POST-MVP.md.

## Pre-launch gates — must clear before App Store submission

Blocking. None of these are optional, and all are cheaper to fix now than
after there are users.

### 1. OpenAI API key ships inside the app bundle — BLOCKING

`lib/env.ts` reads `EXPO_PUBLIC_OPENAI_API_KEY`; `lib/openai.ts:82` calls
OpenAI directly from the device. Anything prefixed `EXPO_PUBLIC_` is compiled
into the bundle and is trivially extractable from a published IPA. Automated
scrapers do this. OpenAI keys have no per-key spend cap by default.

**Fix:** move the vision call into a Supabase Edge Function.
- Function holds `OPENAI_API_KEY` as a Supabase secret, server-side
- App calls `supabase.functions.invoke('identify-catch', { body: { imageUrl } })`
- The user's JWT authenticates the call; verify it server-side
- Add a per-user daily scan cap so one compromised account cannot drain billing
- Rotate the existing key after the migration — assume it is already burned

Estimated 3–4 hours. Slot no later than Week 4 (Sep 22–28).

The Supabase anon key is fine to ship — it is designed to be public, and
safety depends on RLS policies, which look sound.

### 2. Scan photos accumulate in a public bucket

`uploadScanPhotoForVision` writes to `catch-photos`, which must be publicly
readable for OpenAI to fetch the image. Those temporary scan uploads are
never deleted, so they pile up permanently at predictable paths in a public
bucket. Delete each one after identification returns.

Moot once gate 1 lands — an edge function can pass image bytes directly and
never needs a public URL at all. Fix them together.

### 3. Catch photo privacy

`catch-photos` being public means any user's catch photos are readable by
anyone holding the URL. Acceptable for a single-user beta; decide before
launch whether to move to signed URLs generated at read time. If you do,
never store a signed URL in `photo_url` — they expire.

## Log

- **2026-08-30** — expo-image migration shipped (`351f758`). All 11 remote
  image call sites now render through `components/ui/RemoteImage.tsx` with
  memory-disk caching and a visible fallback, fixing photos silently blanking
  on any network hiccup. Bundled with a bump of 16 Expo native modules and
  react-native 0.83.6 → 0.83.10; if the native build regresses, that one
  commit holds both changes.
