/**
 * GiantReelView — reels with giant (multi-row) symbols and sticky multiplier giants.
 * Registered on SlotKit.views; see docs/ARCHITECTURE.md (client).
 */
(function () {
  const { TAU, clamp, key } = SlotKit.util;
  const { ReelView } = SlotKit.views;

  // ================================================================ GIANTS
  /**
   * Reels with tall "giant" symbols (mechanic 'giants').
   * A giant occupies `height` rows of one reel. Reel entries are plain symbol ids or
   * part tokens "SYMBOL~k" (k = row inside the giant, 0 = top). Sticky giants of the
   * free spins are drawn as overlays that stay in place while the reel spins below.
   *
   * cfg.reel_heights (e.g. [3,4,5,6,5,4,3]) gives every reel its own number of rows; shorter reels
   * are centred vertically. Server rows stay top-aligned per reel (row 0 = top of that reel), the
   * view adds the offset. A giant with height 'reel' covers its whole reel.
   * theme.stage.reel_rects ([{x,y,w,h}] in stage-picture pixels) places every reel exactly into its
   * own window of a painted cabinet (windows may differ in size); otherwise reels share one grid.
   */
  const GIANT_W = 1.1; // giant art is slightly wider than a cell (neighbours have padding)
  const partOf = (tok) => {
    if (typeof tok !== 'string') return null;
    const i = tok.indexOf('~');
    return i < 0 ? null : { sym: tok.slice(0, i), k: Number(tok.slice(i + 1)) };
  };

  class GiantReelView extends ReelView {
    constructor(canvas, art, cfg, matrix, giants = []) {
      super(canvas, art, cfg, matrix);
      this.heights = cfg.reel_heights || Array(this.cols).fill(this.rows);
      this.giantDefs = cfg.giants || {};
      this.giantIds = Object.keys(this.giantDefs);
      this.symbolIds = this.symbolIds.filter((s) => !this.giantDefs[s]);
      this.sticky = []; // { reel, top, height, symbol, multiplier, t0, isNew, leaving }
      this.landFx = []; // { reel, top, height, t0 }
      this.badgePulse = {}; // 'reel,top' -> t0
      this.reels.forEach((reel) => { reel.feed = []; });
      if (matrix) this.setMatrix(matrix, giants);
    }

    /** Encodes a result matrix + giants list into reel tokens. */
    static tokens(matrix, giants) {
      const out = matrix.map((row) => row.slice());
      for (const g of giants || []) {
        for (let k = 0; k < g.height; k++) {
          const r = g.top + k;
          if (r >= 0 && r < out.length) out[r][g.reel] = `${g.symbol}~${k}`;
        }
      }
      return out;
    }

    /** Rows of reel c. */
    reelRows(c) {
      return this.heights[c];
    }

    resize() {
      super.resize();
      const st = this.cfg.theme && this.cfg.theme.stage;
      const heights = this.cfg.reel_heights || Array(this.cols).fill(this.rows);
      this.geos = null;
      if (st && st.reel_rects) {
        // canvas = the stage's reels box (minus pad), scaled: picture px -> canvas px
        const pad = st.pad || 0;
        const k = this.w / (st.reels.w - pad * 2);
        this.geos = st.reel_rects.map((r, c) => ({ x: (r.x - st.reels.x - pad) * k, w: r.w * k, top: (r.y - st.reels.y - pad) * k, ch: (r.h * k) / heights[c] }));
        this.cell = Math.min(...this.geos.map((g) => Math.min(g.w, g.ch)));
        this.art.setSize(this.cell * this.dpr);
      }
    }

    /** Geometry of reel c on the canvas: left x, width, top y, row height. */
    geo(c) {
      if (this.geos) return this.geos[c];
      return { x: c * this.cw, w: this.cw, top: ((this.rows - this.heights[c]) * this.ch) / 2, ch: this.ch };
    }

    /** A symbol centred in a cell of reel geometry G whose top edge is at y. */
    drawSpriteAt(sym, G, y, scale = 1, alpha = 1) {
      if (!sym) return;
      const s = this.cell * scale;
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(this.art.get(sym), G.x + (G.w - s) / 2, y + (G.ch - s) / 2, s, s);
      this.ctx.globalAlpha = 1;
    }

    drawRaysAt(G, y, color) {
      const ctx = this.ctx;
      const R = this.cell * 0.62;
      ctx.save();
      ctx.translate(G.x + G.w / 2, y + G.ch / 2);
      ctx.rotate(this.time * 0.8);
      ctx.fillStyle = window.SlotColor.rgba(color, 0.35);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(R, -R * 0.12);
        ctx.lineTo(R, R * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    /** Height of a giant symbol on reel c ('reel' giants fill the reel). */
    giantH(sym, c) {
      const d = this.giantDefs[sym];
      if (!d) return 1;
      return d.height === 'reel' ? this.heights[c] : d.height;
    }

    cellPos(r, c) {
      const reel = this.reels[c];
      if (r >= this.heights[c]) return null;
      if (reel.state !== 'idle' && reel.state !== 'bounce') return null;
      const G = this.geo(c);
      return { x: G.x, y: G.top + r * G.ch + this.bounceY(reel), w: G.w, h: G.ch };
    }

    visible(c) {
      return this.reels[c].syms.slice(1, this.heights[c] + 1);
    }

    setMatrix(matrix, giants) {
      const tok = GiantReelView.tokens(matrix, giants);
      this.reels.forEach((reel, c) => {
        const col = tok.map((row) => row[c]).slice(0, this.heights[c]);
        reel.syms = [this.bufferAbove(col[0]), ...col];
        reel.feed = [];
      });
      this.giants = giants || [];
    }

    bufferAbove(topTok) {
      const p = partOf(topTok);
      return p && p.k > 0 ? `${p.sym}~${p.k - 1}` : this.randomSymbol();
    }

    feedSymbol(reel, c) {
      if (reel.feed.length) return reel.feed.shift();
      if (this.giantIds.length && Math.random() < 0.075) {
        const pool = this.giantIds.filter((id) => !(c === 0 && this.cfg.symbols[id] && this.cfg.symbols[id].isWild));
        if (pool.length) {
          const id = pool[(Math.random() * pool.length) | 0];
          const h = this.giantH(id, c);
          for (let k = h - 1; k >= 0; k--) reel.feed.push(`${id}~${k}`);
          return reel.feed.shift();
        }
      }
      return this.randomSymbol();
    }

    stopReel(c, finalCol) {
      const reel = this.reels[c];
      return new Promise((resolve) => {
        const q = reel.feed.splice(0); // finish a giant that is half way in
        for (let r = this.heights[c] - 1; r >= 0; r--) q.push(finalCol[r]);
        q.push(this.bufferAbove(finalCol[0]));
        reel.queue = q;
        reel.onStop = resolve;
        if (reel.state === 'windup' || reel.speed < this.maxSpeed * 0.6) reel.speed = this.maxSpeed;
        reel.state = 'stopping';
      });
    }

    startSpin(quick) {
      super.startSpin(quick);
      this.giants = [];
      this.landFx = [];
    }

    // ----------------------------------------------------------- giants on screen
    giantAt(r, c) {
      for (const g of this.sticky) if (g.reel === c && r >= g.top && r < g.top + g.height) return g;
      for (const g of this.giants || []) if (g.reel === c && r >= g.top && r < g.top + g.height) return g;
      return null;
    }

    giantLanded(g) {
      this.landFx.push({ ...g, t0: this.time });
      const G = this.geo(g.reel);
      const p = { x: G.x, y: G.top + clamp(g.top + g.height - 0.5, 0, this.heights[g.reel] - 0.5) * G.ch };
      for (let i = 0; i < 18; i++) {
        const a = Math.PI + Math.random() * Math.PI;
        const sp = this.cell * (1 + Math.random() * 2.5);
        this.particles.push({ x: p.x + G.w * Math.random(), y: p.y + G.ch * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, t: 0, r: this.cell * (0.02 + Math.random() * 0.03), color: i % 2 ? '#ffe3a3' : '#ff9ccc' });
      }
    }

    /** Plays the lock-in animation of a new sticky giant; resolves when done. */
    multValues(sym) {
      const fs = this.cfg.free_spins || {};
      const by = fs.sticky_multipliers_by_symbol;
      return (by && by[sym]) || fs.sticky_multipliers || [];
    }

    static multTier(m) {
      if (m >= 100) return { c0: '#fff0b0', c1: '#ff4a1c', c2: '#6e0a00', glow: '#ff5a1f', big: true };
      if (m >= 25) return { c0: '#f3d4ff', c1: '#9b3df0', c2: '#35055e', glow: '#b45cff', big: true };
      if (m >= 5) return { c0: '#ffd1ea', c1: '#e8388a', c2: '#7a0f45', glow: '#ff4fa8' };
      return { c0: '#fff4c9', c1: '#e8a93a', c2: '#7a4a0a', glow: '#ffc34a' };
    }

    lockSticky(g, quick = false) {
      const big = g.multiplier >= 25;
      const st = { reel: g.reel, top: g.top, height: g.height, symbol: g.symbol, multiplier: g.multiplier, t0: this.time, isNew: true, quick, rollDur: quick ? 0.45 : (big ? 1.9 : 1.0) };
      this.sticky = this.sticky.filter((s) => !(s.reel === g.reel && s.top === g.top));
      this.sticky.push(st);
      const G = this.geo(g.reel);
      const cx = G.x + G.w / 2;
      const cy = G.top + (g.top + g.height / 2) * G.ch;
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * TAU;
        const sp = this.cell * (1.5 + Math.random() * 4);
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.cell, life: 0.8 + Math.random() * 0.6, t: 0, r: this.cell * (0.02 + Math.random() * 0.05), color: ['#ffd76a', '#ff6fae', '#ffffff', '#ffb3d9'][i % 4] });
      }
      return new Promise((resolve) => setTimeout(resolve, (st.rollDur + (quick ? 0.25 : 0.6)) * 1000));
    }

    setSticky(list) {
      this.sticky = (list || []).map((g) => ({ ...g, t0: this.time - 10, isNew: false }));
    }

    clearSticky() {
      this.sticky.forEach((g) => { g.leaving = this.time; });
      setTimeout(() => { this.sticky = this.sticky.filter((g) => !g.leaving); }, 700);
    }

    pulseMultipliers(list) {
      for (const m of list || []) this.badgePulse[`${m.reel},${m.top}`] = this.time;
    }

    // ----------------------------------------------------------- drawing
    /** Giant box: full height of its rows; width follows the art's aspect (max GIANT_W of a column). */
    giantSize(height, scale = 1, sym = null, reel = 0) {
      const G = this.geo(reel);
      const gh = G.ch * (height - 0.04);
      const fill = sym && this.giantDefs[sym] && this.giantDefs[sym].height === 'reel';
      const aspect = (sym && this.art.tallAspect(sym)) || 0.4;
      const gw = fill ? G.w * 0.98 : Math.min(G.w * GIANT_W, gh * aspect * 1.06); // reel giants: full column
      return { gw: gw * scale, gh: gh * scale };
    }

    giantRect(reel, top, height, scale = 1, sym = null) {
      const g = sym ? null : (this.sticky.find((s) => s.reel === reel && s.top === top) || (this.giants || []).find((s) => s.reel === reel && s.top === top));
      const { gw, gh } = this.giantSize(height, scale, sym || (g && g.symbol), reel);
      const G = this.geo(reel);
      const cx = clamp(G.x + G.w / 2, gw / 2, this.w - gw / 2); // keep edge reels inside the canvas
      const cy = G.top + (top + height / 2) * G.ch;
      return { x: cx - gw / 2, y: cy - gh / 2, w: gw, h: gh, cx, cy };
    }

    /** Giant of `height` rows on reel c, its top edge at topY. */
    drawGiant(sym, c, topY, height, scale = 1, alpha = 1) {
      const G = this.geo(c);
      const { gw, gh } = this.giantSize(height, scale, sym, c);
      const img = this.art.getTall(sym, gw * this.dpr, gh * this.dpr);
      const cx = clamp(G.x + G.w / 2, gw / 2, this.w - gw / 2);
      const cy = topY + (height * G.ch) / 2;
      const ctx = this.ctx;
      ctx.globalAlpha = alpha;
      if (img) ctx.drawImage(img, cx - gw / 2, cy - gh / 2, gw, gh);
      else for (let k = 0; k < height; k++) this.drawSpriteAt(sym, G, topY + k * G.ch, scale, alpha);
      ctx.globalAlpha = 1;
    }

    giantScale(g) {
      let s = 1;
      for (let k = 0; k < g.height; k++) {
        const r = g.top + k;
        if (r >= 0 && r < this.heights[g.reel] && this.highlight && this.highlight.set.has(key(r, g.reel))) {
          s = this.winScale(r, g.reel) * 0.98 + 0.02;
          break;
        }
      }
      const fx = this.landFx.find((f) => f.reel === g.reel && f.top === g.top);
      if (fx) {
        const t = this.time - fx.t0;
        if (t < 0.35) s *= 1 + Math.sin((t / 0.35) * Math.PI) * 0.06;
      }
      return s;
    }

    drawCells() {
      const ctx = this.ctx;
      for (let c = 0; c < this.cols; c++) {
        const reel = this.reels[c];
        const G = this.geo(c);
        const x = G.x;
        const moving = reel.state === 'spin' || reel.state === 'stopping' || reel.state === 'windup';
        const by = this.bounceY(reel);
        const top = G.top;
        const rowsC = this.heights[c];
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - G.w * 0.06, top, G.w * 1.12, rowsC * G.ch);
        // sticky giants cover their rows: cut them out of the spinning reel
        for (const g of this.sticky) if (g.reel === c && !g.leaving) ctx.rect(x - G.w * 0.06, top + g.top * G.ch, G.w * 1.12, g.height * G.ch);
        ctx.clip('evenodd');
        if (this.anticipation.has(c)) {
          const gr = ctx.createLinearGradient(x, 0, x + G.w, 0);
          const a = 0.25 + 0.2 * Math.sin(this.time * 12);
          gr.addColorStop(0, 'rgba(255,215,90,0)');
          gr.addColorStop(0.5, `rgba(255,215,90,${a})`);
          gr.addColorStop(1, 'rgba(255,215,90,0)');
          ctx.fillStyle = gr;
          ctx.fillRect(x, top, G.w, rowsC * G.ch);
        }
        const drawn = new Set();
        const giantsToDraw = [];
        for (let i = 0; i <= rowsC; i++) {
          const tok = reel.syms[i];
          const y = top + (i - 1 + reel.offset) * G.ch + by;
          const p = partOf(tok);
          if (p) {
            const topY = y - p.k * G.ch;
            const id = `${p.sym}@${Math.round(topY)}`;
            if (!drawn.has(id)) {
              drawn.add(id);
              giantsToDraw.push({ sym: p.sym, topY, row: i - 1 - p.k });
            }
            continue;
          }
          if (!moving && tok === 'SCATTER') this.drawRaysAt(G, y, (this.cfg.symbols.SCATTER || {}).color || '#ffd76a');
          if (moving && reel.speed > 8) {
            this.drawSpriteAt(tok, G, y - G.ch * 0.16, 0.96, 0.25);
            this.drawSpriteAt(tok, G, y - G.ch * 0.08, 0.96, 0.45);
            this.drawSpriteAt(tok, G, y, 0.96, 0.8);
          } else {
            const r = i - 1;
            const sc = r >= 0 ? this.popScale(r, c) * this.winScale(r, c) : 1;
            this.drawSpriteAt(tok, G, y, sc);
          }
        }
        // giants on top of the normal symbols of their reel
        for (const gd of giantsToDraw) {
          const h = this.giantH(gd.sym, c);
          if (moving && reel.speed > 8) {
            this.drawGiant(gd.sym, c, gd.topY - G.ch * 0.12, h, 1, 0.35);
            this.drawGiant(gd.sym, c, gd.topY, h, 1, 0.9);
          } else {
            const g = (this.giants || []).find((gg) => gg.reel === c && gg.top === gd.row) || { reel: c, top: gd.row, height: h };
            const sc = moving ? 1 : this.giantScale(g);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = this.cell * 0.12;
            this.drawGiant(gd.sym, c, gd.topY, h, sc);
            ctx.restore();
          }
        }
        ctx.restore();
      }
    }

    drawStickies() {
      const ctx = this.ctx;
      for (const g of this.sticky) {
        const age = this.time - g.t0;
        const leave = g.leaving ? clamp((this.time - g.leaving) / 0.6, 0, 1) : 0;
        const intro = g.isNew ? clamp(age / (g.quick ? 0.45 : 0.9), 0, 1) : 1;
        let scale = g.isNew && intro < 1 ? 1 + 0.18 * Math.sin(intro * Math.PI) : 1;
        scale *= 1 - leave * 0.25;
        const hl = this.highlight && [...Array(g.height).keys()].some((k) => this.highlight.set.has(key(g.top + k, g.reel)));
        if (hl) scale *= 1 + 0.05 * Math.abs(Math.sin((this.time - this.highlight.t0) * 5.5));
        const R = this.giantRect(g.reel, g.top, g.height, scale, g.symbol);
        const pulse = 0.55 + 0.45 * Math.sin(this.time * 3 + g.reel);
        const accent = this.cfg.symbols[g.symbol] && this.cfg.symbols[g.symbol].isWild ? '#8fb8ff' : '#ff6fae';

        ctx.save();
        ctx.globalAlpha = 1 - leave;
        // aura
        ctx.shadowColor = accent;
        ctx.shadowBlur = this.cell * (0.25 + 0.2 * pulse);
        ctx.fillStyle = 'rgba(40,0,20,0.9)';
        ctx.beginPath();
        ctx.roundRect(R.x + 2, R.y + 2, R.w - 4, R.h - 4, this.cell * 0.08);
        ctx.fill();
        ctx.shadowBlur = 0;
        this.drawGiant(g.symbol, g.reel, R.cy - (g.height * this.geo(g.reel).ch) / 2, g.height, scale, 1 - leave);

        // shimmer sweep across the portrait
        const sweepT = ((this.time + g.reel * 0.37) % 3.2) / 1.1;
        if (sweepT < 1) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(R.x, R.y, R.w, R.h, this.cell * 0.08);
          ctx.clip();
          const sx = R.x - R.w + sweepT * R.w * 3;
          const gr = ctx.createLinearGradient(sx, R.y, sx + R.w * 0.8, R.y + R.w * 0.8);
          gr.addColorStop(0, 'rgba(255,255,255,0)');
          gr.addColorStop(0.5, 'rgba(255,255,255,0.28)');
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = gr;
          ctx.fillRect(R.x, R.y, R.w, R.h);
          ctx.restore();
        }
        // glowing frame
        ctx.lineWidth = Math.max(2, this.cell * 0.035);
        const fg = ctx.createLinearGradient(R.x, R.y, R.x, R.y + R.h);
        fg.addColorStop(0, '#fff3c4');
        fg.addColorStop(0.5, '#e8b04a');
        fg.addColorStop(1, '#fff3c4');
        ctx.strokeStyle = fg;
        ctx.shadowColor = accent;
        ctx.shadowBlur = this.cell * 0.2 * pulse;
        ctx.beginPath();
        ctx.roundRect(R.x, R.y, R.w, R.h, this.cell * 0.08);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // white flash when it locks
        if (g.isNew && age < 0.5) {
          ctx.globalAlpha = (1 - age / 0.5) * 0.85 * (1 - leave);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.roundRect(R.x, R.y, R.w, R.h, this.cell * 0.08);
          ctx.fill();
          ctx.globalAlpha = 1 - leave;
        }

        // multiplier medallion
        if (this.multValues(g.symbol).length) this.drawMultBadge(g, R, age, leave);
        if (this.highlight && this.highlight.dim && !hl) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.roundRect(R.x, R.y, R.w, R.h, this.cell * 0.08);
          ctx.fill();
        }
        ctx.restore();

        // rising sparkles
        if (!g.leaving && Math.random() < 0.25) {
          this.particles.push({ x: R.x + Math.random() * R.w, y: R.y + R.h * (0.3 + Math.random() * 0.7), vx: (Math.random() - 0.5) * this.cell * 0.3, vy: -this.cell * (1.6 + Math.random()), life: 0.7 + Math.random() * 0.5, t: 0, r: this.cell * (0.012 + Math.random() * 0.02), color: Math.random() < 0.5 ? '#ffe7a8' : '#ffc2e0', float: true });
        }
      }
    }

    drawMultBadge(g, R, age, leave) {
      const ctx = this.ctx;
      const values = this.multValues(g.symbol);
      const spinDur = g.isNew ? (g.rollDur || 0.85) : 0;
      let shown = g.multiplier;
      let flip = 1;
      if (age < spinDur) {
        // roulette through the possible multipliers, slowing down, then land on the real one
        const k = age / spinDur;
        const steps = Math.floor(spinDur * 22 * (k - k * k * 0.45));
        shown = values[(steps + g.reel * 3) % values.length];
        flip = 0.85 + 0.15 * Math.abs(Math.cos(steps * Math.PI / 2));
      } else if (g.isNew && age < spinDur + 0.4) {
        const t = (age - spinDur) / 0.4;
        flip = 1 + Math.sin(t * Math.PI) * (g.multiplier >= 25 ? 0.8 : 0.45);
        if (!g.revealed) {
          g.revealed = true;
          this.revealBurst(g, R);
        }
      }
      const pulseT = this.badgePulse[`${g.reel},${g.top}`];
      if (pulseT !== undefined) {
        const t = this.time - pulseT;
        if (t < 0.6) flip *= 1 + Math.sin((t / 0.6) * Math.PI) * 0.4;
        else delete this.badgePulse[`${g.reel},${g.top}`];
      }
      const text = `x${shown}`;
      const tier = GiantReelView.multTier(shown);
      const r = this.cell * (text.length > 3 ? 0.31 : 0.27);
      const x = R.cx;
      const by = (this.cfg.symbols[g.symbol] || {}).badge_y; // art can say where its medallion is (0..1 of the height)
      const G = this.geo(g.reel);
      const bottom = G.top + this.heights[g.reel] * G.ch;
      const y = Math.min(by ? R.y + R.h * by : R.y + R.h - r * 0.55, bottom - r * 1.12, this.h - r * 1.12); // stay inside the reel
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip * (1 - leave * 0.5), flip * (1 - leave * 0.5));
      // flame ring for the big ones
      if (tier.big && age >= spinDur) {
        ctx.save();
        ctx.rotate(this.time * 2);
        ctx.fillStyle = window.SlotColor.rgba(tier.glow, 0.35 + 0.2 * Math.sin(this.time * 9));
        for (let i = 0; i < 10; i++) {
          ctx.rotate(TAU / 10);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.9);
          ctx.lineTo(r * 0.28, -r * 1.55);
          ctx.lineTo(-r * 0.28, -r * 1.55);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      const disc = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
      disc.addColorStop(0, tier.c0);
      disc.addColorStop(0.55, tier.c1);
      disc.addColorStop(1, tier.c2);
      ctx.shadowColor = tier.glow;
      ctx.shadowBlur = this.cell * (tier.big ? 0.45 : 0.25);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = r * 0.14;
      ctx.strokeStyle = '#fff6d8';
      ctx.stroke();
      const fs = r * (text.length >= 4 ? 0.62 : text.length === 3 ? 0.78 : 0.95);
      ctx.font = `400 ${fs}px "Bungee", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = fs * 0.2;
      ctx.strokeStyle = 'rgba(40,0,20,0.9)';
      ctx.strokeText(text, 0, r * 0.06);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, 0, r * 0.06);
      ctx.restore();
    }

    revealBurst(g, R) {
      const tier = GiantReelView.multTier(g.multiplier);
      const n = tier.big ? 70 : 24;
      const cx = R.cx;
      const cy = R.y + R.h - this.cell * 0.2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = this.cell * (1 + Math.random() * (tier.big ? 5 : 3));
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.cell * 0.8, life: 0.6 + Math.random() * 0.7, t: 0, r: this.cell * (0.02 + Math.random() * 0.05), color: [tier.c0, tier.c1, '#ffffff'][i % 3] });
      }
      if (this.onReveal) this.onReveal(g);
    }

    drawLandFx() {
      const ctx = this.ctx;
      this.landFx = this.landFx.filter((f) => this.time - f.t0 < 0.7);
      for (const f of this.landFx) {
        const t = (this.time - f.t0) / 0.7;
        const R = this.giantRect(f.reel, f.top, f.height, 1 + t * 0.12, f.symbol);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.lineWidth = this.cell * 0.05 * (1 - t) + 1;
        ctx.strokeStyle = '#ffe3a3';
        ctx.shadowColor = '#ff6fae';
        ctx.shadowBlur = this.cell * 0.3;
        ctx.beginPath();
        ctx.roundRect(R.x, R.y, R.w, R.h, this.cell * 0.1);
        ctx.stroke();
        ctx.restore();
      }
    }

    // giants get one tall frame instead of three square ones
    drawHighlightFrames() {
      if (!this.highlight) return;
      const ctx = this.ctx;
      const t = this.time - this.highlight.t0;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 5.5));
      const done = new Set();
      ctx.save();
      ctx.lineWidth = Math.max(2, this.cell * 0.035);
      ctx.strokeStyle = window.SlotColor.rgba(this.accent, pulse);
      ctx.shadowColor = this.accent;
      ctx.shadowBlur = this.cell * 0.15;
      for (const k of this.highlight.set) {
        const [r, c] = k.split(',').map(Number);
        const g = this.giantAt(r, c);
        if (g) {
          const gk = `${g.reel},${g.top}`;
          if (done.has(gk) || this.sticky.includes(g)) continue; // sticky giants have their own frame
          done.add(gk);
          if (this.reels[c].state !== 'idle' && this.reels[c].state !== 'bounce') continue;
          const R = this.giantRect(g.reel, g.top, g.height, 1.02, g.symbol);
          ctx.beginPath();
          ctx.roundRect(R.x, R.y, R.w, R.h, this.cell * 0.1);
          ctx.stroke();
          continue;
        }
        const p = this.cellPos(r, c);
        if (!p) continue;
        ctx.beginPath();
        ctx.roundRect(p.x + (p.w - this.cell * 0.9) / 2, p.y + (p.h - this.cell * 0.9) / 2, this.cell * 0.9, this.cell * 0.9, this.cell * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    }

    updateParticles(dt) {
      this.particles = this.particles.filter((p) => (p.t += dt) < p.life);
      for (const p of this.particles) {
        if (!p.float) p.vy += this.cell * 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      this.drawCells();
      this.drawDim();
      this.drawStickies();
      this.drawLandFx();
      this.drawHighlightFrames();
      this.drawLine();
      this.drawBadges();
      this.drawParticles();
      this.drawFloaters();
    }
  }

  SlotKit.views.GiantReelView = GiantReelView;
})();
