#!/bin/sh
# Start a bare X server on this console with system/xinitrc as its session
# (the window manager and the arcade). Run by the kiosk systemd unit.
cd "$(dirname "$0")/.." || exit 1
exec xinit "$PWD/system/xinitrc" -- :0 vt1 -keeptty -nolisten tcp
