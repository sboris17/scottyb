#!/usr/bin/env bash
#
# Screenshot every screen of the app in the simulator.
#
#   Tools/shots.sh                 # all screens
#   Tools/shots.sh today stats     # just those
#
# Writes PNGs to Screenshots/ and prints the paths. The point of this is that
# the pictures are files: Claude Code can open them, look at what a change
# actually did, and go round again without anybody describing a layout in
# words. Xcode's canvas is faster for one view; this is the whole app, in the
# real simulator, with real history behind it.
#
# Requires Xcode and xcodegen. Nothing here touches a device or TestFlight.

set -euo pipefail

cd "$(dirname "$0")/.."

SCHEME="Push"
BUNDLE_ID="com.scottsmanboris.pushreps"
OUT="Screenshots"
DEVICE="${SHOTS_DEVICE:-iPhone 16 Pro}"
SCREENS=("$@")
if [ ${#SCREENS[@]} -eq 0 ]; then
  SCREENS=(onboarding today programs stats you)
fi

command -v xcodegen >/dev/null || { echo "xcodegen not found: brew install xcodegen"; exit 1; }
xcodegen generate >/dev/null

# Reuse a booted simulator if there is one; booting is the slow part.
UDID=$(xcrun simctl list devices booted -j \
       | python3 -c 'import json,sys; d=json.load(sys.stdin)["devices"]; ids=[x["udid"] for v in d.values() for x in v]; print(ids[0] if ids else "")')
if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl list devices available -j \
         | python3 -c "
import json,sys
name = '''$DEVICE'''
d = json.load(sys.stdin)['devices']
for runtime, devices in d.items():
    if 'iOS' not in runtime: continue
    for dev in devices:
        if dev['name'] == name: print(dev['udid']); raise SystemExit
# Fall back to any available iPhone rather than failing on a name.
for runtime, devices in d.items():
    if 'iOS' not in runtime: continue
    for dev in devices:
        if dev['name'].startswith('iPhone'): print(dev['udid']); raise SystemExit
")
  [ -n "$UDID" ] || { echo "No iOS simulator available. Open Xcode > Settings > Components."; exit 1; }
  echo "Booting simulator..."
  xcrun simctl boot "$UDID"
fi
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || true

echo "Building..."
DERIVED=$(mktemp -d)
xcodebuild build \
  -project Push.xcodeproj \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  >/dev/null

APP=$(find "$DERIVED/Build/Products" -name "*.app" -maxdepth 3 | head -1)
[ -n "$APP" ] || { echo "Build produced no .app"; exit 1; }
xcrun simctl install "$UDID" "$APP"

mkdir -p "$OUT"
for screen in "${SCREENS[@]}"; do
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  # -demoData swaps in the same seeded history the Xcode previews use, so the
  # screens have something in them worth judging.
  xcrun simctl launch "$UDID" "$BUNDLE_ID" -screen "$screen" -demoData >/dev/null
  sleep 2.5   # let SwiftUI settle; a screenshot mid-transition is worthless
  xcrun simctl io "$UDID" screenshot "$OUT/$screen.png" >/dev/null 2>&1
  echo "  $OUT/$screen.png"
done

xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
rm -rf "$DERIVED"
echo "Done. Open them, or point Claude Code at $OUT/."
