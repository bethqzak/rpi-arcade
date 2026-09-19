# RPi Arcade — plan

Goal: the Play Centre games from `playyourgame206.github.io` running **locally** on a
Raspberry Pi 4B with the 7-inch 1024×600 HDMI touchscreen, as 3D games, with **no lag**.

This document is the plan. It records what we are starting from, the hardware limits,
the engine decision, the performance budget that defines "no lag", the Pi setup, the
repo layout, and the phases of work.

---

## 1. What we are starting from

| Game | Today | Engine | Size | Notes |
|---|---|---|---|---|
| Coin Collector | 3D | three.js r128 | 94 KB | Cat/dog explorer, day/night, synthesised lofi music, touch joystick, Supabase multiplayer |
| PC Builder Tycoon | 3D | three.js r128 | 107 KB | Shop / build tycoon, touch joystick, Supabase multiplayer |
| 3D Laundry Simulator | 3D | three.js r128 | 146 KB | Biggest game: ~108 meshes, 75 materials, 4 avatars, edit mode, Supabase multiplayer |
| Virus PC Simulator | 2D | Plain DOM / CSS | 127 KB | Fake Windows 11 desktop, canvas for small bits only |
| Windows Desktop Simulator | 2D | Plain DOM / CSS | 285 KB | Fake Windows 11 desktop with mini-apps (Paint, Snake, YouTube, Roblox…) |

Shared web code: `save-tools.js` (per-device ID, auto-save flag, `ANDY1.<game>.<base64>`
transfer codes), `volume-menu.js` (swipe-down master volume with boost), `webgl-check.js`.

Three of the five are already 3D. All 3D geometry is built in code from primitives
(boxes, spheres, cylinders, cones, tori) with canvas-painted textures. There are no
model, texture or audio files in the repo. That matters: there is no art pipeline to
port, only code.

## 2. The hardware

**Raspberry Pi 4B**: 4× Cortex-A72 @ 1.5 GHz, VideoCore VI GPU (OpenGL ES 3.1 and
Vulkan 1.2 through Mesa V3D / V3DV). Roughly the GPU of a 2015 mid-range phone.

**7inch HDMI Display-C (SKU MPI7002)**, from the attached manual:

- 1024 × 600 native, HDMI in. "Software resolution up to 1920×1080" means the panel will
  accept and downscale 1080p. We must **not** let the Pi do that: rendering 1080p is
  3.4× the pixels of 1024×600 for no visible gain.
- 5-point capacitive touch over USB (standard HID, no driver on Linux).
- Backlight switch, powered from the Pi's USB. The manual says use a full 2 A supply;
  with the Pi itself use the official 5 V 3 A PSU. Under-voltage throttles the CPU,
  which reads as lag.
- No speakers mentioned. Assume audio goes out the Pi's 3.5 mm jack or a USB speaker.
- The manual's `config.txt` lines (`hdmi_cvt 1024 600 60 6 0 0 0` etc.) are for the
  legacy firmware video driver. On current Raspberry Pi OS (KMS driver) they are ignored;
  the equivalent is a `video=` kernel argument (see §5).

## 3. Why the current games would lag on the Pi

Running the existing pages in Chromium on the Pi would be slow for reasons that are in
the code, not just the browser:

- `MeshStandardMaterial` (full PBR lighting) on every object.
- Real-time shadows: 2048×2048 shadow map with `PCFSoftShadowMap`, cast by most meshes.
- `antialias: true` plus `setPixelRatio` up to 2 or 2.5. That can mean rendering at
  2560×1500 and downsampling, on a GPU that struggles at 1080p.
- 40–110 separate meshes per scene, each its own draw call, no instancing.
- `FogExp2`, sprites, particle points, plus DOM overlays composited on top.
- Chromium itself adds two to three frames of input-to-photon latency and periodic
  JavaScript garbage-collection stalls, which touch input makes very noticeable.

Estimate (not measured yet): 5–15 fps as-is. A tuned browser build (shadows off, pixel
ratio 1, no AA, Lambert materials) would probably reach 25–40 fps with hitches. That is
not "no lag". Phase 0 measures this so the estimate becomes a number.

