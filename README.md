# RPI Arcade

A Raspberry Pi 4 arcade cabinet with a touchscreen that boots straight into
the [Play Centre](https://playyourgame206.github.io/) games, plus Pac-Man.

It is one Chromium window in kiosk mode showing a launcher page. Picking a
cabinet opens the game inside that same window, with an ✕ in the corner to
come back. Nothing ever hands the display between programs, which is what
made the previous pygame arcade black-screen and reboot the Pi.

- **3D games** are three.js over WebGL, drawn by the Pi's GPU through the
  stock Raspberry Pi OS Chromium. The launcher shows which renderer it is
  getting in the status line at the bottom.
- **Pac-Man** is in this repo (`www/pacman.html`) and works offline.
- **Touch, keyboard and mouse** all work: tap a cabinet, or arrows/WASD
  and Enter.

```
rpi-arcade/
├── install.sh                   # chromium + autologin + autostart + no blanking
├── run.sh                       # start the arcade now (what autostart runs)
├── www/
│   ├── index.html, style.css    # the launcher, styled like the Play Centre
│   ├── launcher.js              # grid, keyboard, the game layer and its ✕
│   ├── games.js                 # the cabinets: edit this to add or swap a game
│   └── pacman.html, pacman.js   # Pac-Man on a canvas
└── system/rpi-arcade.desktop.in # the desktop autostart entry
```

## Setup

Works on **Ubuntu Desktop** and on **Raspberry Pi OS with desktop**. On the
Pi, over ssh or in a terminal:

```bash
git clone https://github.com/bethqzak/rpi-arcade.git
cd rpi-arcade
./install.sh
sudo reboot
```

The installer:

- retires the old `rpi-gamer` kiosk if it is there (its tty1 service, and
  the boot-to-console setting it needed), so the desktop comes back;
- installs Chromium if it is missing;
- sets the Pi to log into the desktop automatically and never blank the
  screen (via `raspi-config` on Raspberry Pi OS, GDM and GNOME settings on
  Ubuntu);
- adds a desktop autostart entry that runs `run.sh`.

To try it without rebooting: `./run.sh` from a terminal on the desktop.
To undo the autostart: `./install.sh --remove`.

### 3D speed: software first, then the GPU

Chromium blocklists the Pi's GPU, so by default the arcade runs WebGL in
software. That always works, but the 3D games will be slow. Once the
arcade is up and stable, switch the GPU on:

```bash
./install.sh --gpu      # then Alt+F4 and ./run.sh, or reboot
```

The status line at the bottom of the menu changes from "SwiftShader
(software)" to the Pi's "V3D" renderer when it works. If the Pi hangs or
reboots during a 3D game with the GPU on, that is the GPU driver, and
`./install.sh --no-gpu` puts it back.

## Controls

| Where            | Keyboard                    | Touch                         |
| ---------------- | --------------------------- | ----------------------------- |
| Menu             | Arrows/WASD, Enter to play  | Tap a cabinet                 |
| Any game         | ESC (Pac-Man only)          | Tap ✕ top-right               |
| Pac-Man          | Arrows/WASD                 | D-pad, swipe, or tap to go    |
| 3D games         | the game's own controls     | the game's own touch controls |
| Leave the arcade | Alt+F4, or Shift+Q in the menu | —                          |

ESC can't reach the launcher from inside a web game (the game's page owns
the keyboard), so the ✕ is the way back from those. A game's own
"🏠 Home" button opens the Play Centre's web menu inside the arcade; ✕
still brings you back.

## Adding a game

Edit `www/games.js`. Each cabinet is one entry; any web page works:

```js
{
  title: "My Game",
  blurb: "What it is",
  emoji: "🎮",
  url: "https://example.com/mygame.html",
  screen: "linear-gradient(160deg, #3a1f5c 0%, #170d33 100%)",
  chips: ["3D", "NEW"],
},
```

A page in `www/` is a local game (give its file name as the `url`). Six
cabinets fit the screen; a `null` entry draws as a locked slot.

## Troubleshooting

- **The 3D games are slow** — the status line at the bottom of the menu
  says "SwiftShader (software)". Try `./install.sh --gpu` (above).
  `./run.sh --gpu` opens Chromium's own GPU page if you want the details.
- **A 3D game says it needs WebGL** — the browser has no WebGL at all,
  which shouldn't happen with the software fallback in `run.sh`; check
  `~/.cache/rpi-arcade/chromium.log` and `./run.sh --gpu`.
- **A game shows "needs the internet"** — the Play Centre games load from
  the web. Connect the Pi to Wi-Fi; the menu notices when it comes back.
- **The arcade starts and vanishes at once** — look in
  `~/.cache/rpi-arcade/chromium.log`. "SingletonLock: Permission denied"
  means a snap Chromium was given a profile folder it may not write;
  `run.sh` keeps a snap's profile under `~/snap/chromium/common`, so
  `git pull` if you see that.
- **The arcade doesn't start at boot** — the autostart entry is
  `~/.config/autostart/rpi-arcade.desktop`; check the Pi boots to the
  desktop logged in (`sudo raspi-config` → System Options → Boot / Auto
  Login → Desktop Autologin). Chromium's output goes to
  `~/.cache/rpi-arcade/chromium.log`.
- **It restarts the Pi when a game opens** — that was the old arcade
  (`rpi-gamer`), which switched the display between a pygame app and a
  separate X server with Chromium forced onto the GPU. This one doesn't do
  any of that, and leaves the GPU alone unless you turn it on. If a reboot
  still happens with the GPU off, check the power supply: a touchscreen
  powered from the Pi's USB can push a weak one under (on Raspberry Pi OS
  `vcgencmd get_throttled` prints `0x0` when the supply is fine).
- **The desktop never appears, just a console or a black screen** — the
  Pi is still set to boot to the console from the old kiosk. Run
  `./install.sh` again (it sets `graphical.target`), or by hand:
  `sudo systemctl set-default graphical.target && sudo reboot`.
