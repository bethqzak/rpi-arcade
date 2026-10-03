#!/usr/bin/env bash
# Start the arcade: one Chromium window in kiosk mode on the launcher page.
# This is what the desktop autostart runs at boot, and what you run by hand
# to try it. Everything (menu, Pac-Man, the 3D games) lives inside this one
# browser window, so there is no display hand-off that can go wrong.
#
#   ./run.sh          start the arcade
#   ./run.sh --gpu    open chrome://gpu instead, to see whether the 3D games
#                     get the Pi's GPU ("Hardware accelerated") or software
set -u
cd "$(dirname "$0")"

export PATH="$PATH:/snap/bin"   # Ubuntu's chromium is a snap
for b in chromium chromium-browser google-chrome chrome; do
    if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done
if [ -z "${BROWSER:-}" ]; then
    echo "run.sh: no chromium found. Run ./install.sh first." >&2
    exit 1
fi

URL="file://$PWD/www/index.html"
[ "${1:-}" = "--gpu" ] && URL="chrome://gpu"

# Its own profile, so it never shows the user's own tabs or a "restore
# session?" bar, and the games' saves (localStorage) persist between boots.
PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/rpi-arcade/profile"
LOG="${XDG_CACHE_HOME:-$HOME/.cache}/rpi-arcade/chromium.log"
mkdir -p "$PROFILE" "$(dirname "$LOG")"

# No GPU flags: Raspberry Pi OS's chromium uses the Pi's GPU (V3D) for
# WebGL on its own. Forcing it (--ignore-gpu-blocklist) is what the old
# arcade did, and a forced GPU path that hangs is a reboot, not a crash.
exec "$BROWSER" \
    --kiosk \
    --user-data-dir="$PROFILE" \
    --no-first-run \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --touch-events=enabled \
    --autoplay-policy=no-user-gesture-required \
    --check-for-update-interval=31536000 \
    --password-store=basic \
    --disable-features=TranslateUI \
    "$URL" >>"$LOG" 2>&1