## 4. Decision: Godot 4, Compatibility renderer, GDScript, native arm64 build

**Engine: Godot 4.4 or newer** (currently 4.5/4.6), exported as a native **Linux arm64**
binary using the official export templates (official arm64 Linux builds and templates
have shipped since 4.2/4.3). **Renderer: Compatibility** (OpenGL ES 3.0), which is the
one designed for mobile-class GPUs like the VideoCore VI. **Language: GDScript** (the
existing game logic is JavaScript; GDScript is the closest port and needs no toolchain).

Why this and not the alternatives:

- **Chromium kiosk + tuned three.js**: cheapest, but caps out well below 60 fps with
  browser latency and GC jank on top. Kept as the fallback for the two 2D Windows
  simulators only (§8, Phase 5).
- **raylib (C)**: the fastest thing on a Pi (can even draw straight to DRM with no
  display server), but no scene editor, no UI toolkit worth the name, no physics. These
  games are UI-heavy tycoons (shops, modals, settings tabs, save codes). Rejected on
  effort.
- **Unity / Unreal**: no practical arm64 Linux player for the Pi. Rejected.
- **Godot 3.6 (GLES2)**: the classic "works on a Pi" choice, still maintained, but
  legacy. It is the fallback if the 4.x Compatibility renderer misbehaves on the V3D
  driver in Phase 0.

What Godot gives us for free that the JS games hand-roll: Control-node UI, touch and
multi-touch input, virtual joystick, physics, audio buses (the volume menu becomes a
slider on the Master bus), JSON saves, scene switching for the launcher, an FPS/frame
time monitor, and a headless export that runs in GitHub Actions.

## 5. Pi setup (target configuration)

- **OS**: Raspberry Pi OS **Bookworm 64-bit Lite** (no desktop). 64-bit is required for
  the arm64 Godot build.
- **`/boot/firmware/config.txt`**: `dtoverlay=vc4-kms-v3d`, `max_framebuffers=2`,
  `disable_splash=1`. Leave the manual's `hdmi_*` / `hdmi_cvt` lines out.
- **`/boot/firmware/cmdline.txt`**: append `video=HDMI-A-1:1024x600M@60D` so the Pi
  drives the panel at native resolution even if its EDID advertises 1080p. Verify with
  `kmsprint` or `cat /sys/class/drm/card*-HDMI-A-1/modes`.
- **Display server**: `cage` (single-application Wayland kiosk compositor, wlroots).
  It shows one maximised app and any window that app spawns on top, which is exactly a
  launcher that can also spawn Chromium. Godot 4.3+ has a native Wayland backend.
  Fallback: `labwc` with an autostart entry, if cage has any touch or vsync problem.
- **Autostart**: systemd service `arcade.service` (`Restart=always`) starting
  `cage -- /opt/rpi-arcade/arcade.arm64` as an auto-logged-in `arcade` user on tty1.
- **Touch**: USB HID, handled by libinput, mapped to the only output automatically. If
  the screen is mounted rotated, rotate the output in the compositor and touch follows;
  the manual's X11 `CalibrationMatrix` is only needed on X11.
- **Performance hygiene**: `performance` CPU governor, screen blanking off, Wi-Fi power
  save off, official PSU, and a **heatsink + fan**. The Pi 4 throttles from 80 °C and a
  GPU-loaded Pi in a closed case gets there. Throttling looks exactly like lag.
- **Audio**: default ALSA/PipeWire sink set to the 3.5 mm jack or USB speaker. Verify
  the panel has no HDMI audio before relying on it.
- **Optional**: a USB gamepad. Godot picks it up with no code beyond an input map.

All of this is scripted in `pi/setup.sh` so a fresh SD card becomes an arcade in one run.

## 6. Performance budget — what "no lag" means, in numbers

Every scene must meet this on the real Pi 4 at 1024×600 before it is "done":

