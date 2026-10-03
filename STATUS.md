# Where things are up to

Working notes for the Raspberry Pi 4B arcade. Last updated 3 October 2026,
end of the day. Read this first in a new session.

## The setup

- **Hardware:** Raspberry Pi 4B rev 1.5, 8 GB, Ubuntu 26.04 Desktop
  (kernel 7.0 raspi), a 7" HDMI touchscreen at 1024x600 with a
  `wch.cn USB2IIC_CTP_CONTROL` USB touch controller (touch only, no mouse
  emulation). No keyboard or mouse attached. User `beth`, ssh over wlan.
- **This repo (`bethqzak/rpi-arcade`)** is the arcade: one Chromium window
  in kiosk mode on a launcher page (`www/`), styled like the Play Centre
  site, with Pac-Man in this repo and five Play Centre games opened in an
  iframe with an ✕ to come back. All work is on branch
  `claude/great-ride-1atubp`; `main` still holds only the initial commit.
- **The games** live in `playyourgame206/playyourgame206.github.io`
  (the Play Centre, GitHub Pages). The 3D ones (Laundry, Coin Collector,
  PC Builder) are three.js. They have a **Pi mode** (`?pi=1`, added today
  and merged to `main` there): 480-line rendering, no shadows or
  antialiasing, Lambert shading instead of PBR, touch controls forced on,
  and a corner readout "N fps M draws | touch sA mB eC cD". Nothing
  changes for a game opened without `?pi=1`. The arcade adds `?pi=1`.
- **The old arcade (`bethqzak/rpi-gamer`)** is retired. Its tty1 service
  and its SPI-panel X configs (`99-lcd.conf`, `99-mpi3501.conf`) were the
  cause of several of today's problems; both are now removed / set aside
  by this repo's installer.

## Mode the Pi is in now: kiosk

`./install.sh --kiosk` was run: the Pi boots to the console
(`multi-user.target`) and the `rpi-arcade` systemd service runs one bare
X server on tty1 (`system/kiosk.sh` → `system/xinitrc` → `run.sh`) with
matchbox and Chromium. X is on the `modesetting` driver with glamor on
V3D (confirmed in `/var/log/Xorg.0.log`). From ssh:
`sudo systemctl restart|stop|start rpi-arcade`. Chromium's log is
`~/.cache/rpi-arcade/chromium.log`.

Why kiosk and not the desktop: on GNOME a finger held still for ~3 s is a
long press; the compositor took the touch from the game (stick dropped)
and knocked Chromium out of full screen. Kiosk mode fixed both.

GPU mode is on (`~/.config/rpi-arcade/gpu` exists): Chromium runs with
`--use-angle=gles` and Vulkan off, since the Pi's Vulkan driver can't
satisfy Chromium. `--enable-unsafe-swiftshader` is always on as the
software fallback. `--ozone-platform=x11` is set outright (native Wayland
lost touches; the snap's Wayland IME flag killed touch entirely).

## Confirmed working at end of day

- Arcade boots by itself, touch on the menu, games open and close.
- Laundry: PLAY works, the floating stick and camera pan work, roughly
  32 fps at 480 lines on the GPU (desktop mode measurement; kiosk should
  be the same or better).
- Chromium stays full screen through a long press (kiosk mode).
- `-nocursor` on the X server so no pointer trails a finger (pushed, needs
  `git pull && sudo systemctl restart rpi-arcade` if not yet picked up).

## Not yet confirmed (ask for these first next time)

1. The "3D:" status line at the bottom of the menu in kiosk mode. It must
   name V3D. Chromium's last start wrote no GPU errors, which is promising,
   but it was never read back. If it says SwiftShader, look at
   `grep -a -i -E 'egl|gpu|angle' ~/.cache/rpi-arcade/chromium.log | tail`.
2. The corner readout numbers in Laundry and Coin Collector in kiosk mode.
3. Whether the stick holds still for 10 s without dropping now that GNOME
   is out of the way. If it still drops, the readout's `e`/`c` counters say
   whether the browser sent touchend or touchcancel.
4. Whether the cursor is gone after the `-nocursor` restart.

## Hardware notes (important)

- **Touch dropping out:** four times today the touch controller vanished
  from the USB bus (`lsusb | grep -i 1a86` prints nothing), once with a
  garbled USB descriptor in the kernel log. Only the screen's own power
  switch brought it back. Root cause found at the end: **a loose USB plug
  on the touchscreen cable**, now reseated. If it recurs, check the plug
  first, then `sudo dmesg | grep -v audit | grep -i -E 'usb 1-|wch'`.
- **Spontaneous reboots:** three hard resets today, all with the GPU under
  load, and one clean systemd reboot 24 s after a desktop login that
  nothing explains. None since the old tty1 service was removed. Not yet
  known whether the loose USB was involved. The power supply model and how
  the screen is powered were asked several times and never answered; if
  resets recur, that is the first question. Readout right after one:
  `sudo journalctl -b -1 -n 12 --no-pager`.
- `vcgencmd` doesn't work on Ubuntu (no /dev/vcio). Undervoltage alarm:
  `cat /sys/class/hwmon/hwmon*/in0_lcrit_alarm` (1 = supply dipped).

## Open ideas for more speed, in order of payoff

1. Coin Collector issues ~375 draw calls a frame (trees/coins); batching
   them with instancing would help most. Laundry is ~90-120, PC Builder ~35.
2. 360 lines instead of 480: `?pi=360` in `www/games.js`.
3. A Pi 5 is 2-3x faster and would run these games comfortably as is.

## Handy commands

```bash
cd ~/rpi-arcade && git pull && sudo systemctl restart rpi-arcade   # new arcade code
cd ~/rpi-arcade && ./install.sh --kiosk                             # re-run kiosk setup
./install.sh --gpu | --no-gpu                                       # GPU toggle
./install.sh            # back to desktop mode (then sudo reboot)
./tools/check.sh        # everything about the Pi in one paste
```
