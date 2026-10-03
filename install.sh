#!/usr/bin/env bash
# Set up the Pi to boot straight into the arcade:
#   - chromium, if it is missing
#   - log straight into the desktop at boot (no password prompt)
#   - start the arcade when the desktop comes up
#   - never blank the screen
#
#   ./install.sh            set it up
#   ./install.sh --remove   undo the autostart (the OS settings stay)
#
# Made for Raspberry Pi OS (Bookworm or later) with the desktop. Ubuntu
# Desktop works too; the autologin step is printed for you to do there.
set -eu
cd "$(dirname "$0")"
ARCADE_DIR="$PWD"
AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/rpi-arcade.desktop"
export PATH="$PATH:/snap/bin"

if [ "${1:-}" = "--remove" ]; then
    rm -f "$AUTOSTART"
    echo "Removed $AUTOSTART. The arcade no longer starts at boot."
    echo "(Autologin and screen blanking were left as they are.)"
    exit 0
fi

if [ "$(id -u)" = 0 ]; then
    echo "Run this as the user who will log in, not as root (no sudo)." >&2
    exit 1
fi

# --- chromium -------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }
if ! have chromium && ! have chromium-browser && ! have google-chrome; then
    echo "Installing chromium..."
    sudo apt-get update
    # Raspberry Pi OS ships "chromium"; older releases and Ubuntu "chromium-browser".
    sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
fi

# --- autostart ------------------------------------------------------------
mkdir -p "$(dirname "$AUTOSTART")"
sed "s|__ARCADE_DIR__|$ARCADE_DIR|g" system/rpi-arcade.desktop.in > "$AUTOSTART"
chmod +x run.sh
echo "Autostart installed: $AUTOSTART"

# --- boot to the desktop, logged in, screen always on ---------------------
if have raspi-config; then
    echo "Setting boot to desktop with autologin, and no screen blanking (sudo)..."
    sudo raspi-config nonint do_boot_behaviour B4   # desktop, autologin
    sudo raspi-config nonint do_blanking 1          # 1 = blanking off
elif [ -f /etc/gdm3/custom.conf ]; then
    # Ubuntu Desktop (GNOME): autologin in gdm, and no idle blanking/lock.
    echo "Enabling autologin for $USER in /etc/gdm3/custom.conf (sudo)..."
    sudo sed -i -E \
        -e "s/^#?\s*AutomaticLoginEnable\s*=.*/AutomaticLoginEnable=true/" \
        -e "s/^#?\s*AutomaticLogin\s*=.*/AutomaticLogin=$USER/" /etc/gdm3/custom.conf
    grep -q '^AutomaticLoginEnable=true' /etc/gdm3/custom.conf || \
        sudo sed -i "/^\[daemon\]/a AutomaticLoginEnable=true\nAutomaticLogin=$USER" /etc/gdm3/custom.conf
    gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
    gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || true
else
    echo "Couldn't find raspi-config or gdm. Set your desktop to log in"
    echo "automatically and never blank the screen, then reboot."
fi

echo
echo "Done. Reboot and the Pi comes up in the arcade:  sudo reboot"
echo "To try it now without rebooting:               ./run.sh"
echo "To leave the arcade for the desktop:           Alt+F4"