| Metric | Target |
|---|---|
| Frame rate | 60 fps, V-sync on, steady (no drops below 55 over 5 minutes of play) |
| Frame time | ≤ 12 ms typical, leaving headroom for the OS and audio |
| Touch response | visible reaction within 2 frames (≈ 33 ms) |
| Draw calls per frame | ≤ 150 |
| Visible triangles | ≤ 100 k |
| Boot to launcher | ≤ 30 s |
| Thermal | CPU < 75 °C after 30 min; `vcgencmd get_throttled` reports `0x0` |

Rules that get us there:

- No real-time shadows by default. If a scene wants one, a single 1024 directional
  shadow, and only if it still meets the frame-time target. Fake contact shadows with a
  dark disc mesh under characters (cheap and looks fine in this art style).
- MSAA off (2× at most). No glow, SSAO or other post-processing.
- Materials: `StandardMaterial3D` with per-pixel lighting off (vertex lighting) or
  unshaded, vertex colours instead of textures where possible. The canvas-painted
  textures become small PNGs or `GradientTexture`s.
- One `MultiMeshInstance3D` for every repeated thing: coins, trees, grass tufts, rocks,
  stars, laundry items.
- Each prop (cat, washer, truck, shop stall) is built once from primitives and merged
  into a single `ArrayMesh` with `SurfaceTool`, so it is one draw call, not fifteen.
- Physics at 60 Hz, `CharacterBody3D` capsules and box colliders only. No rigid-body
  piles.
- GDScript: no allocations in `_process`, pre-create nodes, use object pools for
  pickups and particles.
- A **performance overlay** (fps, frame time, draw calls, temperature) toggled with a
  five-finger tap, and a `--perf-log` flag that writes frame times to a CSV so
  regressions are caught on the Pi, not by eye.

## 7. Repo layout (`rpi-arcade`)

```
rpi-arcade/
├── project.godot
├── export_presets.cfg              # Linux arm64, Compatibility renderer
├── launcher/                       # the "Play Centre" cabinet grid, attract mode
├── games/
│   ├── coin_collector/
│   ├── pc_builder/
│   └── laundry/
├── shared/                         # autoloads used by every game
│   ├── save.gd                     # user://saves/<game>.json, ANDY1 transfer codes
│   ├── settings.gd
│   ├── volume.gd                   # Master bus + swipe-down volume overlay
│   ├── touch.gd                    # virtual joystick, tap-to-interact, gestures
│   ├── perf.gd                     # FPS overlay, frame-time CSV
│   └── mesh_builder.gd             # primitives -> merged ArrayMesh helpers
├── web/                            # offline copies of the two DOM games (Phase 5)
├── pi/
│   ├── setup.sh                    # OS packages, cage, service, config.txt/cmdline.txt
│   ├── arcade.service
│   ├── deploy.sh                   # scp the export to the Pi and restart the service
│   └── config/
├── docs/PLAN.md                    # this file
└── .github/workflows/build.yml     # headless export -> arcade-linux-arm64 artifact
```

Development happens on a PC with the Godot editor. Every change that touches rendering
is run on the Pi via `pi/deploy.sh` (scp + service restart, about 10 s round trip). The
editor also runs on the Pi itself (arm64 build) for quick checks, but it is slow there.

## 8. Phases

### Phase 0 — Prove it (before writing any game code)

1. Flash Bookworm 64-bit Lite, run `pi/setup.sh`, confirm the panel is at 1024×600@60
   and touch works in a Wayland session.
2. Install the Godot arm64 runtime and run a **stress scene**: 200 draw calls, 100
   moving primitive characters, one 1024 shadow toggle, a MultiMesh of 2000 coins.
   Record fps, frame time and temperature with and without shadows / MSAA.
3. As a baseline, open `coin_collector.html` in Chromium on the same Pi (local copy,
   quick patch: shadows off, pixel ratio 1, no AA). Record fps and how the touch feels.
4. **Decision gate**: Godot Compatibility at 60 fps in the stress scene → proceed.
   If not, try Godot 3.6 GLES2 and Godot 4 Mobile (Vulkan) before anything else.

