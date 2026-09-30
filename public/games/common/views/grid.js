/**
 * GridView — shared canvas renderer: layout, sprites, highlights, particles, floaters.
 * Registered on SlotKit.views; see docs/ARCHITECTURE.md (client).
 */
(function () {
  const { TAU, key } = SlotKit.util;

  class GridView {
    constructor(canvas, art, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.art = art;
      this.cfg = cfg;
      this.cols = cfg.reels;
      this.rows = cfg.rows;
      this.symbolIds = Object.keys(cfg.symbols).filter((s) => s !== 'MULT');
      this.highlight = null; // { set:Set, t0 }
      this.lineOverlay = null; // { positions, color }
      this.badges = {}; // 'r,c' -> 'x3'
      this.particles = [];
      this.floaters = [];
      this.pops = {}; // 'r,c' -> start time
      this.anticipation = new Set(); // reel indexes glowing
      this.time = 0;
      this.accent = (cfg.theme && cfg.theme.accent) || '#ffd76a';
      this.resize();
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth || 600;
      // Cells are square unless the canvas is given its own height (stage layouts fill their panel):
      // then cw x ch can differ and `cell` (the symbol size) is the smaller side.
      const fixedH = this.cfg.theme && this.cfg.theme.stage ? this.canvas.clientHeight : 0;
      this.cw = w / this.cols;
      this.ch = fixedH ? fixedH / this.rows : this.cw;
      this.cell = Math.min(this.cw, this.ch);
      this.w = w;
      this.h = this.ch * this.rows;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.art.setSize(this.cell * dpr);
    }

    loop(t) {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.time += dt;
      this.update(dt);
      this.draw();
      requestAnimationFrame((tt) => this.loop(tt));
    }

    randomSymbol() {
      const ids = this.symbolIds;
      let s = ids[(Math.random() * ids.length) | 0];
      if ((s === 'SCATTER' || s === 'WILD') && Math.random() < 0.6) s = ids[(Math.random() * ids.length) | 0];
      return s;
    }

    // ----------------------------------------------------------- drawing helpers
    drawSprite(sym, x, y, scale = 1, alpha = 1) {
      if (!sym) return;
      const ctx = this.ctx;
      const img = this.art.get(sym);
      const s = this.cell * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x + (this.cw - s) / 2, y + (this.ch - s) / 2, s, s);
      ctx.globalAlpha = 1;
    }

    drawRays(x, y, color, alpha = 0.35) {
      const ctx = this.ctx;
      const cx = x + this.cw / 2;
      const cy = y + this.ch / 2;
      const R = this.cell * 0.62;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.time * 0.8);
      ctx.fillStyle = window.SlotColor.rgba(color, alpha);
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

    popScale(r, c) {
      const t0 = this.pops[key(r, c)];
      if (t0 === undefined) return 1;
      const t = this.time - t0;
      if (t > 0.45) {
        delete this.pops[key(r, c)];
        return 1;
      }
      return 1 + Math.sin((t / 0.45) * Math.PI) * 0.25;
    }

    winScale(r, c) {
      if (!this.highlight || !this.highlight.set.has(key(r, c))) return 1;
      const t = this.time - this.highlight.t0;
      return 1 + 0.09 * Math.abs(Math.sin(t * 5.5));
    }

    drawHighlightFrames() {
      if (!this.highlight) return;
      const ctx = this.ctx;
      const t = this.time - this.highlight.t0;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 5.5));
      ctx.save();
      ctx.lineWidth = Math.max(2, this.cell * 0.035);
      ctx.strokeStyle = window.SlotColor.rgba(this.accent, pulse);
      ctx.shadowColor = this.accent;
      ctx.shadowBlur = this.cell * 0.15;
      for (const k of this.highlight.set) {
        const [r, c] = k.split(',').map(Number);
        const p = this.cellPos(r, c);
        if (!p) continue;
        ctx.beginPath();
        ctx.roundRect(p.x + ((p.w || this.cw) - this.cell * 0.9) / 2, p.y + ((p.h || this.ch) - this.cell * 0.9) / 2, this.cell * 0.9, this.cell * 0.9, this.cell * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawDim() {
      if (!this.highlight || !this.highlight.dim) return;
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.highlight.set.has(key(r, c))) continue;
          const p = this.cellPos(r, c);
          if (p) ctx.fillRect(p.x, p.y, p.w || this.cw, p.h || this.ch);
        }
      }
    }

    drawLine() {
      const lo = this.lineOverlay;
      if (!lo) return;
      if (!lo.path) {
        if (lo.label && lo.positions) {
          const [x, y] = this.centroid(lo.positions);
          this.pill(x, y, lo.label);
        }
        return;
      }
      const ctx = this.ctx;
      const pts = lo.path.map(([r, c]) => [c * this.cw + this.cw / 2, r * this.ch + this.ch / 2]);
      // extend to the grid edges like real slot paylines
      const first = [0, pts[0][1]];
      const lastPt = [this.w, pts[pts.length - 1][1]];
      const all = [first, ...pts, lastPt];
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [w, col, blur] of [[this.cell * 0.09, 'rgba(0,0,0,0.6)', 0], [this.cell * 0.05, lo.color, this.cell * 0.2], [this.cell * 0.018, '#ffffff', 0]]) {
        ctx.beginPath();
        all.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.shadowColor = lo.color;
        ctx.shadowBlur = blur;
        ctx.stroke();
      }
      ctx.restore();
      if (lo.label) {
        const mid = pts[Math.min(pts.length - 1, Math.floor((lo.count || pts.length) / 2))];
        this.pill(mid[0], mid[1], lo.label);
      }
    }

    drawBadges() {
      const ctx = this.ctx;
      for (const [k, text] of Object.entries(this.badges)) {
        const [r, c] = k.split(',').map(Number);
        const p = this.cellPos(r, c);
        if (!p) continue;
        const x = p.x + (p.w || this.cw) / 2 + this.cell * 0.28;
        const y = p.y + (p.h || this.ch) / 2 - this.cell * 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, this.cell * 0.17, 0, TAU);
        ctx.fillStyle = '#ff2b55';
        ctx.shadowColor = '#ff2b55';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${this.cell * 0.17}px "Roboto Condensed", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 1);
        ctx.restore();
      }
    }

    pill(x, y, text, scale = 1) {
      const ctx = this.ctx;
      const fs = Math.max(12, this.cell * 0.2) * scale;
      ctx.save();
      ctx.font = `400 ${fs}px "Bungee", sans-serif`;
      const w = ctx.measureText(text).width + fs * 1.2;
      const h = fs * 1.6;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.accent;
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, x, y + fs * 0.06);
      ctx.restore();
    }

    centroid(positions) {
      let x = 0;
      let y = 0;
      let n = 0;
      for (const [r, c] of positions) {
        const p = this.cellPos(r, c);
        if (!p) continue;
        x += p.x + (p.w || this.cw) / 2;
        y += p.y + (p.h || this.ch) / 2;
        n++;
      }
      return n ? [x / n, y / n] : [this.w / 2, this.h / 2];
    }

    addFloater(positions, text) {
      const [x, y] = this.centroid(positions);
      this.floaters.push({ x, y, text, t0: this.time });
    }

    drawFloaters() {
      this.floaters = this.floaters.filter((f) => this.time - f.t0 < 1.5);
      for (const f of this.floaters) {
        const t = this.time - f.t0;
        const k = Math.min(1, t / 0.18);
        this.ctx.globalAlpha = t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.4) : 1;
        this.pill(f.x, f.y - t * this.cell * 0.25, f.text, (0.6 + 0.5 * k) * (f.scale || 1));
        this.ctx.globalAlpha = 1;
      }
    }

    burst(r, c, color, n = 14) {
      const p = this.cellPos(r, c);
      if (!p) return;
      const cx = p.x + (p.w || this.cw) / 2;
      const cy = p.y + (p.h || this.ch) / 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = this.cell * (1.5 + Math.random() * 3.5);
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - this.cell, life: 0.6 + Math.random() * 0.4, t: 0, r: this.cell * (0.03 + Math.random() * 0.05), color });
      }
    }

    updateParticles(dt) {
      this.particles = this.particles.filter((p) => (p.t += dt) < p.life);
      for (const p of this.particles) {
        p.vy += this.cell * 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    drawParticles() {
      const ctx = this.ctx;
      for (const p of this.particles) {
        ctx.globalAlpha = 1 - p.t / p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    setHighlight(positions, { dim = true } = {}) {
      if (!positions || !positions.length) {
        this.highlight = null;
        return;
      }
      this.highlight = { set: new Set(positions.map(([r, c]) => key(r, c))), t0: this.time, dim };
    }

    clearWin() {
      this.highlight = null;
      this.lineOverlay = null;
      this.floaters = [];
    }

    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      this.drawCells();
      this.drawDim();
      this.drawHighlightFrames();
      this.drawLine();
      this.drawBadges();
      this.drawParticles();
      this.drawFloaters();
    }
  }

  SlotKit.views.GridView = GridView;
})();
