# rpi-arcade

The Play Centre games from [playyourgame206.github.io](https://playyourgame206.github.io)
rebuilt to run natively on a Raspberry Pi 4B with a 7-inch 1024×600 touchscreen.

Engine: Godot 4 (Compatibility renderer), exported as a Linux arm64 binary and run in a
`cage` kiosk session at boot.

Start with [docs/PLAN.md](docs/PLAN.md): what we are porting, the hardware limits, the
performance budget that defines "no lag", the Pi setup, and the phases of work.