Output: numbers in `docs/PERF.md`, the stress scene kept as a regression check.

### Phase 1 — Foundation

- Repo skeleton (§7), `project.godot` with Compatibility renderer, 1024×600 base
  resolution, V-sync on, physics 60 Hz.
- Launcher: the Play Centre cabinet grid rebuilt as a Godot UI, touch scrolling, tap to
  play, hold-corner or four-finger-swipe to return to the launcher from any game.
- Shared autoloads: save (same JSON shapes and `ANDY1` transfer codes as the web
  games, so a save can move between web and Pi), settings, volume overlay, touch
  joystick, perf overlay.
- `pi/setup.sh`, `arcade.service`, `deploy.sh`.
- GitHub Actions workflow: headless Godot export to Linux arm64 on every push, artifact
  attached; tagging a release publishes it so the Pi can self-update with one command.

### Phase 2 — Coin Collector (smallest 3D game, first port)

World (ground, trees, rocks, fences), cat and dog avatars from merged primitives,
coins as a MultiMesh, day/night with sky colour lerp and fireflies as a MultiMesh,
four difficulty levels, camera orbit and zoom by touch, joystick movement, coin
counter and win screen, saves. Music: the synthesised lofi loop becomes an
`AudioStreamGenerator` port or pre-rendered `.ogg` loops (simpler and cheaper on CPU;
preferred).

### Phase 3 — PC Builder Tycoon

Shop, inventory, part catalogue (i3-4170 → i9-14900KF / RTX 5090), build bench,
delivery truck, money and stats, multiple avatars, settings tabs. Multiplayer left out
(§9).

### Phase 4 — 3D Laundry Simulator

The largest port: conveyor, plots, washer tiers up to the Quantum Washer, edit mode,
shop room, trucks, four avatars, tips bar. Expect this to take as long as Phases 2 and 3
together.

### Phase 5 — The two Windows simulators

They are 2D DOM applications, and a fake Windows desktop is not obviously improved by
being 3D. Two options, cheapest first:

- **A (do first)**: keep them as HTML. Copy them into `web/`, make them fully offline
  (bundle the Google font, replace the external wallpaper URL with the repo's
  `wallpaper.jpg`), and have the launcher spawn `chromium --kiosk file://…`. Under cage
  the browser appears on top and the launcher returns when it exits. Chromium is fine
  for DOM apps at this resolution.
- **B (later, if wanted)**: a 3D room with a PC on a desk, and the desktop drawn onto
  the monitor through a `SubViewport`. That requires porting the desktop UI into Godot
  Control nodes, which is the biggest single job in the project. Decide after Phase 4.

### Phase 6 — Polish and soak

Attract mode on the launcher, sound effects, a 30-minute soak test per game against the
§6 budget with temperature logging, SD-card image or `setup.sh` re-run documented in the
README, and the "how to update the Pi" one-liner.

## 9. Decisions taken and things left out

- **Multiplayer is off in v1.** The web games use Supabase Realtime for it. The Pi
  arcade is single-player. If wanted later, Godot's `WebSocketPeer` can talk to Supabase
  Realtime, or two Pis can use ENet on the LAN.
- **The website is untouched.** `rpi-arcade` is a separate codebase that shares the
  save-code format and the game designs, not code.
- **Saves are compatible** with the web transfer codes so progress can be typed across
  (a USB keyboard is easier than the touchscreen for that).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Godot 4 Compatibility renderer hits a Mesa V3D driver bug | Phase 0 gate; fallbacks are Godot 4 Mobile (Vulkan) and Godot 3.6 GLES2 |
| Touch or V-sync problems under cage | Swap to labwc; both are wlroots so the rest is unchanged |
| Heat throttling in a case | Fan + heatsink is part of the hardware spec; temperature on the perf overlay |
| Panel negotiates 1080p and the Pi renders it | Forced `video=` mode; check `kmsprint` in setup.sh |
| Laundry Simulator port effort | Ported last, after the shared tooling has been proven on two games |
