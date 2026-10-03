// The arcade's cabinets. Each one is a web page: Pac-Man ships in this
// repo, the rest are the Play Centre games at https://playyourgame206.github.io/
// (the 3D ones are three.js, drawn with WebGL in the browser).
//
// "?pi=1" on a 3D game's address puts it in Pi mode: a render height a
// Pi 4 can manage (480 lines; "?pi=600" for another), no shadows or
// antialiasing, and the touch controls shown. Only the arcade adds it.
//
// To add or swap a game, edit an entry or replace the final slot:
//
//   { title: "My Game", blurb: "What it is", emoji: "🎮",
//     url: "https://example.com/mygame.html",
//     screen: "linear-gradient(160deg, #3a1f5c 0%, #170d33 100%)",
//     chips: ["3D", "NEW"] }
//
// Six fit the screen. A null slot draws as a locked "coming soon" cabinet.
window.GAMES = [
  {
    id: "laundry",
    title: "3D Laundry Simulator",
    blurb: "Grab laundry off the conveyor, claim your plot, and build a washing machine empire.",
    emoji: "🧺",
    url: "https://playyourgame206.github.io/laundry_simulator.html?pi=1",
    screen: "linear-gradient(160deg, #123a5c 0%, #0d2038 100%)",
    chips: ["3D", "TYCOON"],
  },
  {
    id: "coins",
    title: "Coin Collector",
    blurb: "Explore a huge 3D world as a tabby cat and hunt down every gold coin.",
    emoji: "🪙",
    url: "https://playyourgame206.github.io/coin_collector.html?pi=1",
    screen: "linear-gradient(160deg, #2c5a1e 0%, #14290f 100%)",
    chips: ["3D", "ADVENTURE"],
  },
  {
    id: "pcbuilder",
    title: "PC Builder Tycoon",
    blurb: "Collect CPUs, GPUs and motherboards from the shop and build computers.",
    emoji: "🖥️",
    url: "https://playyourgame206.github.io/pc_builder.html?pi=1",
    screen: "linear-gradient(160deg, #3a1f5c 0%, #170d33 100%)",
    chips: ["3D", "TYCOON"],
  },
  {
    id: "viruspc",
    title: "Virus PC Simulator",
    blurb: "A Windows 11 desktop. Download things you shouldn't and see how long it survives.",
    emoji: "🖱️",
    url: "https://playyourgame206.github.io/virus_pc.html",
    screen: "linear-gradient(160deg, #0d3a6e 0%, #07162e 100%)",
    chips: ["WINDOWS 11", "CHAOS"],
  },
  {
    id: "desktop",
    title: "Windows Desktop Simulator",
    blurb: "A realistic Windows 11 desktop: Explorer, Notepad, Paint, Edge and Terminal.",
    emoji: "🪟",
    url: "https://playyourgame206.github.io/desktop_simulator.html",
    screen: "linear-gradient(160deg, #1d5fbf 0%, #0b2a5c 100%)",
    chips: ["WINDOWS 11", "SANDBOX"],
  },
  {
    id: "pacman",
    title: "Pac-Man",
    blurb: "Eat the dots, dodge the ghosts. Works offline.",
    emoji: "👻",
    url: "pacman.html",
    screen: "linear-gradient(160deg, #2121de 0%, #0a0a4a 100%)",
    chips: ["CLASSIC", "OFFLINE"],
  },
];
