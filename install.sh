#!/usr/bin/env bash
# Set up the Pi to boot straight into the arcade:
#   - chromium, if it is missing
#   - log straight into the desktop at boot (no password prompt)
#   - start the arcade when the desktop comes up
#   - never blank the screen
#
#   ./install.sh            set it up on top of the desktop (autostart)
#   ./install.sh --kiosk    set it up with no desktop: one X server on tty1
#                           with chromium as its only program (recommended
#                           for a touch-only arcade: the desktop's touch
#                           gestures grab a finger held still, and its
#                           compositor costs frames)
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
UNIT=/etc/systemd/system/rpi-arcade.service

remove_kiosk() {
    if [ -f "$UNIT" ]; then
        sudo systemctl disable --now rpi-arcade.service 2>/dev/null || true
        sudo rm -f "$UNIT"
        sudo systemctl daemon-reload
        sudo systemctl enable getty@tty1.service 2>/dev/null || true
    fi
}

case "${1:-}" in
    --remove)
        rm -f "$AUTOSTART"
        remove_kiosk
        echo "Removed the autostart and the kiosk service. The arcade no longer"
        echo "starts at boot. To get the desktop back after kiosk mode:"
        echo "  sudo systemctl set-default graphical.target && sudo reboot"
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

# --- chromium -------------------------------------------------------------
if ! have chromium && ! have chromium-browser && ! have google-chrome; then
    echo "Installing chromium..."
    sudo apt-get update
    # Raspberry Pi OS ships "chromium"; older releases and Ubuntu "chromium-browser".
    sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
fi

# --- kiosk mode: no desktop ----------------------------------------------
if [ "${1:-}" = "--kiosk" ]; then
    need=""
    for pkg in xinit xserver-xorg x11-xserver-utils matchbox-window-manager; do
        dpkg -s "$pkg" >/dev/null 2>&1 || need="$need $pkg"
    done
    if [ -n "$need" ]; then
        echo "Installing$need..."
        sudo apt-get update
        # shellcheck disable=SC2086
        sudo apt-get install -y $need
    fi
    # Let a plain login (not root) start the X server.
    printf 'allowed_users=anybody\nneeds_root_rights=yes\n' | sudo tee /etc/X11/Xwrapper.config >/dev/null
    # An X config left over from an SPI panel (the old rpi-gamer's MPI3501)
    # forces the plain framebuffer driver, which has no GPU: chromium then
    # finds no EGL and the 3D games run in software. Set such files aside;
    # Ubuntu's own generated config picks the GPU driver (modesetting).
    for conf in /etc/X11/xorg.conf.d/*.conf; do
        [ -f "$conf" ] || continue
        if grep -q -i 'Driver *"fbdev"' "$conf"; then
            echo "Setting aside $conf (forces the fbdev driver, no GPU)"
            sudo mv "$conf" "$conf.disabled-by-rpi-arcade"
        fi
    done
    sudo usermod -aG input,video,render,tty "$USER"
    chmod +x run.sh system/kiosk.sh system/xinitrc system/wait-for-display.sh
    rm -f "$AUTOSTART"      # never both the desktop autostart and the service
    sed -e "s|__ARCADE_DIR__|$ARCADE_DIR|g" -e "s|__ARCADE_USER__|$USER|g" \
        system/rpi-arcade.service.in | sudo tee "$UNIT" >/dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable rpi-arcade.service
    # Boot to the console, not the desktop: the desktop would take the screen.
    sudo systemctl set-default multi-user.target
    echo
    echo "Kiosk mode installed. Reboot and the Pi comes up in the arcade:  sudo reboot"
    echo "To stop it from ssh:        sudo systemctl stop rpi-arcade"
    echo "To start it again:          sudo systemctl start rpi-arcade"
    echo "To go back to the desktop:  ./install.sh --remove, then"
    echo "                            sudo systemctl set-default graphical.target && sudo reboot"
    exit 0
fi

# --- desktop mode ---------------------------------------------------------
# Retire a kiosk service (this arcade's or the old rpi-gamer's): it ran on
# tty1 and booted the Pi to the console; both would keep the desktop (and
# so this arcade) from ever appearing.
if [ -f "$UNIT" ]; then
    echo "Removing the kiosk service (sudo)..."
    remove_kiosk
fi
if have systemctl && [ "$(systemctl get-default 2>/dev/null)" != "graphical.target" ]; then
    echo "Setting the Pi to boot to the desktop (sudo)..."
    sudo systemctl set-default graphical.target
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
