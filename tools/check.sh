#!/usr/bin/env bash
# Collect what the arcade needs to know about this Pi, in one go. Run it
# on the Pi and paste the output:
#
#   ./tools/check.sh
#
# Nothing here changes anything. Some lines need sudo (previous boot's
# log, firmware config); it asks once, and skips them if you say no.
section() { printf '\n===== %s =====\n' "$1"; }
run() { printf '$ %s\n' "$*"; "$@" 2>&1 | head -n 40 || true; }

export PATH="$PATH:/snap/bin:/usr/sbin:/sbin"

section "OS and hardware"
run cat /proc/device-tree/model; echo
run grep -E '^(PRETTY_NAME|VERSION_ID)=' /etc/os-release
run uname -rm
run free -h
run df -h /

section "Boot target and desktop session"
run systemctl get-default
run systemctl is-active display-manager.service gdm3.service gdm.service lightdm.service
printf 'XDG_SESSION_TYPE=%s DISPLAY=%s WAYLAND_DISPLAY=%s\n' "${XDG_SESSION_TYPE:-}" "${DISPLAY:-}" "${WAYLAND_DISPLAY:-}"
run loginctl list-sessions --no-legend
run id

section "Old rpi-gamer arcade"
run systemctl is-enabled rpi-arcade.service
run systemctl is-active rpi-arcade.service
run ls -la "$HOME/.config/autostart"
run grep -s -E '^(ExecStart|User)=' /etc/systemd/system/rpi-arcade.service

section "Chromium"
for b in chromium chromium-browser google-chrome firefox; do
    command -v "$b" >/dev/null 2>&1 && printf '%s -> %s\n' "$b" "$(command -v "$b")"
done
run snap list 2>/dev/null | grep -i -E 'chrom|firefox|^Name'
command -v chromium >/dev/null 2>&1 && run chromium --version

section "GPU and display driver"
run ls -la /dev/dri
run lsmod | grep -E '^(vc4|v3d|drm)'
run cat /sys/class/drm/card*-*/status
run dpkg -l 'libgl1-mesa-dri' 'libegl1' 'libgles2' 'libegl-mesa0' 'mesa-vulkan-drivers' 'xserver-xorg-core' 'xinit' 'matchbox-window-manager' 2>/dev/null | grep -E '^(ii|un|rc)'
command -v glxinfo >/dev/null 2>&1 && run glxinfo -B
for f in /boot/firmware/config.txt /boot/config.txt; do
    [ -r "$f" ] && { printf '$ grep -v ^# %s\n' "$f"; grep -v '^#' "$f" | grep . ; break; }
done

section "Touchscreen and input"
run ls -la /dev/input/by-id
run grep -E '^N: Name' /proc/bus/input/devices

section "Power and throttling"
command -v vcgencmd >/dev/null 2>&1 && run vcgencmd get_throttled
for f in /sys/class/hwmon/hwmon*/in0_lcrit_alarm; do
    [ -r "$f" ] && printf 'undervoltage alarm (%s): %s\n' "$f" "$(cat "$f")"
done
run sh -c "dmesg 2>/dev/null | grep -i -E 'voltage|throttl|vc4|v3d' | tail -n 20"

section "Reboots and watchdog"
run last -x reboot shutdown | head -n 8
run cat /proc/sys/kernel/panic
run systemctl show -p RuntimeWatchdogUSec -p RebootWatchdogUSec
echo "Last 40 lines of the PREVIOUS boot's log (what it was doing when it went down):"
if sudo -n true 2>/dev/null || sudo -v; then
    sudo journalctl -b -1 -n 40 --no-pager 2>&1
    echo
    echo "Previous boot: anything from the old arcade, X or chromium:"
    sudo journalctl -b -1 --no-pager -g 'rpi-arcade|xinit|Xorg|chromium|segfault|Oops|panic' 2>&1 | tail -n 30
else
    echo "(skipped: needs sudo)"
fi

section "Done"
echo "Paste everything above."
