#!/usr/bin/env bash
# Set up the Pi to boot straight into the arcade:
#   - chromium, if it is missing
#   - log straight into the desktop at boot (no password prompt)
#   - start the arcade when the desktop comes up
#   - never blank the screen
#
#   ./install.sh            set it up
#   ./install.sh --gpu      let chromium use the Pi's GPU for the 3D games
#                           (faster; turn it off again if the Pi becomes unstable)
#   ./install.sh --no-gpu   back to the safe default: WebGL in software
#   ./install.sh --remove   undo the autostart (the OS settings stay)
#
# Works on Ubuntu Desktop and Raspberry Pi OS with the desktop. If the old
# rpi-gamer kiosk is installed (a tty1 service, booting to the console), it
# is retired first so the desktop comes back.
set -eu
cd "$(dirname "$0")"
ARCADE_DIR="$PWD"
have() { command -v "$1" >/dev/null 2>&1; }
AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/rpi-arcade.desktop"
export PATH="$PATH:/snap/bin"

GPU_FLAG="${XDG_CONFIG_HOME:-$HOME/.config}/rpi-arcade/gpu"

case "${1:-}" in
    --remove)
        rm -f "$AUTOSTART"
        echo "Removed $AUTOSTART. The arcade no longer starts at boot."
        echo "(Autologin and screen blanking were left as they are.)"
        exit 0 ;;
    --gpu)
        mkdir -p "$(dirname "$GPU_FLAG")" && : > "$GPU_FLAG"
        echo "GPU on: chromium will use the Pi's GPU for WebGL. Restart the"
        echo "arcade (Alt+F4, then ./run.sh, or reboot). If the Pi hangs or"
        echo "reboots on a 3D game, run ./install.sh --no-gpu."
        exit 0 ;;
    --no-gpu)
        rm -f "$GPU_FLAG"
        echo "GPU off: WebGL runs in software (slower, always works)."
        exit 0 ;;
esac

if [ "$(id -u)" = 0 ]; then
    echo "Run this as the user who will log in, not as root (no sudo)." >&2
    exit 1
fi

# --- retire the old rpi-gamer kiosk --------------------------------------
# It ran a tty1 service and booted the Pi to the console; both would keep
# the desktop (and so this arcade) from ever appearing.
if [ -f /etc/systemd/system/rpi-arcade.service ]; then
    echo "Removing the old rpi-gamer kiosk service (sudo)..."
    sudo systemctl disable --now rpi-arcade.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/rpi-arcade.service
    sudo systemctl daemon-reload
    sudo systemctl enable getty@tty1.service 2>/dev/null || true
fi
if have systemctl && [ "$(systemctl get-default 2>/dev/null)" != "graphical.target" ]; then
    echo "Setting the Pi to boot to the desktop (sudo)..."
    sudo systemctl set-default graphical.target
fi

# --- chromium -------------------------------------------------------------
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
    # Over ssh there is no session bus in the environment; point at the
    # user's bus so the settings land in the desktop session.
    export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$(id -u)/bus}"
    if gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null &&
       gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null; then
        echo "Screen blanking and the lock screen are off."
    else
        echo "Couldn't change GNOME settings from here. In Settings > Power set"
        echo "Screen Blank to Never, and in Privacy > Screen Lock turn it off."
    fi
else
    echo "Couldn't find raspi-config or gdm. Set your desktop to log in"
    echo "automatically and never blank the screen, then reboot."
fi

echo
echo "Done. Reboot and the Pi comes up in the arcade:  sudo reboot"
echo "To try it now without rebooting:               ./run.sh"
echo "To leave the arcade for the desktop:           Alt+F4"
echo
echo "3D games run WebGL in software by default, which always works but is"
echo "slow. Once the arcade is up and stable, try the GPU: ./install.sh --gpu"
