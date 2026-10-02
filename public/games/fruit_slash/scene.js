/*
 * Fruit Slash — canvas scene (logical 960x540, drawn at device resolution).
 *
 * Before a wave the player swipes across the 8 lanes to set the cut (scene.onCut). The game sends
 * that cut to the server, which only then builds the wave from the fair hash and resolves it.
 * The scene throws exactly that wave (lanes 'F' / 'B' / '-') so every object peaks at the cut line,
 * and the blade runs along the committed line: what is in the cut is cut, nothing else is touched.
 *
 * API:
 *   scene.setSkin(id) · setMultiplier(text) · setShield(bool) · setDrawing(on, maxWidth) · setCut(c)
 *   await scene.playLanes({ lanes, dragon, cut, steps, saved, outcome, index })
 *   scene.banner(text, sub, tone) · scene.coins(x, y, n)
 */
(function () {
  const W = 960;
  const H = 540;
  const G = 980; // gravity, px/s²
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- blades (skins)
  const BLADES = {
    steel: { name: 'Steel Katana', core: '#ffffff', glow: '#9fd8ff', spark: '#e8f6ff' },
    ice: { name: 'Ice Trail', core: '#eafcff', glow: '#3fd8ff', spark: '#b8f4ff', crystals: true },
    fire: { name: 'Fire Dragon', core: '#fff3c4', glow: '#ff6a1a', spark: '#ffb02e', embers: true },
    neon: { name: 'Neon Beam', core: '#ffe9ff', glow: '#ff2bd6', spark: '#7a5cff' },
    sakura: { name: 'Sakura Storm', core: '#fff0f5', glow: '#ff8fb8', spark: '#ffd1e3', petals: true }
  };

  // ---------------------------------------------------------------- fruit look
  const FRUITS = {
    apple: { r: 30, skin: ['#ff5a5a', '#b3121f'], flesh: '#fff3c8', juice: '#ffe08a', leaf: true },
    orange: { r: 31, skin: ['#ffb347', '#e0630b'], flesh: '#ffc061', juice: '#ffa23a', dots: true },
    lime: { r: 26, skin: ['#9be15d', '#3c8d1d'], flesh: '#d9f99d', juice: '#c6f36b' },
    lemon: { r: 27, skin: ['#fff27a', '#e2b400'], flesh: '#fff7b8', juice: '#fff06a', oval: 1.25 },
    plum: { r: 27, skin: ['#b05cff', '#4b1477'], flesh: '#ffd27a', juice: '#c56bff' },
    peach: { r: 30, skin: ['#ffc2a0', '#f06d4f'], flesh: '#ffd9a0', juice: '#ffb27a' },
    kiwi: { r: 27, skin: ['#a9824e', '#5c4022'], flesh: '#8fd14f', juice: '#a6e05a', seeds: true },
    watermelon: { r: 46, skin: ['#4fbf4f', '#1e6b26'], flesh: '#ff4d6d', juice: '#ff4d6d', stripes: true, seeds: true },
    pineapple: { r: 36, skin: ['#ffd84a', '#c58a00'], flesh: '#fff0a0', juice: '#ffe066', oval: 1.3, crown: true, grid: true },
    dragon: { r: 34, skin: ['#ff4fa3', '#a30d5c'], flesh: '#ffffff', juice: '#ff7fbf', oval: 1.15, scales: true, seeds: true, golden: true },
    banana: { r: 30, skin: ['#7ad7ff', '#1d6fd6'], flesh: '#e8f7ff', juice: '#8fe3ff', banana: true }
  };
  const COMMON = ['apple', 'orange', 'lime', 'lemon', 'plum', 'peach', 'kiwi'];

  // ---------------------------------------------------------------- scene
  const LANES = 8;
  const LX0 = 90;
  const LW = (W - 2 * LX0) / LANES; // lane width
  const laneX = (i) => LX0 + LW * (i + 0.5);
  const laneAt = (x) => clamp(Math.floor((x - LX0) / LW), 0, LANES - 1);
  const LINE_MIN = 150;
  const LINE_MAX = 330;

  class Scene {
    constructor(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.blade = BLADES.steel;
      this.objs = [];
      this.halves = [];
      this.parts = [];
      this.splats = [];
      this.texts = [];
      this.petals = Array.from({ length: 26 }, () => this.newPetal(true));
      this.t = 0;
      this.flash = 0;
      this.soot = 0;
      this.shake = 0;
      this.mult = '';
      this.shieldOn = false;
      this.cut = null; // { from, to, y } — the committed line
      this.draft = null; // the line being drawn
      this.canDraw = false;
      this.sweep = null;
      this.wave = null;
      this.laneInfo = null; // { fruits, bombs, empties } of the coming wave, for the hint
      this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas);
      this.bindInput();
      this.last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.round(r.width * dpr));
      this.canvas.height = Math.max(1, Math.round(r.height * dpr));
      this.scale = this.canvas.width / W;
      this.bg = null;
    }

    setSkin(id) { this.blade = BLADES[id] || BLADES.steel; }
    setMultiplier(s) { this.mult = s || ''; }
    setShield(on) { this.shieldOn = !!on; }
    /** Allows drawing the cut; maxWidth = widest span the wave offers. */
    setDrawing(on, maxWidth = LANES) { this.canDraw = !!on; this.maxWidth = maxWidth; if (this.cut && this.cut.to - this.cut.from + 1 > maxWidth) this.setCut(null); }
    setCut(c) { this.cut = c; if (this.onCut) this.onCut(c); }
    clearWave() { this.objs = []; }

    // -------------------------------------------------------------- input: drawing the cut before the wave
    bindInput() {
      const c = this.canvas;
      const pos = (e) => {
        const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
      };
      let start = null;
      c.addEventListener('pointerdown', (e) => {
        if (!this.canDraw) return;
        if (window.SFX) window.SFX.unlock();
        start = pos(e);
        this.draft = { a: start, b: start };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', (e) => {
        if (!start) return;
        this.draft.b = pos(e);
      });
      const up = () => {
        if (!start || !this.draft) return;
        const { a, b } = this.draft;
        let from = laneAt(Math.min(a.x, b.x));
        let to = laneAt(Math.max(a.x, b.x));
        const max = this.maxWidth || LANES;
        if (to - from + 1 > max) { if (b.x >= a.x) to = from + max - 1; else from = to - max + 1; }
        const y = clamp((a.y + b.y) / 2, LINE_MIN, LINE_MAX);
        this.draft = null;
        start = null;
        if (window.SFX) window.SFX.swish(1);
        this.setCut({ from, to, y });
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', () => { this.draft = null; start = null; });
    }

    // -------------------------------------------------------------- the wave
    /**
     * Throws a resolved wave: lanes 'F' fruit / 'B' bomb / '-' empty, then the committed blade sweeps
     * along the cut. steps = multiplier after each fruit cut (count-up), saved = shield absorbs the bomb.
     */
    playLanes({ lanes, dragon, cut, steps = [], saved = false, outcome, index = 0 }) {
      this.objs = [];
      const y = cut.y;
      const apexT = 1.0; // every object peaks at the line at the same moment
      const w = { started: this.t, cut, steps, saved, outcome, done: false, cutCount: 0 };
      this.wave = w;
      const pick = (i) => (i === dragon ? 'dragon' : index === 4 && i % 3 === 0 ? 'watermelon' : index === 6 && i % 3 === 1 ? 'pineapple' : COMMON[(i * 7 + index * 3) % COMMON.length]);
      [...lanes].forEach((cell, i) => {
        if (cell === '-') return;
        const ax = laneX(i) + rnd(-10, 10);
        const ay = y + rnd(-6, 6);
        const delay = rnd(0, 0.12);
        const T = apexT - delay;
        const vx = rnd(-30, 30);
        const kind = cell === 'B' ? 'bomb' : 'fruit';
        const type = kind === 'fruit' ? pick(i) : null;
        this.objs.push({ kind, type, lane: i, x: ax - vx * T, y: ay + 0.5 * G * T * T, vx, vy: -G * T, r: type ? FRUITS[type].r : 30, rot: rnd(0, TAU), vr: rnd(-2, 2), delay, done: false });
      });
      // empty lanes inside the cut puff a little dust when the blade passes
      if (window.SFX) window.SFX.throw();
      setTimeout(() => this.startSweep(), (apexT - 0.1) * 1000);
      return new Promise((res) => { w.resolve = res; });
    }

    startSweep() {
      const w = this.wave;
      if (!w) return;
      const x1 = LX0 + LW * w.cut.from + 6;
      const x2 = LX0 + LW * (w.cut.to + 1) - 6;
      this.sweep = { x1, x2, y: w.cut.y, t: 0, dur: 0.18 + (w.cut.to - w.cut.from) * 0.05, hit: new Set() };
      if (window.SFX) window.SFX.swish(1.6);
    }

    /** The blade reaches lane i. */
    hitLane(i) {
      const w = this.wave;
      const objs = this.objs.filter((o) => o.lane === i && !o.done);
      if (!objs.length) { this.dust(laneX(i), w.cut.y, 6, 'rgba(255,240,220,0.7)'); return; }
      for (const o of objs) {
        if (o.kind === 'bomb') this.detonate(o, w.saved);
        else {
          this.slice(o, 1, 0);
          const m = w.steps[w.cutCount];
          w.cutCount += 1;
          if (m) this.pop(`x${m.toFixed(2)}`, o.x, o.y - 56, w.cutCount > 2 ? '#ffd23f' : '#ffffff', 26 + Math.min(4, w.cutCount) * 4);
          if (o.type === 'dragon') { this.coins(o.x, o.y, 26); this.pop('DRAGON FRUIT!', o.x, o.y - 100, '#ffd23f', 34); if (window.SFX) setTimeout(() => window.SFX.coin(), 80); }
        }
      }
    }

    slice(o, dx, dy) {
      if (o.done) return;
      o.done = true;
      const look = FRUITS[o.type];
      const ang = Math.atan2(dy, dx);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (const s of [-1, 1]) {
        this.halves.push({ type: o.type, x: o.x + nx * s * 4, y: o.y + ny * s * 4, vx: o.vx * 0.6 + nx * s * 90 + rnd(-30, 30), vy: ny * s * 120 - 80, rot: ang, vr: s * rnd(2, 5), side: s, r: o.r, life: 2.4 });
      }
      for (let i = 0; i < 16; i++) {
        const a = rnd(0, TAU);
        const sp = rnd(80, 360);
        this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 700, life: rnd(0.4, 0.8), c: look.juice, s: rnd(2.5, 5.5) });
      }
      this.splats.push({ x: o.x, y: o.y, r: o.r * rnd(1.1, 1.6), c: look.juice, life: 1, seed: Math.random() * 1000 });
      if (window.SFX) window.SFX.slice();
    }

    detonate(o, saved) {
      o.done = true;
      this.boomAt = { x: o.x, y: o.y, t: this.t };
      if (window.SFX) window.SFX.boom();
      if (saved) {
        this.shieldBurst = { x: o.x, y: o.y, t: this.t };
        this.flash = 0.6;
        this.shake = 0.35;
        if (window.SFX) setTimeout(() => window.SFX.shield(), 120);
        this.pop('SHIELD!', o.x, o.y - 80, '#7ad7ff', 46);
        return;
      }
      this.flash = 1;
      this.soot = 1;
      this.shake = 0.8;
      for (let i = 0; i < 60; i++) {
        const a = rnd(0, TAU);
        const sp = rnd(120, 700);
        this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 200, life: rnd(0.4, 1.2), c: i % 3 ? '#ffb02e' : '#ff4d1a', s: rnd(3, 7) });
      }
      for (let i = 0; i < 24; i++) this.parts.push({ x: o.x + rnd(-20, 20), y: o.y + rnd(-20, 20), vx: rnd(-80, 80), vy: rnd(-120, -20), g: -30, life: rnd(1.2, 2.2), c: 'rgba(30,26,24,0.75)', s: rnd(14, 30), smoke: true });
      for (const f of this.objs) if (!f.done) { const a = Math.atan2(f.y - o.y, f.x - o.x); f.vx += Math.cos(a) * 380; f.vy += Math.sin(a) * 300; }
      if (window.SFX) setTimeout(() => window.SFX.lose(), 500);
    }

    // -------------------------------------------------------------- effects
    pop(text, x, y, color, size = 40) { this.texts.push({ text, x: clamp(x, 120, W - 120), y: clamp(y, 120, H - 70), color, size, life: 1.3 }); }
    banner(text, sub, tone) { this.bannerT = { text, sub, tone, life: 1.8 }; }
    dust(x, y, n, c) { for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: rnd(-60, 60), vy: rnd(-60, 20), g: 60, life: rnd(0.3, 0.6), c, s: rnd(2, 4) }); }
    coins(x = W / 2, y = H / 2, n = 30) {
      for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: rnd(-320, 320), vy: rnd(-620, -260), g: 1100, life: rnd(1, 1.6), c: '#ffd23f', s: rnd(5, 8), coin: true, rot: rnd(0, TAU) });
    }
    newPetal(anywhere) { return { x: rnd(-40, W), y: anywhere ? rnd(0, H) : -20, vx: rnd(10, 40), vy: rnd(20, 50), rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), s: rnd(3, 6) }; }

    // -------------------------------------------------------------- update
    update(dt) {
      this.t += dt;
      const w = this.wave;
      if (this.sweep) {
        const sw = this.sweep;
        sw.t += dt;
        const k = Math.min(1, sw.t / sw.dur);
        const x = lerp(sw.x1, sw.x2, k);
        for (let i = this.wave.cut.from; i <= this.wave.cut.to; i++) if (!sw.hit.has(i) && x >= laneX(i) - LW * 0.25) { sw.hit.add(i); this.hitLane(i); }
        if (k >= 1 && sw.t > sw.dur + 0.25) this.sweep = null;
      }
      for (const o of this.objs) {
        if (o.done) continue;
        if (o.delay > 0) { o.delay -= dt; continue; }
        o.vy += G * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.rot += o.vr * dt;
        if (o.kind === 'bomb' && Math.random() < 0.6) this.parts.push({ x: o.x + Math.cos(o.rot - 1) * o.r * 0.9, y: o.y + Math.sin(o.rot - 1) * o.r * 0.9 - 4, vx: rnd(-40, 40), vy: rnd(-80, -20), g: 0, life: 0.25, c: Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a', s: 2.2 });
        if (o.y > H + 120 && o.vy > 0) o.done = true;
      }
      this.objs = this.objs.filter((o) => !o.done);
      for (const h of this.halves) { h.vy += G * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; h.life -= dt; }
      this.halves = this.halves.filter((h) => h.life > 0 && h.y < H + 120);
      for (const p of this.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.coin) p.rot += dt * 8; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const s of this.splats) s.life -= dt * 0.12;
      this.splats = this.splats.filter((s) => s.life > 0).slice(-40);
      for (const t of this.texts) { t.life -= dt; t.y -= dt * 30; }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const p of this.petals) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > H + 20 || p.x > W + 40) Object.assign(p, this.newPetal(false));
      }
      this.flash = Math.max(0, this.flash - dt * 2.4);
      this.soot = Math.max(0, this.soot - dt * 0.45);
      this.shake = Math.max(0, this.shake - dt);
      if (this.bannerT) { this.bannerT.life -= dt; if (this.bannerT.life <= 0) this.bannerT = null; }
      if (w && !w.done && !this.sweep && this.objs.length === 0 && this.t - w.started > 1.3) {
        w.done = true;
        setTimeout(() => { this.wave = null; w.resolve(); }, w.outcome === 'cut' ? 250 : 700);
      }
    }

    // -------------------------------------------------------------- render
    background() {
      if (this.bg) return this.bg;
      const c = document.createElement('canvas');
      c.width = this.canvas.width; c.height = this.canvas.height;
      const g = c.getContext('2d');
      g.scale(this.scale, this.scale);
      // dark wooden dojo wall
      const base = g.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, '#2b1a10'); base.addColorStop(0.6, '#3a2214'); base.addColorStop(1, '#170c06');
      g.fillStyle = base; g.fillRect(0, 0, W, H);
      for (let x = 0, i = 0; x < W; x += 64, i++) {
        g.fillStyle = i % 2 ? 'rgba(255,220,180,0.035)' : 'rgba(0,0,0,0.08)';
        g.fillRect(x, 0, 64, H);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, 2, H);
        g.strokeStyle = 'rgba(255,210,170,0.05)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { g.beginPath(); const yy = (i * 97 + k * 151) % H; g.ellipse(x + 32, yy, 14 + k * 3, 40 + k * 9, 0, 0, TAU); g.stroke(); }
      }
      // rising sun behind
      const sun = g.createRadialGradient(W / 2, H * 0.48, 30, W / 2, H * 0.48, 260);
      sun.addColorStop(0, 'rgba(255,90,70,0.32)'); sun.addColorStop(0.55, 'rgba(255,60,50,0.12)'); sun.addColorStop(1, 'rgba(255,60,50,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(200,40,40,0.16)'; g.beginPath(); g.arc(W / 2, H * 0.48, 150, 0, TAU); g.fill();
      // top beam + lantern cords
      g.fillStyle = '#1a0e07'; g.fillRect(0, 0, W, 26);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 24, W, 2);
      // vignette
      const v = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 620);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      this.bg = c;
      return c;
    }

    render() {
      const g = this.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.background(), 0, 0);
      const sx = this.shake > 0 ? rnd(-1, 1) * this.shake * 14 : 0;
      const sy = this.shake > 0 ? rnd(-1, 1) * this.shake * 14 : 0;
      g.setTransform(this.scale, 0, 0, this.scale, sx * this.scale, sy * this.scale);

      // lanterns
      for (const lx of [60, W - 60]) {
        const sway = Math.sin(this.t * 1.3 + lx) * 4;
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 26); g.lineTo(lx + sway, 50); g.stroke();
        const glow = g.createRadialGradient(lx + sway, 84, 10, lx + sway, 84, 100);
        glow.addColorStop(0, 'rgba(255,140,80,0.32)'); glow.addColorStop(1, 'rgba(255,140,80,0)');
        g.fillStyle = glow; g.fillRect(lx - 110, -20, 220, 220);
        g.fillStyle = '#ff5a3c'; roundRect(g, lx + sway - 22, 50, 44, 60, 20); g.fill();
        g.fillStyle = 'rgba(255,230,180,0.35)'; roundRect(g, lx + sway - 15, 56, 30, 48, 14); g.fill();
        g.fillStyle = '#1a0e07'; g.fillRect(lx + sway - 12, 46, 24, 6); g.fillRect(lx + sway - 12, 108, 24, 6);
      }

      // lanes: faint columns, brighter where the cut is
      const drawing = this.canDraw || this.draft;
      for (let i = 0; i < LANES; i++) {
        const inCut = this.cut && i >= this.cut.from && i <= this.cut.to;
        g.fillStyle = inCut ? 'rgba(255,207,74,0.10)' : drawing ? 'rgba(255,240,220,0.04)' : 'rgba(255,240,220,0.02)';
        g.fillRect(LX0 + LW * i + 2, 30, LW - 4, H - 30);
        if (i) { g.fillStyle = 'rgba(255,240,220,0.07)'; g.fillRect(LX0 + LW * i - 1, 30, 2, H - 30); }
        g.fillStyle = inCut ? 'rgba(255,207,74,0.95)' : 'rgba(255,240,220,0.35)';
        g.font = '16px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(i + 1), laneX(i), H - 18);
      }

      // juice splats
      for (const s of this.splats) {
        g.globalAlpha = Math.min(0.32, s.life * 0.4);
        g.fillStyle = s.c;
        g.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU;
          const rr = s.r * (0.65 + 0.45 * Math.abs(Math.sin(s.seed + i * 2.3)));
          i ? g.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr) : g.moveTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
        }
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;

      // petals
      g.fillStyle = 'rgba(255,170,200,0.55)';
      for (const p of this.petals) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); g.fill(); g.restore(); }

      // the committed cut (dashed until the blade runs along it)
      if (this.cut && !this.sweep) {
        const x1 = LX0 + LW * this.cut.from + 8;
        const x2 = LX0 + LW * (this.cut.to + 1) - 8;
        const y = this.cut.y;
        g.save();
        g.setLineDash([14, 10]); g.lineDashOffset = -this.t * 40;
        g.shadowColor = this.blade.glow; g.shadowBlur = 14;
        g.strokeStyle = this.blade.glow; g.globalAlpha = 0.85; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
        g.setLineDash([]);
        g.fillStyle = this.blade.core;
        for (const x of [x1, x2]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
        g.restore();
      }
      if (this.draft) {
        const { a, b } = this.draft;
        g.save(); g.globalAlpha = 0.6; g.strokeStyle = this.blade.core; g.lineWidth = 3; g.setLineDash([6, 8]);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.restore();
      }

      // objects
      for (const o of this.objs) {
        if (o.done || o.delay > 0) continue;
        if (o.kind === 'bomb') drawBomb(g, o, this.t);
        else drawFruit(g, o.type, o.x, o.y, o.rot, o.r, 0, this.t);
      }
      for (const h of this.halves) {
        g.globalAlpha = clamp(h.life, 0, 1);
        drawFruit(g, h.type, h.x, h.y, h.rot, h.r, h.side, this.t);
      }
      g.globalAlpha = 1;

      // particles
      for (const p of this.parts) {
        g.globalAlpha = clamp(p.life * 1.6, 0, 1);
        if (p.coin) {
          g.fillStyle = '#c88a00'; g.beginPath(); g.ellipse(p.x, p.y, p.s * Math.abs(Math.cos(p.rot)) + 1, p.s, 0, 0, TAU); g.fill();
          g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(p.x, p.y, (p.s - 1.5) * Math.abs(Math.cos(p.rot)) + 0.5, p.s - 1.5, 0, 0, TAU); g.fill();
        } else {
          g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;

      // explosion / shield
      if (this.boomAt && this.t - this.boomAt.t < 0.8) {
        const k = (this.t - this.boomAt.t) / 0.8;
        g.strokeStyle = `rgba(255,220,150,${1 - k})`; g.lineWidth = 10 * (1 - k);
        g.beginPath(); g.arc(this.boomAt.x, this.boomAt.y, 40 + k * 420, 0, TAU); g.stroke();
      }
      if (this.shieldBurst && this.t - this.shieldBurst.t < 1.1) {
        const k = (this.t - this.shieldBurst.t) / 1.1;
        const R = 70 + k * 40;
        g.save(); g.translate(this.shieldBurst.x, this.shieldBurst.y);
        g.strokeStyle = `rgba(122,215,255,${1 - k})`; g.lineWidth = 4; g.fillStyle = `rgba(122,215,255,${0.18 * (1 - k)})`;
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; i ? g.lineTo(Math.cos(a) * R, Math.sin(a) * R) : g.moveTo(Math.cos(a) * R, Math.sin(a) * R); } g.closePath(); g.fill(); g.stroke();
        g.restore();
      }

      // the blade running along the committed cut
      if (this.sweep) {
        const sw = this.sweep;
        const k = Math.min(1, sw.t / sw.dur);
        const fade = sw.t > sw.dur ? 1 - (sw.t - sw.dur) / 0.25 : 1;
        const x = lerp(sw.x1, sw.x2, k);
        const pts = Array.from({ length: 10 }, (_, i) => ({ x: lerp(sw.x1, x, i / 9), y: sw.y + Math.sin(i / 9 * Math.PI) * -6 }));
        this.drawSlash(g, pts, Math.max(0, fade));
      }

      if (this.soot > 0) { g.fillStyle = `rgba(12,8,6,${this.soot * 0.7})`; g.fillRect(-20, -20, W + 40, H + 40); }
      if (this.flash > 0) { g.fillStyle = `rgba(255,250,235,${this.flash * 0.85})`; g.fillRect(-20, -20, W + 40, H + 40); }

      for (const t of this.texts) {
        const k = clamp(t.life / 1.3, 0, 1);
        const sc = 1 + (k > 0.9 ? (k - 0.9) * 3 : 0);
        g.save(); g.translate(t.x, t.y); g.scale(sc, sc); g.globalAlpha = clamp(k * 2, 0, 1);
        textOut(g, t.text, 0, 0, t.size, t.color);
        g.restore();
      }
      g.globalAlpha = 1;

      if (this.mult) textOut(g, this.mult, W / 2, 60, 44, '#ffd23f');
      if (this.shieldOn) {
        g.save(); g.translate(W - 120, 60);
        g.strokeStyle = '#7ad7ff'; g.lineWidth = 3; g.fillStyle = 'rgba(122,215,255,0.18)';
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; i ? g.lineTo(Math.cos(a) * 20, Math.sin(a) * 20) : g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); } g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      if (this.canDraw && !this.cut && !this.draft) textOut(g, 'SWIPE ACROSS THE LANES TO SET YOUR CUT', W / 2, H * 0.72, 22, 'rgba(255,240,220,0.8)');
      if (this.bannerT) {
        const b = this.bannerT;
        const k = clamp(b.life / 1.8, 0, 1);
        const sc = k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
        g.save(); g.translate(W / 2, H * 0.42); g.scale(sc, sc); g.globalAlpha = clamp(k * 3, 0, 1);
        textOut(g, b.text, 0, 0, 58, b.tone === 'bad' ? '#ff4d4d' : b.tone === 'blue' ? '#7ad7ff' : '#ffd23f');
        if (b.sub) textOut(g, b.sub, 0, 52, 22, '#fff4e6');
        g.restore();
      }
      g.globalAlpha = 1;
    }

    drawSlash(g, pts, alpha) {
      const b = this.blade;
      g.save();
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.shadowColor = b.glow; g.shadowBlur = 22;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < pts.length; i++) {
          const k = i / (pts.length - 1);
          g.strokeStyle = pass ? b.core : b.glow;
          g.globalAlpha = alpha * (pass ? 1 : 0.7);
          g.lineWidth = (pass ? 4 : 11) * (0.25 + k * 0.85);
          g.beginPath(); g.moveTo(pts[i - 1].x, pts[i - 1].y); g.lineTo(pts[i].x, pts[i].y); g.stroke();
        }
      }
      g.restore();
      const tip = pts.at(-1);
      if (tip && Math.random() < 0.7 && alpha > 0.5) {
        const p = { x: tip.x, y: tip.y, vx: rnd(-60, 60), vy: rnd(-60, 60), g: b.embers ? -120 : 200, life: rnd(0.2, 0.45), c: b.spark, s: b.crystals ? 3 : 2 };
        if (b.petals) { p.c = '#ffb3cf'; p.s = 4; p.g = 60; }
        this.parts.push(p);
      }
    }
  }

  // ---------------------------------------------------------------- drawing helpers
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function textOut(g, s, x, y, size, color) {
    g.font = `${size}px Bungee, "Roboto Condensed", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.18; g.strokeStyle = 'rgba(20,8,2,0.9)'; g.strokeText(s, x, y);
    g.fillStyle = color; g.fillText(s, x, y);
  }

  function drawBomb(g, o, t) {
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot);
    const pulse = 0.5 + 0.5 * Math.sin(t * 14);
    const glow = g.createRadialGradient(0, 0, o.r * 0.6, 0, 0, o.r * 1.8);
    glow.addColorStop(0, `rgba(255,40,40,${0.25 + pulse * 0.2})`); glow.addColorStop(1, 'rgba(255,40,40,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, o.r * 1.8, 0, TAU); g.fill();
    const body = g.createRadialGradient(-o.r * 0.35, -o.r * 0.35, 2, 0, 0, o.r);
    body.addColorStop(0, '#5a5a66'); body.addColorStop(0.5, '#22222a'); body.addColorStop(1, '#08080c');
    g.fillStyle = body; g.beginPath(); g.arc(0, 0, o.r, 0, TAU); g.fill();
    g.fillStyle = '#3a3a44'; g.fillRect(-7, -o.r - 6, 14, 9);
    g.strokeStyle = '#c8a070'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -o.r - 6); g.quadraticCurveTo(10, -o.r - 18, 4, -o.r - 26); g.stroke();
    g.fillStyle = '#ff3b3b'; g.font = `${o.r * 0.9}px Bungee, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalAlpha = 0.55 + pulse * 0.45; g.fillText('✕', 0, 2); g.globalAlpha = 1;
    g.restore();
  }

  function drawFruit(g, type, x, y, rot, r, side, t) {
    const f = FRUITS[type];
    g.save(); g.translate(x, y); g.rotate(rot);
    const sy = 1 / (f.oval || 1);
    if (f.golden && !side) {
      const halo = g.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2);
      halo.addColorStop(0, `rgba(255,210,63,${0.35 + 0.15 * Math.sin(t * 6)})`); halo.addColorStop(1, 'rgba(255,210,63,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 2, 0, TAU); g.fill();
    }
    if (f.banana && !side) {
      const halo = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2);
      halo.addColorStop(0, 'rgba(122,215,255,0.45)'); halo.addColorStop(1, 'rgba(122,215,255,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 2, 0, TAU); g.fill();
    }
    if (side) { g.beginPath(); g.rect(-r * 2, side < 0 ? -r * 2 : 0, r * 4, r * 2); g.clip(); }
    g.scale(f.oval || 1, 1);
    if (f.banana) {
      g.lineCap = 'round';
      g.strokeStyle = f.skin[1]; g.lineWidth = r * 0.75; g.beginPath(); g.arc(0, -r * 0.6, r * 1.1, 0.35, Math.PI - 0.35); g.stroke();
      g.strokeStyle = f.skin[0]; g.lineWidth = r * 0.5; g.beginPath(); g.arc(0, -r * 0.6, r * 1.1, 0.4, Math.PI - 0.4); g.stroke();
      g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(Math.cos(0.35) * r * 1.1, -r * 0.6 + Math.sin(0.35) * r * 1.1, 4, 0, TAU); g.fill();
    } else {
      const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      grad.addColorStop(0, f.skin[0]); grad.addColorStop(1, f.skin[1]);
      g.fillStyle = grad; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, r - 1, 0, TAU); g.clip();
      if (f.stripes) { g.fillStyle = 'rgba(10,60,20,0.7)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * r * 0.36, 0, r * 0.09, r, 0, 0, TAU); g.fill(); } }
      if (f.grid) { g.strokeStyle = 'rgba(140,80,0,0.55)'; g.lineWidth = 1.6; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * r * 0.3 - r, -r); g.lineTo(i * r * 0.3 + r, r); g.stroke(); g.beginPath(); g.moveTo(i * r * 0.3 + r, -r); g.lineTo(i * r * 0.3 - r, r); g.stroke(); } }
      g.restore();
      if (f.scales) { g.fillStyle = '#7dff8a'; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.lineTo(Math.cos(a + 0.25) * r * 1.18, Math.sin(a + 0.25) * r * 1.18); g.lineTo(Math.cos(a + 0.45) * r * 0.85, Math.sin(a + 0.45) * r * 0.85); g.fill(); } }
      if (f.dots) { g.fillStyle = 'rgba(160,60,0,0.25)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(Math.cos(i * 2.4) * r * 0.6, Math.sin(i * 2.4) * r * 0.6, 1.3, 0, TAU); g.fill(); } }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.13, -0.6, 0, TAU); g.fill();
      if (side) {
        // cut face
        g.fillStyle = f.flesh; g.beginPath(); g.ellipse(0, 0, r * 0.9, r * 0.22, 0, 0, TAU); g.fill();
        g.fillStyle = f.juice; g.globalAlpha = 0.6; g.beginPath(); g.ellipse(0, 0, r * 0.6, r * 0.12, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
        if (f.seeds) { g.fillStyle = '#1a1a1a'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(i * r * 0.22, 0, 2, 1.2, 0, 0, TAU); g.fill(); } }
      }
    }
    g.restore();
    if (!side && !f.banana) {
      g.save(); g.translate(x, y); g.rotate(rot);
      if (f.leaf) { g.fillStyle = '#5a3a1a'; g.fillRect(-1.5, -r - 8, 3, 10); g.fillStyle = '#3ddc84'; g.beginPath(); g.ellipse(7, -r - 4, 8, 4, -0.5, 0, TAU); g.fill(); }
      if (f.crown) { g.fillStyle = '#2e9e4a'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 6 - 4, -r * sy * 0.95); g.lineTo(i * 9, -r * sy - 26 + Math.abs(i) * 6); g.lineTo(i * 6 + 4, -r * sy * 0.95); g.fill(); } }
      g.restore();
    }
    void sy;
  }

  /** Preview of a blade for the skins sheet. */
  function drawBladePreview(canvas, id) {
    const b = BLADES[id];
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#1a0e07'; g.fillRect(0, 0, canvas.width, canvas.height);
    const pts = Array.from({ length: 16 }, (_, i) => ({ x: 10 + i * (canvas.width - 20) / 15, y: canvas.height * 0.75 - Math.sin(i / 15 * Math.PI) * canvas.height * 0.45 }));
    g.lineCap = 'round'; g.shadowColor = b.glow; g.shadowBlur = 16;
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < pts.length; i++) {
      const k = i / (pts.length - 1);
      g.strokeStyle = pass ? b.core : b.glow; g.lineWidth = (pass ? 4 : 10) * (0.3 + k);
      g.beginPath(); g.moveTo(pts[i - 1].x, pts[i - 1].y); g.lineTo(pts[i].x, pts[i].y); g.stroke();
    }
    g.shadowBlur = 0;
    drawFruitStatic(g, 'watermelon', canvas.width * 0.5, canvas.height * 0.5, 18);
  }
  function drawFruitStatic(g, type, x, y, r) { drawFruit(g, type, x, y, 0.3, r, 0, 0); }

  window.FruitScene = { Scene, BLADES, FRUITS, LANES, drawBladePreview, drawFruitStatic };
})();
