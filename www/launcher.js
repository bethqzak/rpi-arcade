// The arcade menu: a grid of cabinets, each a web page. Picking one opens
// it in an iframe over the menu with an X in the corner to come back.
// Everything runs inside one browser window, so there is never a display
// hand-off: the thing that used to black-screen the old pygame arcade.
(function () {
  "use strict";

  const games = window.GAMES || [];
  const grid = document.getElementById("grid");
  const menu = document.getElementById("menu");
  const gameLayer = document.getElementById("game");
  const loading = document.getElementById("loading");
  const closeBtn = document.getElementById("close");
  const toast = document.getElementById("toast");
  const status = document.getElementById("status");

  let selected = 0;
  let frame = null;      // the iframe showing the current game, if any
  let notice = null;     // or a notice shown in its place
  let toastTimer = null;

  // ----------------------------------------------------------- the grid

  const cards = games.map((game, i) => {
    const cab = document.createElement("button");
    cab.type = "button";
    cab.className = "cab" + (game ? "" : " locked");
    cab.setAttribute("role", "listitem");

    const badge = document.createElement("span");
    badge.className = "badge " + (game ? "new" : "soon");
    badge.textContent = game ? "NEW!" : "COMING SOON";

    const screen = document.createElement("div");
    screen.className = "screen";
    screen.style.background = game ? game.screen || "" :
      "linear-gradient(160deg, #1c1f33 0%, #101223 100%)";
    const emoji = document.createElement("span");
    emoji.className = "screen-emoji";
    emoji.textContent = game ? game.emoji || "🎮" : "❓";
    screen.append(emoji);

    const info = document.createElement("div");
    info.className = "info";
    const h2 = document.createElement("h2");
    h2.textContent = game ? game.title : "Mystery Game";
    const p = document.createElement("p");
    p.textContent = game ? game.blurb || "" : "Top secret project.";
    const meta = document.createElement("div");
    meta.className = "meta";
    for (const text of game ? game.chips || [] : ["???"]) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      meta.append(chip);
    }
    const play = document.createElement("div");
    play.className = "play-btn";
    play.textContent = game ? "▶ PLAY" : "🔒 LOCKED";
    info.append(h2, p, meta, play);

    cab.append(badge, screen, info);
    if (game) {
      cab.addEventListener("click", () => { select(i); launch(i); });
    } else {
      cab.disabled = true;
    }
    grid.append(cab);
    return cab;
  });

  function columns() {
    return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  }

  function select(i) {
    const n = cards.length;
    selected = ((i % n) + n) % n;
    cards.forEach((c, j) => c.classList.toggle("selected", j === selected));
  }

  // ---------------------------------------------------------- the game

  function launch(i) {
    const game = games[i];
    if (!game || frame || notice) return;
    const remote = /^[a-z]+:\/\//i.test(game.url) && !game.url.startsWith("file:");
    gameLayer.hidden = false;
    menu.hidden = true;
    if (remote && navigator.onLine === false) {
      showNotice(game.title + " needs the internet",
                 "This Pi is not connected right now.",
                 "Tap ✕ to go back to the arcade.");
      return;
    }
    loading.hidden = false;
    // A fresh iframe each time: navigating an existing one would add a
    // history entry, and a page with history can't close itself (Shift+Q).
    frame = document.createElement("iframe");
    frame.setAttribute("allow", "fullscreen; autoplay");
    frame.title = game.title;
    frame.addEventListener("load", () => {
      loading.hidden = true;
      try { frame.focus(); frame.contentWindow.focus(); } catch (e) { /* cross-origin */ }
    });
    frame.src = game.url;
    gameLayer.prepend(frame);
    frame.focus();
  }

  function showNotice(headline, detail, small) {
    notice = document.createElement("div");
    notice.className = "notice";
    const h = document.createElement("h2");
    h.textContent = headline;
    const p = document.createElement("p");
    p.textContent = detail;
    const s = document.createElement("p");
    s.className = "small";
    s.textContent = small;
    notice.append(h, p, s);
    gameLayer.prepend(notice);
  }

  function closeGame() {
    if (frame) { frame.remove(); frame = null; }
    if (notice) { notice.remove(); notice = null; }
    loading.hidden = true;
    gameLayer.hidden = true;
    menu.hidden = false;
    cards[selected].focus();
  }

  closeBtn.addEventListener("click", closeGame);

  // A local game (Pac-Man) asks to leave by message; a cross-origin one
  // can't, which is what the X is for.
  window.addEventListener("message", (e) => {
    if (e.data && e.data.rpiArcade === "exit") closeGame();
  });

  // ------------------------------------------------------------ keyboard

  function showToast(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function quit() {
    // Works when this page is the window's only history entry (it is: the
    // kiosk opens straight onto it and games open in iframes). Otherwise
    // say how to leave by hand.
    window.close();
    setTimeout(() => showToast("To leave the arcade press Alt+F4"), 300);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Q" && e.shiftKey) { quit(); return; }
    if (!gameLayer.hidden) {
      if (e.key === "Escape") closeGame();
      return;
    }
    const cols = columns();
    switch (e.key) {
      case "ArrowRight": case "d": case "D": select(selected + 1); break;
      case "ArrowLeft":  case "a": case "A": select(selected - 1); break;
      case "ArrowDown":  case "s": case "S": select(selected + cols); break;
      case "ArrowUp":    case "w": case "W": select(selected - cols); break;
      case "Enter": case " ": launch(selected); break;
      default: return;
    }
    e.preventDefault();
  });

  // ------------------------------------------------- can we do 3D here?

  // The browser games are WebGL. Say which renderer the page gets, so a
  // slow Pi is explained at a glance: "llvmpipe" or "SwiftShader" means
  // software rendering (works, but crawls); "V3D" is the Pi's GPU.
  function webglStatus() {
    let gl = null;
    try {
      const canvas = document.createElement("canvas");
      gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    } catch (e) { gl = null; }
    if (!gl) {
      status.textContent = "3D: not available - the browser games will not start";
      status.classList.add("bad");
      return;
    }
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
                          : gl.getParameter(gl.RENDERER);
    const software = /llvmpipe|swiftshader|softpipe|software/i.test(renderer);
    status.textContent = "3D: " + renderer +
      (software ? " (software - games will be slow)" : "");
    status.classList.toggle("bad", software);
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  }

  // ------------------------------------------------------------- start

  select(0);
  webglStatus();
  window.addEventListener("online", () => { if (notice) closeGame(); });
})();
