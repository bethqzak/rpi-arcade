#!/bin/sh
# Start a bare X server on this console with system/xinitrc as its session
# (the window manager and the arcade). Run by the kiosk systemd unit.
cd "$(dirname "$0")/.." || exit 1
# -nocursor: X draws a pointer under every touch; a touchscreen kiosk has no use for it.
exec xinit "$PWD/system/xinitrc" -- :0 vt1 -keeptty -nolisten tcp -nocursor
