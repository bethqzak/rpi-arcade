// A small Pac-Man for the arcade, drawn on a canvas with plain shapes so
// there is nothing to download. A port of the pygame original.
//
// Controls:
//   Arrow keys / WASD   steer
//   Touch               the on-screen d-pad, a swipe, or a tap where you want to go
//   ESC or the X        back to the arcade (the launcher closes this page)
(function () {
  "use strict";

  // '#' wall, '.' pellet, 'o' power pellet, 'P' player start, 'G' ghost start
  const MAZE = [
    "###################",
    "#........#........#",
    "#o##.###.#.###.##o#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.###.#.###.####",
    "#....#..G.G..#....#",
    "####.#.#####.#.####",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#o.#.....P.....#.o#",
    "##.#.#.#####.#.#.##",
    "#....#...#...#....#",
    "###################",
  ];
  const COLS = MAZE[0].length;
  const ROWS = MAZE.length;

  const WALL = "#2121de", PELLET = "#ffc896", PACMAN = "#ffd200";
  const GHOST_COLORS = ["#ff3c3c", "#ff82de"];
  const FRIGHTENED = "#3c3cff", TEXT = "#fff";

  const PAC_SPEED = 4.5, GHOST_SPEED = 3.8, FRIGHT_SPEED = 2.6, FRIGHT_TIME = 6.0;
  const UP = [0, -1], DOWN = [0, 1], LEFT = [-1, 0], RIGHT = [1, 0], STOP = [0, 0];
  const DIRS = [UP, DOWN, LEFT, RIGHT];

  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const isWall = (tx, ty) => tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || MAZE[ty][tx] === "#";
  const key = (x, y) => y * COLS + x;

  // ------------------------------------------------------------ entities

  class Entity {
    constructor(tx, ty, speed) {
      this.home = [tx, ty];
      this.speed = speed;
      this.reset();
    }
    reset() { this.x = this.home[0] + 0.5; this.y = this.home[1] + 0.5; this.dir = STOP; }
    tile() { return [Math.floor(this.x), Math.floor(this.y)]; }
    atCenter() {
      return Math.abs(this.x - Math.floor(this.x) - 0.5) < 0.08 &&
             Math.abs(this.y - Math.floor(this.y) - 0.5) < 0.08;
    }
    canGo(d) { const [tx, ty] = this.tile(); return !isWall(tx + d[0], ty + d[1]); }
    snap() { const [tx, ty] = this.tile(); this.x = tx + 0.5; this.y = ty + 0.5; }
    advance(dt) {
      this.x += this.dir[0] * this.speed * dt;
      this.y += this.dir[1] * this.speed * dt;
      if (this.dir[0] !== 0) this.y = Math.floor(this.y) + 0.5;      // stay in the corridor
      else if (this.dir[1] !== 0) this.x = Math.floor(this.x) + 0.5;
      const [tx, ty] = this.tile();
      if (isWall(tx + this.dir[0], ty + this.dir[1])) {               // stop at the wall
        const cx = tx + 0.5, cy = ty + 0.5;
        if ((this.x - cx) * this.dir[0] > 0 || (this.y - cy) * this.dir[1] > 0) this.snap();
      }
    }
    // Slices for one frame's move, so a turn queued for a tile centre is
    // never skipped by one long step. Capped so a slow frame can't spiral.
    substeps(dt) { return Math.min(6, Math.max(1, Math.floor(this.speed * dt / 0.05) + 1)); }
  }

  class Ghost extends Entity {
    constructor(tx, ty, color) { super(tx, ty, GHOST_SPEED); this.color = color; this.frightened = 0; }
    update(dt, pac) {
      this.frightened = Math.max(0, this.frightened - dt);
      this.speed = this.frightened ? FRIGHT_SPEED : GHOST_SPEED;
      const n = this.substeps(dt);
      for (let i = 0; i < n; i++) {
        if (this.atCenter() || same(this.dir, STOP)) this.chooseDir(pac);
        this.advance(dt / n);
      }
    }
    chooseDir(pac) {
      const reverse = [-this.dir[0], -this.dir[1]];
      let options = DIRS.filter(d => !same(d, reverse) && this.canGo(d));
      if (!options.length) options = this.canGo(reverse) ? [reverse] : [STOP];
      if (options.length > 1 && Math.random() < 0.25) {
        this.dir = options[Math.floor(Math.random() * options.length)];
        return;
      }
      const [tx, ty] = this.tile();
      const dist = d => Math.hypot(tx + d[0] - pac.x, ty + d[1] - pac.y);
      let best = options[0];
      for (const d of options) {
        if (this.frightened ? dist(d) > dist(best) : dist(d) < dist(best)) best = d;
      }
      this.dir = best;
    }
  }

  // ---------------------------------------------------------------- game

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.score = 0;
      this.lives = 3;
      this.pellets = new Set();
      this.powers = new Set();
      const ghostStarts = [];
      let pacStart = [Math.floor(COLS / 2), ROWS - 4];
      MAZE.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === ".") this.pellets.add(key(x, y));
        else if (ch === "o") this.powers.add(key(x, y));
        else if (ch === "P") pacStart = [x, y];
        else if (ch === "G") ghostStarts.push([x, y]);
      }));
      this.pac = new Entity(pacStart[0], pacStart[1], PAC_SPEED);
      this.desired = STOP;
      this.ghosts = ghostStarts.map((g, i) => new Ghost(g[0], g[1], GHOST_COLORS[i % GHOST_COLORS.length]));
      this.ghostBonus = 200;
      this.state = "ready";   // ready | play | dead | over | win
      this.stateT = 1.5;
      this.mouth = 0;
      this.touchStart = null;
      this.resize();
      this.bind();
    }

    // ------------------------------------------------------------ layout

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.tile = Math.floor(Math.min(this.w / COLS, this.h * 0.88 / ROWS));
      this.ox = Math.floor((this.w - this.tile * COLS) / 2);
      this.oy = Math.floor(this.h * 0.1 + (this.h * 0.88 - this.tile * ROWS) / 2);
      this.base = Math.max(12, Math.floor(this.h / 20));
      this.exit = { x: this.w - this.base * 2, y: 0, w: this.base * 2, h: this.base * 2 };
      this.layoutDpad();
    }

    // On-screen arrows: beside the maze when there is room (a landscape
    // screen), otherwise translucent over the bottom-left corner.
    layoutDpad() {
      const btn = Math.max(40, Math.floor(this.tile * 2.3));
      const gap = Math.max(4, Math.floor(btn / 8));
      const mazeW = this.tile * COLS;
      let cx, cy;
      if (this.w - mazeW >= btn * 2 + gap * 3) {
        this.ox = gap;
        cx = mazeW + gap + Math.floor((this.w - mazeW - gap) / 2);
        cy = this.oy + Math.floor(this.tile * ROWS / 2) + Math.floor(btn / 2);
        this.dpadAlpha = 0.92;
      } else {
        cx = btn + gap;
        cy = this.h - btn - gap;
        this.dpadAlpha = 0.35;
      }
      const b = btn, g = gap, half = Math.floor(b / 2);
      this.dpad = [
        { d: UP,    x: cx - half, y: cy - b - g - half, s: b },
        { d: DOWN,  x: cx - half, y: cy + g + half,     s: b },
        { d: LEFT,  x: cx - b - g - half, y: cy - half, s: b },
        { d: RIGHT, x: cx + g + half,     y: cy - half, s: b },
      ];
    }

    // ------------------------------------------------------------- input

    bind() {
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("keydown", e => {
        if (e.key === "Escape") { this.exitGame(); return; }
        const map = { ArrowUp: UP, w: UP, W: UP, ArrowDown: DOWN, s: DOWN, S: DOWN,
                      ArrowLeft: LEFT, a: LEFT, A: LEFT, ArrowRight: RIGHT, d: RIGHT, D: RIGHT };
        if (map[e.key]) { this.setDesired(map[e.key]); e.preventDefault(); }
        else if (this.state === "over" || this.state === "win") this.exitGame();
      });
      this.canvas.addEventListener("pointerdown", e => { e.preventDefault(); this.press(e.clientX, e.clientY); });
      this.canvas.addEventListener("pointerup", e => { e.preventDefault(); this.release(e.clientX, e.clientY); });
      this.canvas.addEventListener("pointercancel", () => { this.touchStart = null; });
      this.canvas.focus();
    }

    exitGame() {
      // Opened by the arcade launcher in an iframe: ask it to close us.
      if (window.parent !== window) window.parent.postMessage({ rpiArcade: "exit" }, "*");
      else if (window.history.length > 1) window.history.back();
    }

    setDesired(d) {
      this.desired = d;
      if (this.state !== "play") return;
      const pac = this.pac;
      if (!same(pac.dir, STOP) && same(d, [-pac.dir[0], -pac.dir[1]])) pac.dir = d; // turn back anywhere
      else if (pac.atCenter() && pac.canGo(d)) pac.dir = d;
    }

    inRect(px, py, r) { return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h; }

    press(px, py) {
      if (this.inRect(px, py, this.exit)) { this.exitGame(); return; }
      if (this.state === "over" || this.state === "win") { this.exitGame(); return; }
      for (const b of this.dpad) {
        if (this.inRect(px, py, { x: b.x, y: b.y, w: b.s, h: b.s })) { this.setDesired(b.d); return; }
      }
      this.touchStart = [px, py];
    }

    release(px, py) {
      if (!this.touchStart) return;
      let dx = px - this.touchStart[0], dy = py - this.touchStart[1];
      this.touchStart = null;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {       // a tap: head that way from Pac-Man
        dx = px - (this.ox + this.pac.x * this.tile);
        dy = py - (this.oy + this.pac.y * this.tile);
      }
      if (Math.abs(dx) > Math.abs(dy)) this.setDesired(dx > 0 ? RIGHT : LEFT);
      else this.setDesired(dy > 0 ? DOWN : UP);
    }

    // ------------------------------------------------------------ update

    update(dt) {
      this.mouth += dt * 8;
      if (this.state === "ready") {
        if ((this.stateT -= dt) <= 0) this.state = "play";
        return;
      }
      if (this.state === "dead") {
        if ((this.stateT -= dt) <= 0) {
          if (this.lives <= 0) this.state = "over"; else this.respawn();
        }
        return;
      }
      if (this.state !== "play") return;

      const pac = this.pac;
      const n = pac.substeps(dt);
      for (let i = 0; i < n; i++) {
        if (pac.atCenter()) {
          if (!same(this.desired, STOP) && pac.canGo(this.desired)) { pac.dir = this.desired; pac.snap(); }
          else if (!pac.canGo(pac.dir)) { pac.snap(); pac.dir = STOP; }
        }
        pac.advance(dt / n);
      }

      const [tx, ty] = pac.tile();
      const k = key(tx, ty);
      if (this.pellets.delete(k)) this.score += 10;
      if (this.powers.delete(k)) {
        this.score += 50;
        this.ghostBonus = 200;
        for (const g of this.ghosts) g.frightened = FRIGHT_TIME;
      }
      if (!this.pellets.size && !this.powers.size) { this.state = "win"; return; }

      for (const g of this.ghosts) {
        g.update(dt, pac);
        if (Math.hypot(g.x - pac.x, g.y - pac.y) < 0.7) {
          if (g.frightened) {
            this.score += this.ghostBonus;
            this.ghostBonus = Math.min(this.ghostBonus * 2, 1600);
            g.reset();
            g.frightened = 0;
          } else {
            this.lives -= 1;
            this.state = "dead";
            this.stateT = 1.2;
          }
        }
      }
    }

    respawn() {
      this.pac.reset();
      this.desired = STOP;
      for (const g of this.ghosts) { g.reset(); g.frightened = 0; }
      this.state = "ready";
      this.stateT = 1.2;
    }

    // ----------------------------------------------------------- drawing

    px(x, y) { return [this.ox + x * this.tile, this.oy + y * this.tile]; }

    draw() {
      const c = this.ctx, ts = this.tile;
      c.fillStyle = "#000";
      c.fillRect(0, 0, this.w, this.h);

      c.fillStyle = WALL;
      MAZE.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== "#") return;
        const [rx, ry] = this.px(x, y);
        this.roundRect(rx + 1, ry + 1, ts - 2, ts - 2, 3);
        c.fill();
      }));

      c.fillStyle = PELLET;
      for (const k of this.pellets) {
        const [cx, cy] = this.px((k % COLS) + 0.5, Math.floor(k / COLS) + 0.5);
        this.dot(cx, cy, Math.max(2, ts / 10));
      }
      if (Math.floor(this.mouth * 2) % 2 === 0) {           // power pellets blink
        for (const k of this.powers) {
          const [cx, cy] = this.px((k % COLS) + 0.5, Math.floor(k / COLS) + 0.5);
          this.dot(cx, cy, Math.max(4, ts / 4));
        }
      }

      this.drawPacman();
      for (const g of this.ghosts) this.drawGhost(g);
      this.drawDpad();
      this.drawHud();
      this.drawMessage();
    }

    roundRect(x, y, w, h, r) {
      const c = this.ctx;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    dot(cx, cy, r) { const c = this.ctx; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); }

    drawPacman() {
      const c = this.ctx;
      const [cx, cy] = this.px(this.pac.x, this.pac.y);
      const r = this.tile * 0.45;
      const open = ((Math.sin(this.mouth) + 1) / 2 * 40 + 5) * Math.PI / 180;
      const d = same(this.pac.dir, STOP) ? RIGHT : this.pac.dir;
      const base = Math.atan2(d[1], d[0]);          // canvas y points down
      c.fillStyle = PACMAN;
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, r, base + open, base - open + Math.PI * 2);
      c.closePath();
      c.fill();
    }

    drawGhost(g) {
      const c = this.ctx;
      const [cx, cy] = this.px(g.x, g.y);
      const r = this.tile * 0.45;
      const flashing = g.frightened > 0 && g.frightened < 2 && Math.floor(this.mouth * 2) % 2 === 0;
      c.fillStyle = g.frightened ? (flashing ? "#dcdcff" : FRIGHTENED) : g.color;
      c.beginPath();
      c.arc(cx, cy - r / 4, r, Math.PI, 0);
      c.lineTo(cx + r, cy + r * 0.75);
      for (let i = 2; i >= 0; i--) {                      // feet
        const fx = cx - r + (2 * r * (i * 2 + 1)) / 6;
        c.arc(fx, cy + r * 0.75, r / 3, 0, Math.PI);
      }
      c.lineTo(cx - r, cy - r / 4);
      c.closePath();
      c.fill();
      const eye = Math.max(2, r / 3);                   // eyes look where it goes
      const ex = g.dir[0] * eye * 0.3, ey = g.dir[1] * eye * 0.3;
      for (const off of [-r / 2, r / 2]) {
        c.fillStyle = "#fff";
        this.dot(cx + off, cy - r / 3, eye);
        c.fillStyle = "#282878";
        this.dot(cx + off + ex, cy - r / 3 + ey, Math.max(1, eye / 2));
      }
    }

    drawDpad() {
      const c = this.ctx;
      c.save();
      c.globalAlpha = this.dpadAlpha;
      for (const b of this.dpad) {
        const lit = same(b.d, this.desired);
        c.fillStyle = lit ? "#00c8dc" : "#46466e";
        this.roundRect(b.x, b.y, b.s, b.s, 10);
        c.fill();
        c.strokeStyle = "#a0a0c8";
        c.lineWidth = 2;
        c.stroke();
        const m = b.x + b.s / 2, n = b.y + b.s / 2, t = b.s / 4;
        c.fillStyle = "#f0f0fa";
        c.beginPath();
        c.moveTo(m + b.d[0] * t, n + b.d[1] * t);
        c.lineTo(m - b.d[0] * t + b.d[1] * t, n - b.d[1] * t + b.d[0] * t);
        c.lineTo(m - b.d[0] * t - b.d[1] * t, n - b.d[1] * t - b.d[0] * t);
        c.closePath();
        c.fill();
      }
      c.restore();
      // the exit cross
      const e = this.exit;
      c.strokeStyle = "#969696";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(e.x + 8, e.y + 8); c.lineTo(e.x + e.w - 8, e.y + e.h - 8);
      c.moveTo(e.x + e.w - 8, e.y + 8); c.lineTo(e.x + 8, e.y + e.h - 8);
      c.stroke();
    }

    drawHud() {
      const c = this.ctx;
      c.fillStyle = TEXT;
      c.font = `bold ${this.base * 0.7}px sans-serif`;
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText(`SCORE ${this.score}`, this.ox, 6);
      const r = Math.max(4, this.tile / 3);
      c.fillStyle = PACMAN;
      for (let i = 0; i < this.lives; i++) this.dot(this.w / 2 + i * (r * 2 + 6), 6 + r, r);
    }

    drawMessage() {
      const c = this.ctx;
      let msg = null, col = TEXT;
      if (this.state === "ready") { msg = "READY!"; col = PACMAN; }
      else if (this.state === "over") { msg = "GAME OVER"; col = "#ff5050"; }
      else if (this.state === "win") { msg = "YOU WIN!"; col = "#50ff78"; }
      if (!msg) return;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `bold ${this.base * 1.6}px sans-serif`;
      c.fillStyle = col;
      c.fillText(msg, this.w / 2, this.h / 2);
      if (this.state === "over" || this.state === "win") {
        c.font = `${this.base * 0.7}px sans-serif`;
        c.fillStyle = TEXT;
        c.fillText("Tap or press a key to exit", this.w / 2, this.h / 2 + this.base * 1.6);
      }
    }

    // -------------------------------------------------------------- loop

    start() {
      let last = performance.now();
      const frame = now => {
        const dt = Math.min((now - last) / 1000, 0.15);  // no tunnelling after a long frame
        last = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  const game = new Game(document.getElementById("game"));
  window.pacman = game;   // for tests
  game.start();
})();
