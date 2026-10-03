/*
 * Hill Climb Rush — driving scene (canvas 2D, world in metres, y up).
 *
 * The pedals really drive: gas / brake change speed, the suspension bounces over the bumps, in the air
 * gas pitches the nose up and brake pitches it down. The result of a hill is fixed by the server before
 * the hill starts (Provably Fair); once it arrives the "director" steers the physics toward it:
 * the speed at the jump lip, the arc, the rotation at landing, the fuel left at the crest.
 *
 * Each hill: start plateau · bumpy descent · kicker ramp · gap · landing slope · final climb · crest with
 * the checkpoint arch and a fuel can. The shape comes from a seed (round nonce + hill number), so it is
 * known before the hill starts and never depends on the outcome.
 */
(function () {
  const G = 11; // m/s², arcade gravity
  const STEP = 1 / 120;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------ vehicles & paints
  const VEHICLES = {
    jeep: { wb: 2.6, r: 0.56, maxV: 22, accel: 14, body: 'jeep' },
    truck: { wb: 2.9, r: 0.86, maxV: 20, accel: 12.5, body: 'truck' },
    bike: { wb: 1.55, r: 0.47, maxV: 24, accel: 16, body: 'bike' }
  };
  const PAINTS = {
    classic: { main: '#e8322b', dark: '#9e1712', trim: '#ffd23a' },
    desert: { main: '#d9a35b', dark: '#8a5f2a', trim: '#6b3d17' },
    arctic: { main: '#eef4f8', dark: '#9bb0bf', trim: '#2f8de4' },
    neon: { main: '#27272f', dark: '#0d0d12', trim: '#3cff9e' },
    gold: { main: '#f5c431', dark: '#a87c09', trim: '#fff3b0' }
  };
  const TRUCK_DEFAULT = { main: '#2f74e8', dark: '#173f8a', trim: '#ffd23a' };
  const BIKE_DEFAULT = { main: '#ff7a1a', dark: '#a8460a', trim: '#1b1b1b' };

  // biome per hill: meadow → dry → dune → canyon → rock → snow
  const BIOMES = [
    { grass: '#56c23a', grassDark: '#3a9a26', dirt: '#9a6a3c', dirt2: '#7a4f2b', far: '#7fb6e6', mid: '#3f9a4a' },
    { grass: '#56c23a', grassDark: '#3a9a26', dirt: '#9a6a3c', dirt2: '#7a4f2b', far: '#7fb6e6', mid: '#3f9a4a' },
    { grass: '#6cc83c', grassDark: '#4aa02a', dirt: '#a36f3e', dirt2: '#7d532d', far: '#86b9e3', mid: '#46a04b' },
    { grass: '#9fbf4a', grassDark: '#7a9a34', dirt: '#a0805e', dirt2: '#7c6045', far: '#8bb8dd', mid: '#6b9a46' },
    { grass: '#b9b456', grassDark: '#8f8a3c', dirt: '#a07548', dirt2: '#7b5634', far: '#9cbde0', mid: '#8a9a4c' },
    { grass: '#8db84a', grassDark: '#6a9334', dirt: '#8a5f36', dirt2: '#6a4527', far: '#9cbde0', mid: '#5f8f41' },
    { grass: '#f1cf72', grassDark: '#d6ad4e', dirt: '#e2b45e', dirt2: '#c4923f', far: '#f3c58a', mid: '#e0a95a' },
    { grass: '#d9733f', grassDark: '#b4552b', dirt: '#b0482a', dirt2: '#87331d', far: '#f0a77a', mid: '#c45f3a' },
    { grass: '#9aa3a8', grassDark: '#78838a', dirt: '#6f777c', dirt2: '#545b60', far: '#a9bccb', mid: '#7f8d96' },
    { grass: '#f7fbff', grassDark: '#d5e3ee', dirt: '#b9c8d4', dirt2: '#94a6b4', far: '#c9dcf0', mid: '#e7eff7' }
  ];

  // ------------------------------------------------------------------ track
  const HILLS = 10;
  const RES = 0.25; // metres per height sample
  const crestY = (k) => 6.5 * k;

  function buildTrack(nonce) {
    const hills = [];
    let x0 = 0;
    for (let k = 1; k <= HILLS; k++) {
      const R = rng((nonce * 7919 + k * 104729) >>> 0);
      const L = 96 + 5 * k;
      const yS = crestY(k - 1);
      const yE = crestY(k);
      const V = yS - (3 + 2.5 * R());
      const kh = 2.6 + 0.6 * R();
      const n = Math.max(1, Math.round(L / RES));
      const ys = new Float32Array(n + 1);
      const amp = 0.22 + 0.06 * k;
      const bumps = 3 + Math.floor(R() * 3);
      const phase = R() * TAU;
      const kickA = 0.45; const lipF = 0.52; const landF = 0.6; const landE = 0.78; const climbF = 0.8; const crestF = 0.95;
      const lipY = V + kh;
      const landY0 = lipY - 1.1;
      const V2 = V - 3.5 - R() * 1.5;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        let y;
        if (f < 0.06) y = yS;
        else if (f < 0.4) {
          const u = (f - 0.06) / 0.34;
          y = lerp(yS, V, smooth(u)) + amp * Math.sin(u * bumps * TAU + phase) * Math.sin(Math.PI * u);
        } else if (f < kickA) y = V;
        else if (f < lipF) { const u = (f - kickA) / (lipF - kickA); y = V + kh * u * u; } else if (f < landF) {
          const u = (f - lipF) / (landF - lipF); // gap: steep walls, deep floor
          y = V - 9 + 9 * Math.max(Math.pow(1 - u, 8), Math.pow(u, 8)) * (u < 0.5 ? (lipY - V + 9) / 9 : (landY0 - V + 9) / 9);
        } else if (f < landE) { const u = (f - landF) / (landE - landF); y = lerp(landY0, V2, 0.5 - 0.5 * Math.cos(Math.PI * u)); } else if (f < climbF) y = V2;
        else if (f < crestF) { const u = (f - climbF) / (crestF - climbF); y = V2 + (yE - V2) * (0.5 * u + 0.5 * smooth(u)); } else y = yE;
        ys[i] = y;
      }
      // decorations
      const deco = [];
      for (let i = 0; i < 6 + k; i++) {
        const f = 0.08 + R() * 0.3;
        deco.push({ f, type: R() < 0.55 ? 'tree' : R() < 0.5 ? 'rock' : 'bush', s: 0.7 + R() * 0.7 });
      }
      for (let i = 0; i < 3; i++) deco.push({ f: 0.8 + R() * 0.12, type: R() < 0.5 ? 'rock' : 'bush', s: 0.6 + R() * 0.5 });
      hills.push({
        k, x0, L, x1: x0 + L, n, ys, yS, yE, V, V2, kh,
        lipX: x0 + lipF * L, lipY, gapX0: x0 + lipF * L, landX0: x0 + landF * L, landX1: x0 + landE * L,
        climbX0: x0 + climbF * L, crestX: x0 + crestF * L, flagX: x0 + 0.975 * L, deco,
        biome: BIOMES[k - 1]
      });
      x0 += L;
    }
    return hills;
  }

  // ------------------------------------------------------------------ scene
  class Scene {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.vehicle = 'jeep';
      this.paint = 'classic';
      this.input = { gas: false, brake: false };
      this.particles = [];
      this.flags = [];
      this.chest = null;
      this.shake = 0;
      this.time = 0;
      this.onFrame = null;
      this.onEvent = null;
      this.clouds = Array.from({ length: 9 }, (_, i) => ({ x: i * 47 + Math.random() * 30, y: 16 + Math.random() * 10, s: 0.7 + Math.random() * 0.8 }));
      this.resetTrack(0, 0);
      this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas);
      let last = performance.now();
      let acc = 0;
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        acc += dt;
        while (acc >= STEP) { this.step(STEP); acc -= STEP; }
        this.draw();
        if (this.onFrame) this.onFrame(this.hud());
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    resize() {
      const r = this.cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
      this.dpr = dpr;
    }

    get V() { return VEHICLES[this.vehicle]; }

    setVehicle(id) { if (VEHICLES[id]) { this.vehicle = id; this.placeAt(this.parkLevel); } }
    setPaint(id) { this.paint = PAINTS[id] ? id : 'classic'; }
    colors() {
      if (this.paint !== 'classic') return PAINTS[this.paint];
      return this.vehicle === 'truck' ? TRUCK_DEFAULT : this.vehicle === 'bike' ? BIKE_DEFAULT : PAINTS.classic;
    }

    /** New track for a round (nonce) and the vehicle parked at checkpoint `level` (0 = start line). */
    resetTrack(nonce, level) {
      if (this.nonce !== nonce || !this.hills) { this.hills = buildTrack(nonce); this.nonce = nonce; }
      this.placeAt(level);
    }

    placeAt(level) {
      this.parkLevel = level;
      const x = level === 0 ? 4 : this.hills[level - 1].flagX + 2.2;
      this.car = {
        x, v: 0, y: 0, ang: 0, angV: 0, air: false, vx: 0, vy: 0, t: 0, T: 0,
        sus: 0, susV: 0, wheel: 0, crashed: false, flipT: 0, fuel: 100, engine: true
      };
      this.car.y = this.groundY(x) + this.V.r;
      this.car.ang = this.groundAng(x);
      this.state = 'parked';
      this.plan = null;
      this.chest = null;
      this.hill = level < HILLS ? this.hills[level] : null;
      this.arrivedFired = false;
      this.cam = { x: x + 7, y: this.car.y + 2, h: 17 };
      this.airTime = 0;
      this.trickShown = {};
    }

    hillAtX(x) {
      for (const h of this.hills) if (x < h.x1) return h;
      return null;
    }

    groundY(x) {
      if (x <= 0) return 0;
      const h = this.hillAtX(x);
      if (!h) return crestY(HILLS);
      const i = (x - h.x0) / RES;
      const i0 = Math.floor(i);
      const t = i - i0;
      return lerp(h.ys[Math.min(h.n, i0)], h.ys[Math.min(h.n, i0 + 1)], t);
    }

    /**
     * The surface the wheels rest on: the real ground, except over a jump gap, where the lip and the landing
     * slope are extended as their tangents — so a wheel that already hangs over the gap never drops into it.
     */
    supportY(x) {
      const h = this.hillAtX(x);
      if (!h || x <= h.gapX0 || x >= h.landX0) return this.groundY(x);
      const d = 0.4;
      if (x - h.gapX0 < h.landX0 - x) {
        const s = (this.groundY(h.gapX0) - this.groundY(h.gapX0 - d)) / d;
        return this.groundY(h.gapX0) + s * (x - h.gapX0);
      }
      const s = (this.groundY(h.landX0 + d) - this.groundY(h.landX0)) / d;
      return this.groundY(h.landX0) - s * (h.landX0 - x);
    }

    groundAng(x) {
      const d = 0.6;
      return Math.atan2(this.groundY(x + d) - this.groundY(x - d), 2 * d);
    }

    /** Flag labels drawn on the checkpoint arches: [{ label, state: 'done'|'next'|'future' }] per hill. */
    setFlags(flags) { this.flags = flags || []; }

    /** The player pressed GAS at a checkpoint: start driving the next hill (the plan may come later). */
    go() {
      if (this.state !== 'parked' || !this.hill) return false;
      this.state = 'drive';
      this.arrivedFired = false;
      this.car.fuel = 100;
      this.fuelEnd = 45;
      return true;
    }

    /**
     * The server's result for the hill being driven:
     * { outcome: backflip|coin_chest|big_air|fumes|clean|lethal, crash: flip|fuel|null, saved, seed }
     */
    setPlan(p) {
      const h = this.hill;
      if (!h) return;
      const R = rng((p.seed || 1) >>> 0);
      const landLen = h.landX1 - h.landX0;
      const kind = p.outcome === 'lethal' ? p.crash : p.outcome;
      const arcs = {
        clean: [1.1, 0.12], fumes: [1.1, 0.14], fuel: [1.12, 0.13], coin_chest: [1.4, 0.24],
        big_air: [2.6, 0.84], backflip: [2.15, 0.6], flip: [1.65, 0.4]
      };
      const [T, lf] = arcs[kind] || arcs.clean;
      const xL = h.lipX;
      const yL = h.lipY + this.V.r / Math.cos(Math.atan2(this.groundY(h.lipX) - this.groundY(h.lipX - 0.4), 0.4));
      const xT = h.landX0 + lf * landLen;
      const yT = this.groundY(xT) + this.V.r / Math.max(0.6, Math.cos(this.groundAng(xT)));
      const vx = (xT - xL) / T;
      const vy = (yT - yL + 0.5 * G * T * T) / T;
      const slopeT = this.groundAng(xT);
      const spin = kind === 'backflip' ? TAU : kind === 'flip' ? Math.PI * (1.02 + 0.1 * R()) : 0;
      this.plan = {
        kind, outcome: p.outcome, crash: p.crash, saved: !!p.saved,
        T, xL, yL, xT, yT, vx, vy, vLaunch: Math.hypot(vx, vy), slopeT, spin,
        fuelEnd: kind === 'fumes' ? 1.4 + R() * 1.4 : kind === 'fuel' ? 0 : 18 + R() * 50,
        fuelOutX: kind === 'fuel' ? h.climbX0 + (0.35 + 0.15 * R()) * (h.crestX - h.climbX0) : null
      };
      // the chest hangs over the gap: on the arc when it is won, a little above it otherwise
      const ta = vy / G;
      const tc = clamp(ta, 0.25 * T, 0.6 * T);
      const cx = xL + vx * tc;
      const cy = yL + vy * tc - 0.5 * G * tc * tc;
      this.chest = { x: cx, y: kind === 'coin_chest' ? cy + 0.2 : cy + 2.5 + this.V.r * 0.5, hit: false, bob: R() * TAU };
    }

    // -------------------------------------------------------------- physics
    step(dt) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 3);
      this.stepParticles(dt);
      const c = this.car;
      const V = this.V;
      const inp = this.input;
      if (this.state === 'parked' || this.state === 'stopping' || this.state === 'drive' || this.state === 'rollback') {
        const prevX = c.x;
        const slope = Math.atan2(this.supportY(c.x + 0.6) - this.supportY(c.x - 0.6), 1.2);
        const h = this.hill;
        let a = -G * Math.sin(slope) * 0.92 - 0.006 * c.v * Math.abs(c.v);
        if (Math.abs(c.v) > 0.05) a -= 0.5 * Math.sign(c.v);
        const engineOn = c.engine && c.fuel > 0;
        const driving = this.state === 'drive';
        if (driving && inp.gas && engineOn) a += V.accel * clamp(1 - Math.max(0, c.v) / V.maxV, 0, 1) + (c.v < 0 ? 6 : 0);
        if (driving && inp.brake) a += c.v > 0.3 ? -16 : c.v < -0.3 ? 10 : -c.v * 10;
        if (driving && !c.engine && c.v > 0) a -= 7; // engine dead on the climb: it cannot make the crest
        if (this.state === 'parked') { a = -c.v * 8; }
        if (this.state === 'stopping') { a = -Math.sign(c.v) * Math.min(14, Math.abs(c.v) * 6 + 2); }

        if (driving && h) {
          const p = this.plan;
          // without the server result the vehicle never gets near the jump
          const holdX = h.x0 + 0.37 * h.L;
          if (!p && c.x > holdX - 6 && c.v > 0) a = Math.min(a, -c.v * 3 - 1);
          // approach: with gas held the speed tends to the launch speed; without gas it fades away
          if (p && c.x > h.lipX - 24 && c.x < h.lipX) {
            if (inp.gas && engineOn) a = clamp((p.vLaunch - c.v) * 3, -10, 14);
            else if (c.x > h.lipX - 9) a = Math.min(a, -4);
          }
        }
        c.v = clamp(c.v + a * dt, -9, V.maxV * 1.35);
        if (this.state === 'stopping' && Math.abs(c.v) < 0.15) {
          c.v = 0;
          this.state = 'parked';
          // parked on the crest: the next hill starts here
          if (this.hill && this.arrivedFired) { this.parkLevel = this.hill.k; this.hill = this.hills[this.hill.k] || null; this.plan = null; this.chest = null; }
          if (this.onEvent) this.onEvent('parked');
        }
        c.x += c.v * Math.cos(slope) * dt;
        c.x = Math.max(-20, c.x);
        c.wheel += (c.v * dt) / V.r;

        // fuel follows the distance (exactly the planned level at the crest)
        if (driving && h) {
          const p = this.plan;
          const end = p ? p.fuelEnd : 45;
          const outX = p && p.fuelOutX;
          const span = (outX || h.crestX) - h.x0;
          const level = 100 - (100 - end) * clamp((c.x - h.x0) / span, 0, 1);
          c.fuel = Math.min(c.fuel, Math.max(0, level));
          if (outX && c.x >= outX && c.engine) {
            c.engine = false;
            c.fuel = 0;
            this.emit('engine_out');
          }
          if (!c.engine && c.v < -0.8 && this.state === 'drive') { this.state = 'rollback'; this.rollT = 0; }
          // take-off at the lip
          if (p && prevX < h.lipX && c.x >= h.lipX) return this.takeOff();
          // checkpoint
          if (prevX < h.flagX && c.x >= h.flagX && !this.arrivedFired && c.engine) {
            this.arrivedFired = true;
            this.state = 'stopping';
            this.emit('arrived', { fuel: c.fuel });
          }
        }
        if (this.state === 'rollback') {
          this.rollT += dt;
          if (this.rollT > 1.1 && !this.fuelOutFired) { this.fuelOutFired = true; this.emit('crash', { kind: 'fuel', saved: this.plan && this.plan.saved }); }
          if (c.x < (h ? h.landX1 : 0)) { c.v *= 0.96; }
        }
        // body follows the ground under both wheels, with suspension
        const xR = c.x - (V.wb / 2) * Math.cos(c.ang);
        const xF = c.x + (V.wb / 2) * Math.cos(c.ang);
        const yR = this.supportY(xR);
        const yF = this.supportY(xF);
        let target = Math.atan2(yF - yR, xF - xR);
        if (driving && inp.gas && engineOn && c.v > 1) target += 0.05; // a hint of wheelie
        if (driving && inp.brake && c.v > 1) target -= 0.04;
        c.angV += (wrapPi(target - c.ang) * 160 - c.angV * 16) * dt;
        c.ang += c.angV * dt;
        // wheel centres sit one radius away from the surface along its normal, not straight above it
        const lift = (sl) => V.r / Math.max(0.6, Math.cos(sl));
        const slR = Math.atan2(this.supportY(xR + 0.3) - this.supportY(xR - 0.3), 0.6);
        const slF = Math.atan2(this.supportY(xF + 0.3) - this.supportY(xF - 0.3), 0.6);
        const yTarget = (yR + lift(slR) + yF + lift(slF)) / 2;
        const dy = yTarget - c.y;
        c.susV += (-c.sus * 180 - c.susV * 12) * dt + dy * 0.0; // eslint-friendly
        c.sus += c.susV * dt;
        if (Math.abs(dy) > 0.02) c.susV -= dy * 9;
        c.y = yTarget;
        if (driving && inp.gas && engineOn && c.v > 2 && Math.random() < 0.12) this.dust(xR, yR, -1);
        if (driving && inp.gas && engineOn && Math.random() < 0.1) this.smoke();
      } else if (this.state === 'air') {
        this.stepAir(dt);
      } else if (this.state === 'crashed') {
        c.t += dt;
        // tumble: slide down the slope on the roof
        const slope = this.groundAng(c.x);
        c.v = c.v * 0.97 - G * Math.sin(slope) * 0.25 * dt;
        c.x += c.v * dt;
        c.angV *= 0.9;
        c.ang += c.angV * dt;
        c.ang += wrapPi(slope + Math.PI - c.ang) * Math.min(1, dt * 6);
        c.y = this.groundY(c.x) + 0.55;
        if (c.t > 0.55 && !this.crashFired) { this.crashFired = true; this.emit('crash', { kind: 'flip' }); }
      }
      this.updateCam(dt);
    }

    takeOff() {
      const c = this.car;
      const p = this.plan;
      this.state = 'air';
      c.air = true;
      c.t = 0;
      c.x = p.xL;
      c.y = p.yL;
      c.vx = p.vx;
      c.vy = p.vy;
      c.ang = this.groundAng(p.xL - 0.5);
      c.angV = 0.6;
      c.angFree = c.ang;
      this.airTime = 0;
      this.emit('takeoff', { kind: p.kind });
      for (let i = 0; i < 10; i++) this.dust(c.x - 1, p.yL - this.V.r, -1);
    }

    stepAir(dt) {
      const c = this.car;
      const p = this.plan;
      const inp = this.input;
      c.t += dt;
      this.airTime = c.t;
      const t = Math.min(c.t, p.T);
      c.x = p.xL + p.vx * t;
      c.y = p.yL + p.vy * t - 0.5 * G * t * t;
      c.wheel += dt * 14;
      // free rotation with the pedals
      c.angV += ((inp.gas ? 5.5 : 0) - (inp.brake ? 5.5 : 0)) * dt;
      c.angV *= 0.995;
      // director: blend toward the planned landing attitude
      const left = Math.max(0.06, p.T - c.t);
      const goal = p.slopeT + p.spin + (p.kind === 'flip' ? 0 : 0);
      const need = (goal - c.ang) / left;
      const w = smooth((c.t / p.T - 0.3) / 0.5);
      const angV = lerp(c.angV, need, w);
      c.ang += angV * dt;
      if (w > 0.01) c.angV = angV;
      // chest
      const ch = this.chest;
      if (ch && !ch.hit && Math.hypot(c.x - ch.x, c.y + 0.4 - ch.y) < 1.4 && p.kind === 'coin_chest') {
        ch.hit = true;
        this.burst(ch.x, ch.y, 28, 'coin');
        this.emit('trick', { id: 'coin_chest' });
      }
      if (p.kind === 'big_air' && c.t > 2.5 && !this.trickShown.air) { this.trickShown.air = true; this.emit('trick', { id: 'big_air' }); }
      if (c.t >= p.T) this.land();
    }

    land() {
      const c = this.car;
      const p = this.plan;
      c.air = false;
      c.x = p.xT;
      c.y = p.yT;
      if (p.kind === 'flip') {
        this.state = 'crashed';
        c.t = 0;
        c.v = 4;
        c.angV = 3;
        this.crashFired = false;
        this.shake = 1;
        this.burst(c.x, c.y + 0.6, 18, 'star');
        for (let i = 0; i < 16; i++) this.dust(c.x, c.y - this.V.r, 1);
        this.emit('impact', { kind: 'flip' });
        return;
      }
      c.ang = p.slopeT;
      c.angV = 0;
      this.state = 'drive';
      const s = p.slopeT;
      c.v = Math.max(7, p.vx * Math.cos(s) + (p.vy - G * p.T) * Math.sin(s));
      c.susV = -4;
      this.shake = 0.35;
      for (let i = 0; i < 12; i++) this.dust(c.x, c.y - this.V.r, 1);
      if (p.kind === 'backflip') this.emit('trick', { id: 'backflip' });
      this.emit('landed', { kind: p.kind, air: c.t });
    }

    updateCam(dt) {
      const c = this.car;
      const narrow = this.cv.width < this.cv.height * 1.2;
      const ahead = (this.state === 'air' ? 9 : this.state === 'drive' ? 6 + Math.max(0, c.v) * 0.25 : 5) * (narrow ? 0.7 : 1);
      let h = this.state === 'air' ? 21 : 17 + Math.max(0, c.v) * 0.12;
      // narrow (portrait) stages: keep at least ~26 m of road in view
      const aspect = this.cv.width / Math.max(1, this.cv.height);
      h = Math.max(h, (this.state === 'air' ? 30 : 26) / aspect);
      const k = Math.min(1, dt * 4);
      this.cam.x += (c.x + ahead - this.cam.x) * k;
      this.cam.y += (c.y + 1.6 + Math.max(0, this.cam.h - 20) * 0.18 - this.cam.y) * Math.min(1, dt * 3.2);
      this.cam.h += (h - this.cam.h) * Math.min(1, dt * 1.5);
    }

    emit(type, data) { if (this.onEvent) this.onEvent(type, data || {}); }

    hud() {
      const c = this.car;
      const h = this.hill;
      const prog = h ? clamp((c.x - h.x0) / (h.flagX - h.x0), 0, 1) : 1;
      return { fuel: c.fuel, speed: Math.max(0, c.v), air: this.state === 'air' ? this.airTime : 0, progress: prog, state: this.state, level: this.parkLevel, engine: c.engine };
    }

    // -------------------------------------------------------------- particles
    dust(x, y, dir) {
      this.particles.push({ x, y: y + 0.1, vx: dir * (1 + Math.random() * 3), vy: 1 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, t: 0, type: 'dust', s: 0.25 + Math.random() * 0.35 });
    }

    smoke() {
      const c = this.car;
      const ex = c.x - Math.cos(c.ang) * (this.V.wb / 2 + 0.4);
      const ey = c.y + 0.35 + Math.sin(c.ang) * -(this.V.wb / 2 + 0.4);
      this.particles.push({ x: ex, y: ey, vx: -1.2 - Math.random(), vy: 0.6 + Math.random() * 0.6, life: 0.6, t: 0, type: 'smoke', s: 0.15 + Math.random() * 0.15 });
    }

    burst(x, y, n, type) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = 2 + Math.random() * 6;
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, life: 0.9 + Math.random() * 0.6, t: 0, type, s: type === 'coin' ? 0.28 : 0.3, r: Math.random() * TAU });
      }
    }

    /** Coins rain over the vehicle (cash-out / top). */
    coins(n = 30) { const c = this.car; for (let i = 0; i < n; i++) this.burst(c.x + (Math.random() - 0.5) * 3, c.y + 3 + Math.random() * 2, 1, 'coin'); }

    /** Refuel splash at the checkpoint. */
    refuel() { const c = this.car; c.fuel = 100; c.engine = true; this.burst(c.x, c.y + 1.4, 10, 'drop'); }

    stepParticles(dt) {
      const ps = this.particles;
      for (const p of ps) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'coin' || p.type === 'drop' || p.type === 'star') p.vy -= G * 0.8 * dt;
        else p.vy *= 0.97;
        p.vx *= 0.98;
        if (p.r != null) p.r += dt * 8;
      }
      this.particles = ps.filter((p) => p.t < p.life);
    }

    // -------------------------------------------------------------- drawing
    draw() {
      const ctx = this.ctx;
      const W = this.cv.width;
      const H = this.cv.height;
      const ppm = H / this.cam.h;
      this.ppm = ppm;
      const sx = (Math.random() - 0.5) * this.shake * 8 * this.dpr;
      const sy = (Math.random() - 0.5) * this.shake * 8 * this.dpr;
      this.ox = W / 2 - this.cam.x * ppm + sx;
      this.oy = H / 2 + this.cam.y * ppm + sy;
      const X = (x) => this.ox + x * ppm;
      const Y = (y) => this.oy - y * ppm;
      this.X = X; this.Y = Y;
      const hill = this.hillAtX(this.cam.x) || this.hills[HILLS - 1];
      const bio = hill.biome;

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      const snowy = hill.k >= 9;
      sky.addColorStop(0, snowy ? '#5d9fe0' : hill.k >= 7 ? '#4fa3ef' : '#3d9df3');
      sky.addColorStop(0.65, snowy ? '#cfe5f7' : hill.k >= 7 ? '#ffe2b0' : '#bfe7ff');
      sky.addColorStop(1, snowy ? '#eef6fc' : '#e6f6ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // sun
      ctx.fillStyle = 'rgba(255,236,150,0.95)';
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.17, H * 0.07, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,150,0.25)';
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.17, H * 0.12, 0, TAU); ctx.fill();
      // clouds (parallax 0.12)
      for (const cl of this.clouds) {
        const span = W + 400 * this.dpr;
        const cx = (((cl.x * 9 * this.dpr - this.cam.x * ppm * 0.08) % span) + span) % span - 200 * this.dpr;
        this.cloud(cx, H * 0.08 + (cl.y - 16) * 9 * this.dpr, cl.s * 26 * this.dpr);
      }
      // far mountains (parallax 0.2) and mid hills (0.5)
      this.ridge(0.18, bio.far, 0.32, 9, 0.9);
      this.ridge(0.45, bio.mid, 0.12, 5, 0.55);

      // terrain
      const x0 = this.cam.x - W / ppm / 2 - 2;
      const x1 = this.cam.x + W / ppm / 2 + 2;
      // sample on a fixed world grid (never relative to the camera or the zoom), so the outline does not shimmer
      const stepM = RES;
      const gx0 = Math.floor(x0 / stepM) * stepM;
      const samples = [];
      for (let x = gx0; x <= x1 + stepM; x += stepM) samples.push(x);
      // dirt body
      ctx.beginPath();
      ctx.moveTo(X(gx0), H + 10);
      for (const x of samples) ctx.lineTo(X(x), Y(this.groundY(x)));
      ctx.lineTo(X(samples[samples.length - 1]), H + 10);
      ctx.closePath();
      const dirt = ctx.createLinearGradient(0, Y(hill.yE + 4), 0, H);
      dirt.addColorStop(0, bio.dirt);
      dirt.addColorStop(1, bio.dirt2);
      ctx.fillStyle = dirt;
      ctx.fill();
      // gap shading
      for (const h of this.hills) {
        if (h.landX0 < x0 || h.gapX0 > x1) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(X(h.gapX0), Y(h.lipY));
        for (let i = Math.ceil((h.gapX0 - h.x0) / RES); h.x0 + i * RES <= h.landX0; i++) ctx.lineTo(X(h.x0 + i * RES), Y(h.ys[Math.min(h.n, i)]));
        ctx.lineTo(X(h.landX0), Y(this.groundY(h.landX0)));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, Y(h.lipY), 0, Y(h.V - 9));
        g.addColorStop(0, 'rgba(30,18,10,0.35)');
        g.addColorStop(1, 'rgba(10,6,4,0.85)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
      // dirt speckles (world-anchored)
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = Math.ceil(x0 / 1.3) * 1.3; x <= x1; x += 1.3) {
        const gy = this.groundY(x);
        const r1 = Math.sin(Math.round(x / 1.3) * 12.9898) * 43758.5453;
        const f = r1 - Math.floor(r1);
        ctx.beginPath(); ctx.arc(X(x + f), Y(gy - 0.8 - f * 3), ppm * (0.08 + f * 0.1), 0, TAU); ctx.fill();
      }
      // grass edge: one stroke per stretch of solid ground, ending exactly at the lip and starting exactly at the landing
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      let pen = false;
      for (const x of samples) {
        const h = this.hillAtX(x);
        const inGap = h && x > h.gapX0 && x < h.landX0;
        if (inGap) {
          if (pen) { ctx.lineTo(X(h.gapX0), Y(this.groundY(h.gapX0))); pen = false; }
          continue;
        }
        if (!pen) {
          const hp = this.hillAtX(x - stepM);
          if (hp && x - stepM > hp.gapX0 && x - stepM < hp.landX0) ctx.moveTo(X(hp.landX0), Y(this.groundY(hp.landX0)));
          else ctx.moveTo(X(x), Y(this.groundY(x)));
          pen = true;
        }
        ctx.lineTo(X(x), Y(this.groundY(x)));
      }
      ctx.strokeStyle = (hill.biome || bio).grassDark;
      ctx.lineWidth = ppm * 0.62;
      ctx.stroke();
      ctx.strokeStyle = bio.grass;
      ctx.lineWidth = ppm * 0.42;
      ctx.stroke();

      // per-hill props
      for (const h of this.hills) {
        if (h.x1 < x0 - 10 || h.x0 > x1 + 10) continue;
        for (const d of h.deco) this.prop(d, h);
        this.kickerPlanks(h);
        this.warnSign(h);
        this.checkpoint(h);
        if (h.k === 1) this.startLine();
      }
      if (this.chest && this.hill) this.drawChest();

      // vehicle
      this.drawVehicle();
      this.drawParticles();
      // speed lines in the air
      if (this.state === 'air') {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2 * this.dpr;
        for (let i = 0; i < 6; i++) {
          const yy = (Math.sin(this.time * 7 + i * 3.1) * 0.5 + 0.5) * H;
          const xx = ((this.time * 900 + i * 260) % (W + 200)) - 100;
          ctx.beginPath(); ctx.moveTo(W - xx, yy); ctx.lineTo(W - xx + 60 * this.dpr, yy); ctx.stroke();
        }
      }
    }

    cloud(x, y, s) {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(x, y, s * 1.1, 0, TAU);
      ctx.arc(x + s * 1.3, y - s * 0.4, s * 1.4, 0, TAU);
      ctx.arc(x + s * 2.8, y, s * 1.1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - s * 0.2, y - s * 0.2, s * 3.2, s * 1.3, s * 0.65);
      ctx.fill();
    }

    ridge(par, color, heightK, scale, alpha) {
      const ctx = this.ctx;
      const W = this.cv.width;
      const H = this.cv.height;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const base = H * (0.62 - heightK * 0.4);
      for (let px = 0; px <= W + 8; px += 8) {
        const wx = (px - W / 2) / this.ppm + this.cam.x * par;
        const y = base - (Math.sin(wx / scale) * 0.5 + Math.sin(wx / (scale * 2.7) + 1.3) * 0.8 + Math.sin(wx / (scale * 0.53) + 2) * 0.2) * H * heightK * 0.5 + (this.cam.y * par * this.ppm * 0.15);
        ctx.lineTo(px, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    prop(d, h) {
      const ctx = this.ctx;
      const x = h.x0 + d.f * h.L;
      const gy = this.groundY(x);
      const X = this.X(x);
      const Y = this.Y(gy);
      const p = this.ppm * d.s;
      if (d.type === 'tree') {
        const snow = h.k >= 9;
        const sand = h.k === 7;
        if (sand) { // cactus
          ctx.fillStyle = '#3f9a4a';
          ctx.fillRect(X - p * 0.25, Y - p * 3, p * 0.5, p * 3);
          ctx.fillRect(X - p * 1.0, Y - p * 2.1, p * 0.4, p * 1.1);
          ctx.fillRect(X - p * 1.0, Y - p * 1.1, p * 0.9, p * 0.35);
          ctx.fillRect(X + p * 0.55, Y - p * 2.6, p * 0.4, p * 1.0);
          ctx.fillRect(X + p * 0.15, Y - p * 1.7, p * 0.8, p * 0.35);
          return;
        }
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(X - p * 0.18, Y - p * 1.6, p * 0.36, p * 1.6);
        if (h.k >= 8) { // pine
          ctx.fillStyle = snow ? '#2f6b4e' : '#2f7a3e';
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(X - p * (1.4 - i * 0.3), Y - p * (1.2 + i * 1.1));
            ctx.lineTo(X + p * (1.4 - i * 0.3), Y - p * (1.2 + i * 1.1));
            ctx.lineTo(X, Y - p * (3 + i * 1.1));
            ctx.closePath();
            ctx.fill();
          }
          if (snow) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(X - p * 0.5, Y - p * 4.6); ctx.lineTo(X + p * 0.5, Y - p * 4.6); ctx.lineTo(X, Y - p * 5.3); ctx.fill(); }
          return;
        }
        ctx.fillStyle = h.k >= 4 && h.k <= 5 ? '#7aa83a' : '#3fa34a';
        ctx.beginPath(); ctx.arc(X, Y - p * 2.4, p * 1.3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(X - p * 0.4, Y - p * 2.8, p * 0.55, 0, TAU); ctx.fill();
      } else if (d.type === 'rock') {
        ctx.fillStyle = h.k === 8 ? '#8f3d22' : '#8a8f94';
        ctx.beginPath(); ctx.ellipse(X, Y - p * 0.2, p * 0.9, p * 0.6, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(X - p * 0.25, Y - p * 0.45, p * 0.35, p * 0.2, 0, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = h.k >= 9 ? '#d9e6ef' : h.k === 7 ? '#c9a24f' : '#2f8f3a';
        ctx.beginPath(); ctx.arc(X - p * 0.5, Y, p * 0.6, Math.PI, 0); ctx.arc(X + p * 0.3, Y, p * 0.75, Math.PI, 0); ctx.fill();
      }
    }

    kickerPlanks(h) {
      const ctx = this.ctx;
      const a = h.x0 + 0.45 * h.L;
      const b = h.lipX;
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = this.ppm * 0.18;
      for (let x = a + 1; x < b; x += 0.9) {
        const y = this.groundY(x);
        ctx.beginPath(); ctx.moveTo(this.X(x), this.Y(y)); ctx.lineTo(this.X(x), this.Y(Math.max(h.V, y - 3))); ctx.stroke();
      }
      ctx.strokeStyle = '#c98d4a';
      ctx.lineWidth = this.ppm * 0.22;
      ctx.beginPath();
      for (let x = a + 0.5; x <= b; x += 0.3) ctx.lineTo(this.X(x), this.Y(this.groundY(x) + 0.05));
      ctx.stroke();
    }

    warnSign(h) {
      const ctx = this.ctx;
      const x = h.x0 + 0.41 * h.L;
      const y = this.groundY(x);
      const p = this.ppm;
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(this.X(x) - p * 0.08, this.Y(y + 2), p * 0.16, p * 2);
      ctx.save();
      ctx.translate(this.X(x), this.Y(y + 2.4));
      ctx.fillStyle = '#ffd23a';
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = p * 0.08;
      ctx.beginPath(); ctx.moveTo(0, -p * 0.75); ctx.lineTo(p * 0.75, 0); ctx.lineTo(0, p * 0.75); ctx.lineTo(-p * 0.75, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1b1b1b';
      ctx.font = `900 ${p * 0.75}px "Russo One", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, p * 0.05);
      ctx.restore();
    }

    startLine() {
      const ctx = this.ctx;
      const p = this.ppm;
      const x = this.X(0);
      const y = this.Y(0);
      for (let i = 0; i < 2; i++) { ctx.fillStyle = '#e9e9e9'; ctx.fillRect(x + (i ? 4.6 : -0.2) * p, y - p * 4.2, p * 0.2, p * 4.2); }
      const cw = 0.4;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
        ctx.fillRect(x + c * cw * p, y - p * (4.2 - r * cw), cw * p, cw * p);
      }
    }

    checkpoint(h) {
      const ctx = this.ctx;
      const p = this.ppm;
      const x = this.X(h.flagX);
      const y = this.Y(h.yE);
      const fl = this.flags[h.k - 1] || {};
      const col = fl.state === 'done' ? '#2fbf5b' : fl.state === 'dead' ? '#d93a2b' : fl.state === 'next' ? '#ffb000' : '#3a74d9';
      // poles
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x - p * 2.6, y - p * 5.2, p * 0.22, p * 5.2);
      ctx.fillRect(x + p * 2.4, y - p * 5.2, p * 0.22, p * 5.2);
      // banner
      ctx.fillStyle = col;
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = p * 0.1;
      const bw = 5.2 * p;
      const bh = 1.5 * p;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y - p * 6.4, bw, bh, p * 0.3);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${p * 0.72}px "Russo One", sans-serif`;
      ctx.fillText(fl.label || `#${h.k}`, x, y - p * 5.62);
      // fuel can on the crest (taken when the vehicle stops here)
      if (!(this.parkLevel >= h.k && this.state === 'parked') && h.k < HILLS) this.fuelCan(h.flagX + 4.2, h.yE);
      if (h.k === HILLS) { // finish: checkered flag
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff'; ctx.fillRect(x + p * (2.62 + c * 0.35), y - p * (5.2 - r * 0.35), p * 0.35, p * 0.35); }
      }
    }

    fuelCan(wx, wy) {
      const ctx = this.ctx;
      const p = this.ppm;
      const x = this.X(wx);
      const y = this.Y(wy) - Math.sin(this.time * 3) * p * 0.12;
      ctx.fillStyle = '#e8322b';
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = p * 0.08;
      ctx.beginPath(); ctx.roundRect(x - p * 0.5, y - p * 1.5, p, p * 1.25, p * 0.15); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(x - p * 0.1, y - p * 1.75, p * 0.35, p * 0.25);
      ctx.fillStyle = '#fff';
      ctx.font = `${p * 0.38}px "Russo One", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('GAS', x, y - p * 0.85);
    }

    drawChest() {
      const ch = this.chest;
      if (ch.hit) return;
      const ctx = this.ctx;
      const p = this.ppm;
      const bob = Math.sin(this.time * 2 + ch.bob) * 0.15;
      const x = this.X(ch.x);
      const y = this.Y(ch.y + bob);
      // balloons
      const cols = ['#ff4d6d', '#3aa0ff', '#ffd23a'];
      for (let i = 0; i < 3; i++) {
        const bx = x + (i - 1) * p * 0.8;
        const by = y - p * (3.2 + (i === 1 ? 0.5 : 0));
        ctx.strokeStyle = 'rgba(40,40,40,0.6)';
        ctx.lineWidth = 1.2 * this.dpr;
        ctx.beginPath(); ctx.moveTo(x, y - p * 0.5); ctx.lineTo(bx, by + p * 0.6); ctx.stroke();
        ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.ellipse(bx, by, p * 0.55, p * 0.68, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(bx - p * 0.18, by - p * 0.2, p * 0.14, p * 0.2, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#8a5a26';
      ctx.strokeStyle = '#3d2410';
      ctx.lineWidth = p * 0.08;
      ctx.beginPath(); ctx.roundRect(x - p * 0.75, y - p * 0.55, p * 1.5, p * 1.05, p * 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(x - p * 0.75, y - p * 0.2, p * 1.5, p * 0.16);
      ctx.fillRect(x - p * 0.12, y - p * 0.3, p * 0.24, p * 0.36);
    }

    drawParticles() {
      const ctx = this.ctx;
      const p = this.ppm;
      for (const q of this.particles) {
        const a = 1 - q.t / q.life;
        const x = this.X(q.x);
        const y = this.Y(q.y);
        if (q.type === 'dust') { ctx.fillStyle = `rgba(150,110,70,${a * 0.6})`; ctx.beginPath(); ctx.arc(x, y, p * q.s * (1 + q.t * 2), 0, TAU); ctx.fill(); }
        else if (q.type === 'smoke') { ctx.fillStyle = `rgba(80,80,80,${a * 0.45})`; ctx.beginPath(); ctx.arc(x, y, p * q.s * (1 + q.t * 3), 0, TAU); ctx.fill(); }
        else if (q.type === 'coin') {
          ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(Math.cos(q.r)) + 0.2, 1);
          ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#a87c09'; ctx.lineWidth = p * 0.05;
          ctx.beginPath(); ctx.arc(0, 0, p * q.s, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
        } else if (q.type === 'drop') { ctx.fillStyle = `rgba(255,120,40,${a})`; ctx.beginPath(); ctx.arc(x, y, p * 0.12, 0, TAU); ctx.fill(); }
        else if (q.type === 'star') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(q.r); ctx.fillStyle = `rgba(255,230,80,${a})`;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) { const rr = i % 2 ? p * 0.12 : p * 0.3; ctx.lineTo(Math.cos(i * Math.PI / 5) * rr, Math.sin(i * Math.PI / 5) * rr); }
          ctx.fill(); ctx.restore();
        }
      }
    }

    // -------------------------------------------------------------- vehicle drawing (local metres, y up)
    drawVehicle() {
      const ctx = this.ctx;
      const c = this.car;
      const V = this.V;
      const p = this.ppm;
      const col = this.colors();
      ctx.save();
      ctx.translate(this.X(c.x), this.Y(c.y));
      ctx.scale(p, -p);
      ctx.rotate(c.ang);
      ctx.lineJoin = 'round';
      const lw = 0.07;
      const sus = clamp(c.sus, -0.25, 0.25);
      const wheel = (wx, r) => {
        ctx.save();
        ctx.translate(wx, 0);
        ctx.rotate(-c.wheel);
        ctx.fillStyle = '#1d1d1f';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        // tread
        ctx.strokeStyle = '#3a3a3e';
        ctx.lineWidth = r * 0.16;
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); ctx.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98); ctx.stroke(); }
        ctx.fillStyle = '#c9ced4';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a8088';
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27, r * 0.07, 0, TAU); ctx.fill(); }
        ctx.restore();
      };
      const stroke = () => { ctx.lineWidth = lw; ctx.strokeStyle = '#141414'; ctx.stroke(); };
      const hw = V.wb / 2;
      if (V.body === 'bike') {
        wheel(-hw, V.r);
        wheel(hw, V.r);
        ctx.translate(0, sus * 0.5);
        // frame
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(-0.1, 0.55); ctx.lineTo(hw, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hw, 0); ctx.lineTo(0.55, 0.95); ctx.stroke();
        ctx.fillStyle = col.main;
        ctx.beginPath(); ctx.moveTo(-0.55, 0.55); ctx.lineTo(0.45, 0.62); ctx.lineTo(0.62, 0.92); ctx.lineTo(-0.2, 0.86); ctx.closePath(); ctx.fill(); stroke();
        ctx.beginPath(); ctx.moveTo(-0.95, 0.5); ctx.lineTo(-0.3, 0.6); ctx.lineTo(-0.35, 0.72); ctx.lineTo(-1.05, 0.62); ctx.closePath(); ctx.fill(); stroke();
        // rider
        ctx.strokeStyle = '#1f3a8a'; ctx.lineWidth = 0.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-0.3, 0.85); ctx.lineTo(0.05, 0.55); ctx.lineTo(0.15, 0.35); ctx.stroke(); // leg
        ctx.strokeStyle = col.main; ctx.lineWidth = 0.26;
        ctx.beginPath(); ctx.moveTo(-0.3, 0.9); ctx.lineTo(0.05, 1.45); ctx.stroke(); // torso
        ctx.strokeStyle = '#f2c9a0'; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.moveTo(0.05, 1.38); ctx.lineTo(0.4, 1.12); ctx.lineTo(0.55, 1.0); ctx.stroke(); // arm
        this.head(0.12, 1.72, 0.27, col);
        ctx.restore();
        return;
      }
      const truck = V.body === 'truck';
      // suspension struts
      ctx.strokeStyle = '#555'; ctx.lineWidth = 0.1;
      const bodyY = (truck ? 0.55 : 0.18) + sus * 0.6;
      ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(-hw + 0.2, bodyY + 0.1); ctx.moveTo(hw, 0); ctx.lineTo(hw - 0.2, bodyY + 0.1); ctx.stroke();
      wheel(-hw, V.r);
      wheel(hw, V.r);
      ctx.translate(0, bodyY);
      const L = truck ? 1.95 : 1.8;
      // chassis
      ctx.fillStyle = col.main;
      ctx.beginPath();
      ctx.moveTo(-L, 0.05); ctx.lineTo(L + 0.1, 0.05); ctx.lineTo(L + 0.15, 0.45); ctx.lineTo(0.9, 0.62); ctx.lineTo(0.55, 1.15);
      ctx.lineTo(-0.15, 1.15); ctx.lineTo(-0.35, 0.62); ctx.lineTo(-L, 0.62); ctx.closePath();
      ctx.fill(); stroke();
      // shade + trim
      ctx.fillStyle = col.dark;
      ctx.beginPath(); ctx.moveTo(-L, 0.05); ctx.lineTo(L + 0.1, 0.05); ctx.lineTo(L + 0.12, 0.22); ctx.lineTo(-L, 0.22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col.trim;
      ctx.fillRect(-L + 0.15, 0.3, 1.2, 0.1);
      // window
      ctx.fillStyle = 'rgba(170,220,255,0.85)';
      ctx.beginPath(); ctx.moveTo(0.05, 0.66); ctx.lineTo(0.78, 0.66); ctx.lineTo(0.5, 1.05); ctx.lineTo(0.05, 1.05); ctx.closePath(); ctx.fill(); stroke();
      // roll bar
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(-1.2, 0.62); ctx.lineTo(-1.0, 1.45); ctx.lineTo(-0.25, 1.45); ctx.lineTo(-0.15, 1.15); ctx.stroke();
      // headlight / taillight
      ctx.fillStyle = '#ffe680'; ctx.fillRect(L - 0.05, 0.28, 0.18, 0.14);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-L - 0.05, 0.36, 0.12, 0.14);
      // driver
      this.head(-0.55, 1.25, 0.3, col);
      if (truck) { ctx.fillStyle = col.trim; ctx.font = '0.4px sans-serif'; }
      ctx.restore();
    }

    head(x, y, r, col) {
      const ctx = this.ctx;
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.05; ctx.strokeStyle = '#141414'; ctx.stroke();
      // helmet
      ctx.fillStyle = col.trim === '#1b1b1b' ? '#fff' : col.trim;
      ctx.beginPath(); ctx.arc(x, y + 0.03, r * 1.05, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      // eye
      ctx.fillStyle = '#141414';
      ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.12, r * 0.12, 0, TAU); ctx.fill();
    }
  }

  window.HillScene = { Scene, VEHICLES, PAINTS, buildTrack, HILLS };
})();
