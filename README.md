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

Use **Raspberry Pi OS (64-bit) with desktop**, Bookworm or later. Its
Chromium has working GPU acceleration on the Pi out of the box; the Ubuntu
snap does not, which is where the old arcade's trouble started. Flash it
with Raspberry Pi Imager, boot, connect to Wi-Fi, then:

```bash
sudo apt install -y git
git clone https://github.com/bethqzak/rpi-arcade.git
cd rpi-arcade
./install.sh
sudo reboot
```

The installer installs Chromium if it is missing, sets the Pi to log into
the desktop automatically, turns off screen blanking, and adds a desktop
autostart entry that runs `run.sh`. Ubuntu Desktop works too (it sets up
GDM autologin instead); anything else gets printed instructions.

To try it without rebooting: `./run.sh`. To undo the autostart:
`./install.sh --remove`.

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

- **The 3D games are slow** — look at the status line at the bottom of the
  menu. "V3D" is the Pi's GPU and is what you want. "SwiftShader" or
  "llvmpipe" means software rendering: check `./run.sh --gpu`, which opens
  Chromium's own GPU page, and that you are on Raspberry Pi OS with the
  desktop (not Ubuntu's snap Chromium).
- **A 3D game says it needs WebGL** — same cause; the browser has no WebGL
  at all. `./run.sh --gpu` shows why.
- **A game shows "needs the internet"** — the Play Centre games load from
  the web. Connect the Pi to Wi-Fi; the menu notices when it comes back.
- **The arcade doesn't start at boot** — the autostart entry is
  `~/.config/autostart/rpi-arcade.desktop`; check the Pi boots to the
  desktop logged in (`sudo raspi-config` → System Options → Boot / Auto
  Login → Desktop Autologin). Chromium's output goes to
  `~/.cache/rpi-arcade/chromium.log`.
- **It restarts the Pi when a game opens** — that was the old arcade
  (`rpi-gamer`), which switched the display between a pygame app and a
  separate X server with Chromium forced onto the GPU. This one doesn't do
  any of that. If a reboot still happens, check the power supply first:
  `vcgencmd get_throttled` prints `0x0` on a healthy supply, and a
  touchscreen powered from the Pi's USB can push a weak one under.
