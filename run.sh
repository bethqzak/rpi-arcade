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
# A snap (Ubuntu's chromium) may not touch hidden folders in $HOME such as
# ~/.cache - it dies at once with "SingletonLock: Permission denied" - so
# its profile goes in the one place a snap may write.
case "$(command -v "$BROWSER")" in
    */snap/bin/*) PROFILE="$HOME/snap/chromium/common/rpi-arcade-profile" ;;
    *)            PROFILE="${XDG_CACHE_HOME:-$HOME/.cache}/rpi-arcade/profile" ;;
esac
LOG="${XDG_CACHE_HOME:-$HOME/.cache}/rpi-arcade/chromium.log"
mkdir -p "$PROFILE" "$(dirname "$LOG")"

# WebGL: chromium blocklists the Pi's GPU and, without the SwiftShader
# flag, then gives pages no WebGL at all, so the 3D games can't start.
# SwiftShader is WebGL in software: always works, slow. "install.sh --gpu"
# adds the flags that force the GPU past the blocklist (what the old arcade
# always did); a GPU driver that hangs takes the whole Pi down, so that is
# opt-in. When the GPU works these flags take precedence over SwiftShader.
# Left to itself chromium reaches the Pi's GPU through Vulkan, which the
# Pi's Vulkan driver can't satisfy ("shaderUniform*ArrayDynamicIndexing
# required" in the log), so it silently falls back to software anyway.
# OpenGL ES is the path that works on this GPU: --use-angle=gles.
GPU_FLAGS=""
DISABLE_FEATURES="TranslateUI"
if [ -f "${XDG_CONFIG_HOME:-$HOME/.config}/rpi-arcade/gpu" ]; then
    GPU_FLAGS="--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --use-gl=angle --use-angle=gles"
    DISABLE_FEATURES="$DISABLE_FEATURES,Vulkan,DefaultANGLEVulkan,VulkanFromANGLE"
fi

# --ozone-platform-hint=auto: talk to a Wayland desktop (Ubuntu's GNOME)
# directly instead of through XWayland. XWayland always presents a mouse,
# so a page sees "pointer: fine" and games hide their touch controls
# even when the touchscreen is the only pointer there is.
# (No --enable-wayland-ime: with it, and GNOME's screen keyboard on, the
# touchscreen stopped reaching chromium at all. Typing is the open issue.)
# shellcheck disable=SC2086  # GPU_FLAGS expands to words on purpose
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
    --ozone-platform-hint=auto \
    --autoplay-policy=no-user-gesture-required \
    --check-for-update-interval=31536000 \
    --password-store=basic \
    --disable-features="$DISABLE_FEATURES" \
    --enable-unsafe-swiftshader \
    $GPU_FLAGS \
    "$URL" >>"$LOG" 2>&1
