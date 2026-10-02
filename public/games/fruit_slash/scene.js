/*
 * Fruit Slash — canvas scene (logical 960x540, drawn at device resolution).
 *
 * Purely visual. The game tells the scene what the server decided for a wave
 * (outcome, shield save) and the scene throws fruit and bombs so that whatever the player
 * swipes ends on that result: fruit snaps to the blade, harmless bombs slip away from it,
 * and anything the result needs that the player did not do is finished by an automatic slash.
 *
 * API:
 *   scene.setSkin(id) · setMultiplier(text) · setShield(bool) · setIdle(bool)
 *   await scene.playWave({ wave, index, outcome, saved, boost }) → resolves when the wave is over
 *   scene.banner(text, sub, tone) · scene.coins(n)
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
      this.trail = [];
      this.autoSlashes = [];
      this.petals = Array.from({ length: 26 }, () => this.newPetal(true));
      this.t = 0;
      this.timeScale = 1;
      this.slowUntil = 0;
      this.flash = 0;
      this.soot = 0;
      this.shake = 0;
      this.mult = '';
      this.shieldOn = false;
      this.idle = true;
      this.nextDemo = 1.2;
      this.wave = null;
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
    setIdle(on) { this.idle = !!on; }

    // -------------------------------------------------------------- input: the blade
    bindInput() {
      const c = this.canvas;
      const pos = (e) => {
        const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H, t: performance.now() };
      };
      let down = false;
      let lastSwish = 0;
      c.addEventListener('pointerdown', (e) => {
        if (window.SFX) window.SFX.unlock();
        down = true;
        this.stroke = (this.stroke || 0) + 1;
        this.trail = [pos(e)];
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', (e) => {
        if (!down) return;
        const p = pos(e);
        const prev = this.trail.at(-1);
        this.trail.push(p);
        if (prev) {
          const speed = Math.hypot(p.x - prev.x, p.y - prev.y) / Math.max(1, p.t - prev.t) * 1000;
          if (speed > 900 && p.t - lastSwish > 160 && window.SFX) { window.SFX.swish(speed / 1800); lastSwish = p.t; }
          if (speed > 280) this.cutAlong(prev, p, false);
        }
      });
      const up = () => { down = false; };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
    }

    /** A blade segment passes over the field: cut / deflect / detonate what it touches. */
    cutAlong(a, b, auto) {
      const w = this.wave;
      for (const o of this.objs) {
        if (o.done) continue;
        const d = segDist(o.x, o.y, a.x, a.y, b.x, b.y);
        const reach = o.r * (o.kind === 'bomb' ? 0.9 : 1.25); // fruit hitboxes are wider than they look
        if (d > reach) continue;
        if (o.kind === 'bomb') {
          if (o.role === 'killer' && !auto) this.detonate(o);
          else if (o.role === 'deflect') this.deflect(o, b.x - a.x, b.y - a.y);
          continue; // harmless bombs slide past the blade (see update: they are pushed away)
        }
        if (o.escape) continue;
        if (w && w.lethalDone) continue;
        if (o.combo && w && !w.comboDone) {
          w.comboDone = true;
          const set = this.objs.filter((x) => x.combo && !x.done);
          set.forEach((x) => this.slice(x, b.x - a.x, b.y - a.y));
          const cx = set.reduce((s, x) => s + x.x, 0) / set.length;
          const cy = set.reduce((s, x) => s + x.y, 0) / set.length;
          this.autoSlashes.push({ x1: Math.min(...set.map((x) => x.x)) - 50, y1: cy, x2: Math.max(...set.map((x) => x.x)) + 50, y2: cy, life: 0.35 });
          this.pop(`MEGA COMBO ×${set.length}`, cx, cy - 60, '#ffd23f', 44);
          if (window.SFX) window.SFX.combo(set.length);
          continue;
        }
        this.slice(o, b.x - a.x, b.y - a.y);
      }
    }

    // -------------------------------------------------------------- wave
    /**
     * Throws one wave planned for the server outcome and resolves when it is over.
     * outcome: dragon_fruit | mega_combo | bomb_deflect | frenzy | clean | miss | lethal
     */
    playWave({ wave, index, outcome, saved = false, boost = 1.5 }) {
      this.idle = false;
      this.objs = this.objs.filter((o) => o.demo && !o.done);
      const lethal = outcome === 'lethal';
      let fruits = wave.fruits;
      let bombs = wave.bombs;
      if (outcome === 'mega_combo') fruits = Math.max(fruits, 4);
      if (lethal || outcome === 'bomb_deflect') bombs = Math.max(1, bombs);
      const w = { outcome, saved, lethal, boost, comboDone: false, lethalDone: false, started: this.t, done: false };
      this.wave = w;
      const plan = [];
      const pick = () => COMMON[Math.floor(Math.random() * COMMON.length)];
      const special = index === 4 ? 'watermelon' : index === 6 ? 'pineapple' : index === 9 ? 'dragon' : null;

      if (outcome === 'mega_combo') {
        // four fruits peak on one line at the same moment: one swipe takes them all
        const y = rnd(170, 220);
        const xs = [300, 410, 520, 630].map((x) => x + rnd(-14, 14));
        xs.forEach((x, i) => plan.push({ kind: 'fruit', type: pick(), ax: x, ay: y + rnd(-8, 8), at: 0.25, combo: true, auto: 0.22 + i * 0 }));
        fruits -= 4;
      }
      for (let i = 0; i < fruits; i++) {
        const type = i === 0 && special && special !== 'dragon' ? special : pick();
        plan.push({ kind: 'fruit', type, ax: rnd(170, 790), ay: rnd(120, 250), at: rnd(0, 0.7) });
      }
      if (outcome === 'miss' && plan.length) {
        // one fruit escapes: thrown fast and low, it cannot be cut
        const f = plan.find((p) => !p.combo) || plan[0];
        f.escape = true; f.ay = rnd(250, 300);
      }
      if (outcome === 'dragon_fruit' || special === 'dragon') plan.push({ kind: 'fruit', type: 'dragon', ax: rnd(380, 580), ay: rnd(110, 150), at: 0.45, special: outcome === 'dragon_fruit' });
      if (outcome === 'frenzy') plan.push({ kind: 'fruit', type: 'banana', ax: rnd(380, 580), ay: rnd(120, 160), at: 0.3, banana: true });
      for (let i = 0; i < bombs; i++) {
        let role = 'dud';
        if (i === 0 && lethal) role = 'killer';
        if (i === 0 && outcome === 'bomb_deflect') role = 'deflect';
        const centre = role !== 'dud';
        plan.push({ kind: 'bomb', role, ax: centre ? rnd(420, 540) : rnd(160, 800), ay: centre ? rnd(170, 210) : rnd(140, 260), at: centre ? rnd(0.35, 0.55) : rnd(0.1, 0.8) });
      }
      if (lethal && plan.filter((p) => p.kind === 'fruit').length) {
        // the killer flies through the thick of the fruit
        const k = plan.find((p) => p.role === 'killer');
        const fr = plan.filter((p) => p.kind === 'fruit');
        k.ax = fr.reduce((s, p) => s + p.ax, 0) / fr.length;
      }
      for (const p of plan) this.launch(p);
      if (window.SFX) { window.SFX.throw(); if (bombs) setTimeout(() => window.SFX.fuse(), 300); }
      return new Promise((res) => { w.resolve = res; });
    }

    launch(p) {
      const y0 = H + 60;
      const T = Math.sqrt((2 * (y0 - p.ay)) / G);
      const vx = p.escape ? (Math.random() < 0.5 ? -1 : 1) * rnd(260, 320) : rnd(-110, 110);
      const look = p.kind === 'fruit' ? FRUITS[p.type] : null;
      this.objs.push({
        ...p,
        x: p.ax - vx * T,
        y: y0,
        vx,
        vy: -G * T,
        r: look ? look.r : 30,
        rot: rnd(0, TAU),
        vr: rnd(-2.4, 2.4),
        delay: p.at,
        due: p.at + T + (p.auto != null ? p.auto : 0.18),
        age: 0,
        done: false
      });
    }

    slice(o, dx, dy) {
      if (o.done) return;
      o.done = true;
      const look = FRUITS[o.type];
      const ang = Math.atan2(dy, dx) || rnd(0, TAU);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (const s of [-1, 1]) {
        this.halves.push({ type: o.type, x: o.x + nx * s * 4, y: o.y + ny * s * 4, vx: o.vx * 0.6 + nx * s * 110, vy: Math.min(o.vy, 0) * 0.4 + ny * s * 110 - 60, rot: ang, vr: s * rnd(2, 5), side: s, r: o.r, life: 2.4 });
      }
      for (let i = 0; i < 16; i++) {
        const a = rnd(0, TAU);
        const sp = rnd(80, 360);
        this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 700, life: rnd(0.4, 0.8), c: look.juice, s: rnd(2.5, 5.5) });
      }
      this.splats.push({ x: o.x, y: o.y, r: o.r * rnd(1.1, 1.6), c: look.juice, life: 1, seed: Math.random() * 1000 });
      if (window.SFX) window.SFX.slice();
      if (o.type === 'dragon' && o.special) {
        this.coins(o.x, o.y, 26);
        if (window.SFX) setTimeout(() => window.SFX.coin(), 80);
        this.pop('DRAGON FRUIT!', o.x, o.y - 70, '#ffd23f', 40);
      }
      if (o.banana) this.startFrenzy(o);
    }

    startFrenzy(o) {
      const w = this.wave;
      this.slowUntil = this.t + 1.6;
      if (window.SFX) window.SFX.frenzy();
      this.pop(`FRENZY ×${(w && w.boost) || 1.5}`, o.x, o.y - 70, '#7ad7ff', 46);
      for (const b of this.objs) if (b.kind === 'bomb' && !b.done) { b.done = true; this.poof(b.x, b.y); }
      for (let i = 0; i < 26; i++) {
        const a = rnd(0, TAU);
        this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * rnd(60, 260), vy: Math.sin(a) * rnd(60, 260) - 120, g: 300, life: rnd(0.8, 1.4), c: ['#5a8dff', '#ff4d6d', '#b05cff'][i % 3], s: rnd(5, 8), berry: true });
      }
    }

    deflect(o, dx, dy) {
      if (o.done) return;
      o.done = true;
      o.deflected = true;
      const len = Math.hypot(dx, dy) || 1;
      this.halves.push({ bomb: true, x: o.x, y: o.y, vx: (dx / len) * 520 + 120, vy: (dy / len) * 520 - 260, rot: o.rot, vr: 9, r: o.r, life: 2 });
      for (let i = 0; i < 18; i++) {
        const a = rnd(0, TAU);
        this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * rnd(120, 420), vy: Math.sin(a) * rnd(120, 420), g: 400, life: rnd(0.2, 0.5), c: i % 2 ? '#ffffff' : '#ffd23f', s: 2.5 });
      }
      this.pop('DEFLECT!', o.x, o.y - 60, '#e8f6ff', 40);
      this.shake = 0.25;
      if (window.SFX) window.SFX.clang();
    }

    detonate(o) {
      const w = this.wave;
      if (!w || w.lethalDone) return;
      w.lethalDone = true;
      o.done = true;
      this.boomAt = { x: o.x, y: o.y, t: this.t };
      if (window.SFX) window.SFX.boom();
      if (w.saved) {
        this.shieldBurst = { x: o.x, y: o.y, t: this.t };
        this.flash = 0.6;
        this.shake = 0.35;
        if (window.SFX) setTimeout(() => window.SFX.shield(), 120);
        this.pop('SHIELD!', o.x, o.y - 80, '#7ad7ff', 48);
      } else {
        this.flash = 1;
        this.soot = 1;
        this.shake = 0.8;
        for (let i = 0; i < 60; i++) {
          const a = rnd(0, TAU);
          const sp = rnd(120, 700);
          this.parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 200, life: rnd(0.4, 1.2), c: i % 3 ? '#ffb02e' : '#ff4d1a', s: rnd(3, 7) });
        }
        for (let i = 0; i < 24; i++) this.parts.push({ x: o.x + rnd(-20, 20), y: o.y + rnd(-20, 20), vx: rnd(-80, 80), vy: rnd(-120, -20), g: -30, life: rnd(1.2, 2.2), c: 'rgba(30,26,24,0.75)', s: rnd(14, 30), smoke: true });
        // the blast throws the rest of the wave outwards
        for (const f of this.objs) if (!f.done && f !== o) { const a = Math.atan2(f.y - o.y, f.x - o.x); f.vx += Math.cos(a) * 420; f.vy += Math.sin(a) * 420; f.escape = true; }
        if (window.SFX) setTimeout(() => window.SFX.lose(), 500);
      }
    }

    // -------------------------------------------------------------- effects
    pop(text, x, y, color, size = 40) { this.texts.push({ text, x: clamp(x, 160, W - 160), y: clamp(y, 140, H - 70), color, size, life: 1.3 }); }
    banner(text, sub, tone) { this.bannerT = { text, sub, tone, life: 1.6 }; }
    poof(x, y) { for (let i = 0; i < 14; i++) { const a = rnd(0, TAU); this.parts.push({ x, y, vx: Math.cos(a) * rnd(40, 160), vy: Math.sin(a) * rnd(40, 160), g: -20, life: rnd(0.4, 0.8), c: 'rgba(230,240,255,0.8)', s: rnd(6, 12), smoke: true }); } }
    coins(x = W / 2, y = H / 2, n = 30) {
      for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: rnd(-320, 320), vy: rnd(-620, -260), g: 1100, life: rnd(1, 1.6), c: '#ffd23f', s: rnd(5, 8), coin: true, rot: rnd(0, TAU) });
    }
    newPetal(anywhere) { return { x: rnd(-40, W), y: anywhere ? rnd(0, H) : -20, vx: rnd(10, 40), vy: rnd(20, 50), rot: rnd(0, TAU), vr: rnd(-1.5, 1.5), s: rnd(3, 6) }; }

    // -------------------------------------------------------------- update
    update(dtReal) {
      const slow = this.t < this.slowUntil;
      this.timeScale = lerp(this.timeScale, slow ? 0.28 : 1, 0.12);
      const dt = dtReal * this.timeScale;
      this.t += dt;
      const w = this.wave;
      // trail fades by real time
      const now = performance.now();
      this.trail = this.trail.filter((p) => now - p.t < 140);

      // idle demo fruit to slice for fun (no money involved)
      if (this.idle) {
        this.nextDemo -= dtReal;
        if (this.nextDemo <= 0 && this.objs.length < 3) {
          this.nextDemo = rnd(1.6, 2.6);
          this.launch({ kind: 'fruit', type: COMMON[Math.floor(Math.random() * COMMON.length)], ax: rnd(220, 740), ay: rnd(140, 260), at: 0, demo: true, auto: 99 });
        }
      }

      for (const o of this.objs) {
        if (o.done) continue;
        if (o.delay > 0) { o.delay -= dt; continue; }
        o.age += dt;
        o.vy += G * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.rot += o.vr * dt;
        // harmless bombs and the escaping fruit slide away from the blade
        if ((o.kind === 'bomb' && o.role === 'dud') || o.escape) {
          for (const p of this.trail) {
            const d = Math.hypot(o.x - p.x, o.y - p.y);
            if (d < 90) { const a = Math.atan2(o.y - p.y, o.x - p.x); o.vx += Math.cos(a) * 900 * dt; o.vy += Math.sin(a) * 900 * dt; }
          }
        }
        if (o.kind === 'bomb' && Math.random() < 0.6) this.parts.push({ x: o.x + Math.cos(o.rot - 1) * o.r * 0.9, y: o.y + Math.sin(o.rot - 1) * o.r * 0.9 - 4, vx: rnd(-40, 40), vy: rnd(-80, -20), g: 0, life: 0.25, c: Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a', s: 2.2 });
        // the result must happen: finish what the outcome needs once the object starts to fall
        if (w && !o.demo && o.age + o.at >= o.due && o.delay <= 0) this.autoFinish(o);
        if (o.y > H + 120 && o.vy > 0) o.done = true;
      }
      // halves and props
      for (const h of this.halves) { h.vy += G * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; h.life -= dt; }
      this.halves = this.halves.filter((h) => h.life > 0 && h.y < H + 120);
      for (const p of this.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.coin) p.rot += dt * 8; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const s of this.splats) s.life -= dtReal * 0.12;
      this.splats = this.splats.filter((s) => s.life > 0).slice(-40);
      for (const t of this.texts) { t.life -= dtReal; t.y -= dtReal * 30; }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const a of this.autoSlashes) a.life -= dtReal;
      this.autoSlashes = this.autoSlashes.filter((a) => a.life > 0);
      for (const p of this.petals) {
        p.x += p.vx * dtReal; p.y += p.vy * dtReal; p.rot += p.vr * dtReal;
        if (p.y > H + 20 || p.x > W + 40) Object.assign(p, this.newPetal(false));
      }
      this.flash = Math.max(0, this.flash - dtReal * 2.4);
      this.soot = Math.max(0, this.soot - dtReal * 0.45);
      this.shake = Math.max(0, this.shake - dtReal);
      if (this.bannerT) { this.bannerT.life -= dtReal; if (this.bannerT.life <= 0) this.bannerT = null; }
      this.objs = this.objs.filter((o) => !(o.done && (o.demo || o.y > H + 120 || true)));

      // wave over: nothing left in the air
      if (w && !w.done && this.objs.filter((o) => !o.demo).length === 0 && this.t - w.started > 0.6) {
        w.done = true;
        const extra = w.lethal ? 900 : 350;
        setTimeout(() => { this.wave = null; w.resolve(); }, extra);
      }
    }

    /** Called when an object reaches its due moment: makes the server result true on screen. */
    autoFinish(o) {
      const w = this.wave;
      if (o.finished) return;
      o.finished = true;
      if (o.kind === 'bomb') {
        if (o.role === 'killer') this.detonate(o);
        else if (o.role === 'deflect') { this.autoSlashes.push({ x1: o.x - 70, y1: o.y + 40, x2: o.x + 70, y2: o.y - 40, life: 0.3 }); this.deflect(o, 1, -0.6); }
        return;
      }
      if (o.escape || w.lethalDone) return;
      if (w.lethal && !w.lethalDone) { o.due += 0.15; o.finished = false; return; } // let the bomb go first
      if (o.combo && !w.comboDone) { this.cutAlong({ x: o.x - 60, y: o.y }, { x: o.x + 60, y: o.y }, true); return; }
      const a = rnd(-0.8, 0.8);
      this.autoSlashes.push({ x1: o.x - Math.cos(a) * 70, y1: o.y - Math.sin(a) * 70, x2: o.x + Math.cos(a) * 70, y2: o.y + Math.sin(a) * 70, life: 0.3 });
      this.slice(o, Math.cos(a), Math.sin(a));
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
      for (const [lx, hue] of [[110, '#ff5a3c'], [W - 110, '#ff5a3c']]) {
        const sway = Math.sin(this.t * 1.3 + lx) * 4;
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 26); g.lineTo(lx + sway, 58); g.stroke();
        const glow = g.createRadialGradient(lx + sway, 92, 10, lx + sway, 92, 110);
        glow.addColorStop(0, 'rgba(255,140,80,0.35)'); glow.addColorStop(1, 'rgba(255,140,80,0)');
        g.fillStyle = glow; g.fillRect(lx - 120, -20, 240, 240);
        g.fillStyle = hue; roundRect(g, lx + sway - 26, 58, 52, 68, 22); g.fill();
        g.fillStyle = 'rgba(255,230,180,0.35)'; roundRect(g, lx + sway - 18, 64, 36, 56, 16); g.fill();
        g.strokeStyle = 'rgba(80,10,0,0.45)'; g.lineWidth = 1.5;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(lx + sway - 25, 58 + k * 17); g.lineTo(lx + sway + 25, 58 + k * 17); g.stroke(); }
        g.fillStyle = '#1a0e07'; g.fillRect(lx + sway - 14, 54, 28, 6); g.fillRect(lx + sway - 14, 124, 28, 6);
      }

      // juice splats on the wall
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
        for (let i = 0; i < 5; i++) { const a = s.seed + i * 1.7; g.beginPath(); g.arc(s.x + Math.cos(a) * s.r * 1.6, s.y + Math.sin(a) * s.r * 1.6, s.r * 0.12, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;

      // petals
      g.fillStyle = 'rgba(255,170,200,0.55)';
      for (const p of this.petals) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); g.fill(); g.restore(); }

      // objects
      for (const o of this.objs) {
        if (o.done || o.delay > 0) continue;
        if (o.kind === 'bomb') drawBomb(g, o, this.t);
        else drawFruit(g, o.type, o.x, o.y, o.rot, o.r, 0, this.t);
      }
      for (const h of this.halves) {
        g.globalAlpha = clamp(h.life, 0, 1);
        if (h.bomb) drawBomb(g, h, this.t);
        else drawFruit(g, h.type, h.x, h.y, h.rot, h.r, h.side, this.t);
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

      // auto slashes and the player's blade
      for (const a of this.autoSlashes) this.drawSlash(g, [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }], a.life / 0.35);
      if (this.trail.length > 1) this.drawSlash(g, this.trail, 1);

      // soot + flash
      if (this.soot > 0) { g.fillStyle = `rgba(12,8,6,${this.soot * 0.7})`; g.fillRect(-20, -20, W + 40, H + 40); }
      if (this.flash > 0) { g.fillStyle = `rgba(255,250,235,${this.flash * 0.85})`; g.fillRect(-20, -20, W + 40, H + 40); }

      // floating texts
      for (const t of this.texts) {
        const k = clamp(t.life / 1.3, 0, 1);
        const sc = 1 + (1 - k) * 0.08 + (k > 0.9 ? (k - 0.9) * 3 : 0);
        g.save(); g.translate(t.x, t.y); g.scale(sc, sc); g.globalAlpha = clamp(k * 2, 0, 1);
        textOut(g, t.text, 0, 0, t.size, t.color);
        g.restore();
      }
      g.globalAlpha = 1;

      // HUD: multiplier, shield, idle hint
      if (this.mult) textOut(g, this.mult, W / 2, 62, 46, '#ffd23f');
      if (this.shieldOn) {
        g.save(); g.translate(W - 46, 60);
        g.strokeStyle = '#7ad7ff'; g.lineWidth = 3; g.fillStyle = 'rgba(122,215,255,0.18)';
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; i ? g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22) : g.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); } g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      if (this.idle && !this.mult) textOut(g, 'SWIPE TO PRACTISE', W / 2, H - 40, 18, 'rgba(255,240,220,0.55)');
      if (this.bannerT) {
        const b = this.bannerT;
        const k = clamp(b.life / 1.6, 0, 1);
        const sc = k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
        g.save(); g.translate(W / 2, H * 0.44); g.scale(sc, sc); g.globalAlpha = clamp(k * 3, 0, 1);
        textOut(g, b.text, 0, 0, 62, b.tone === 'bad' ? '#ff4d4d' : b.tone === 'blue' ? '#7ad7ff' : '#ffd23f');
        if (b.sub) textOut(g, b.sub, 0, 54, 24, '#fff4e6');
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
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax; const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

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

  window.FruitScene = { Scene, BLADES, FRUITS, drawBladePreview, drawFruitStatic };
})();
