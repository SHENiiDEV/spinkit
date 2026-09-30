/**
 * TumbleView — symbols fall in, explode and cascade (tumble, clusters, match lines).
 * Registered on SlotKit.views; see docs/ARCHITECTURE.md (client).
 */
(function () {
  const { clamp, key } = SlotKit.util;
  const { GridView } = SlotKit.views;

  // ================================================================ TUMBLE
  class TumbleView extends GridView {
    constructor(canvas, art, cfg, matrix) {
      super(canvas, art, cfg);
      this.cells = [];
      for (let c = 0; c < this.cols; c++) {
        const col = [];
        for (let r = 0; r < this.rows; r++) {
          col.push(this.makeCell(matrix ? matrix[r][c] : this.randomSymbol(), r));
        }
        this.cells.push(col);
      }
      this.falling = [];
      this.gravity = 60; // cells / s^2
      this.runLines = []; // winning straight lines (mechanic 'matchlines'): { from, to, color }
      this.spots = {}; // multiplier spots (mechanic 'clusters'): 'r,c' -> 1 (marked) | 2..1024
      this.spotFx = {}; // 'r,c' -> time the spot changed (pop animation)
    }

    // ----------------------------------------------------------- multiplier spots
    static spotTier(v) {
      if (v >= 512) return ['#ff3a1a', '#ffe0a0'];
      if (v >= 128) return ['#b44cff', '#f3d4ff'];
      if (v >= 32) return ['#ff3fa0', '#ffd1ea'];
      if (v >= 8) return ['#ff8a1a', '#ffe6b0'];
      return ['#ffc21a', '#fff4c9'];
    }

    /** Replace all spots; with animate=true every changed spot pops (and upgrades throw sparks). */
    setSpots(map, animate = false) {
      const next = { ...(map || {}) };
      if (animate) {
        for (const [k, v] of Object.entries(next)) {
          if (this.spots[k] === v) continue;
          this.spotFx[k] = this.time;
          if (v >= 2) {
            const [r, c] = k.split(',').map(Number);
            this.burst(r, c, TumbleView.spotTier(v)[0], v >= 32 ? 22 : 12);
          }
        }
      }
      this.spots = next;
    }

    spotScale(k) {
      const t0 = this.spotFx[k];
      if (t0 === undefined) return 1;
      const t = this.time - t0;
      if (t > 0.5) {
        delete this.spotFx[k];
        return 1;
      }
      return 1 + Math.sin((t / 0.5) * Math.PI) * 0.35;
    }

    drawSpotTiles() {
      const ctx = this.ctx;
      for (const [k, v] of Object.entries(this.spots)) {
        const [r, c] = k.split(',').map(Number);
        const sc = this.spotScale(k);
        const w = this.cw * 0.94 * sc;
        const h = this.ch * 0.94 * sc;
        const x = c * this.cw + (this.cw - w) / 2;
        const y = r * this.ch + (this.ch - h) / 2;
        ctx.save();
        if (v === 1) {
          ctx.fillStyle = window.SlotColor.rgba(this.accent, 0.22);
          ctx.strokeStyle = window.SlotColor.rgba('#ffffff', 0.55);
          ctx.lineWidth = Math.max(1.5, this.cell * 0.025);
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, this.cell * 0.16);
          ctx.fill();
          ctx.stroke();
        } else {
          const [c1, c2] = TumbleView.spotTier(v);
          const g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, w * 0.05, x + w / 2, y + h / 2, w * 0.75);
          g.addColorStop(0, c2);
          g.addColorStop(0.5, c1);
          g.addColorStop(1, window.SlotColor.rgba(c1, 0.55));
          ctx.shadowColor = c1;
          ctx.shadowBlur = this.cell * (0.18 + 0.1 * Math.sin(this.time * 4 + r + c));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, this.cell * 0.16);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.lineWidth = Math.max(2, this.cell * 0.035);
          ctx.strokeStyle = '#fff6d8';
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    /** Multiplier labels: small corner badge over a symbol, big number on an empty (exploding) cell. */
    drawSpotLabels() {
      const ctx = this.ctx;
      for (const [k, v] of Object.entries(this.spots)) {
        if (v < 2) continue;
        const [r, c] = k.split(',').map(Number);
        const cell = this.cells[c] && this.cells[c][r];
        const empty = !cell || cell.state === 'explode' || cell.state === 'fall';
        const sc = this.spotScale(k);
        const text = `x${v}`;
        const size = (empty ? this.cell * (text.length > 3 ? 0.24 : 0.3) : this.cell * (text.length > 3 ? 0.17 : 0.21)) * sc;
        const x = empty ? c * this.cw + this.cw / 2 : c * this.cw + this.cw * 0.76;
        const y = empty ? r * this.ch + this.ch / 2 : r * this.ch + this.ch * 0.82;
        ctx.save();
        ctx.font = `400 ${size}px "Bungee", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * 0.28;
        ctx.strokeStyle = 'rgba(40,0,30,0.9)';
        ctx.strokeText(text, x, y);
        ctx.fillStyle = TumbleView.spotTier(v)[1];
        ctx.fillText(text, x, y);
        ctx.restore();
      }
    }

    makeCell(sym, r) {
      return { sym, y: r, vy: 0, target: r, delay: 0, state: 'idle', t: 0, bounces: 0 };
    }

    cellPos(r, c) {
      const cell = this.cells[c] && this.cells[c][r];
      if (!cell) return null;
      return { x: c * this.cw, y: cell.y * this.ch };
    }

    randomSymbol() {
      const ids = this.symbolIds.filter((s) => s !== 'SCATTER');
      return ids[(Math.random() * ids.length) | 0];
    }

    /** Current symbols fall out of the bottom. */
    dropOut(quick) {
      this.clearWin();
      return new Promise((resolve) => {
        this.outgoing = [];
        for (let c = 0; c < this.cols; c++) {
          for (let r = 0; r < this.rows; r++) {
            const cell = this.cells[c][r];
            this.outgoing.push({ ...cell, c, vy: 0, delay: (quick ? 0.015 : 0.04) * c + (this.rows - 1 - r) * 0.012, target: this.rows + 2 + r, state: 'fall' });
          }
          this.cells[c] = [];
        }
        setTimeout(resolve, quick ? 260 : 460);
      });
    }

    /** A brand new grid falls in from above. */
    dropIn(grid, quick, onColumnLand) {
      this.outgoing = [];
      return new Promise((resolve) => {
        let pending = 0;
        for (let c = 0; c < this.cols; c++) {
          const col = [];
          for (let r = 0; r < this.rows; r++) {
            const cell = this.makeCell(grid[r][c], r);
            cell.y = r - this.rows - 0.5;
            cell.state = 'fall';
            cell.delay = (quick ? 0.03 : 0.085) * c + (this.rows - 1 - r) * 0.02;
            cell.onLand = r === this.rows - 1 ? () => onColumnLand && onColumnLand(c) : null;
            pending++;
            cell.done = () => { if (--pending === 0) resolve(); };
            col.push(cell);
          }
          this.cells[c] = col;
        }
      });
    }

    /** Explode the given positions. */
    explode(positions, color) {
      for (const [r, c] of positions) {
        const cell = this.cells[c][r];
        if (!cell) continue;
        cell.state = 'explode';
        cell.t = 0;
        this.burst(r, c, color || this.accent, 10);
      }
      return new Promise((resolve) => setTimeout(resolve, 260));
    }

    /** After an explosion: survivors fall, new symbols drop in to form `nextGrid`. */
    collapse(nextGrid, removed) {
      this.highlight = null;
      return new Promise((resolve) => {
        const removedSet = new Set(removed.map(([r, c]) => key(r, c)));
        let pending = 0;
        for (let c = 0; c < this.cols; c++) {
          const survivors = [];
          for (let r = 0; r < this.rows; r++) if (!removedSet.has(key(r, c))) survivors.push(this.cells[c][r]);
          const nNew = this.rows - survivors.length;
          const col = [];
          for (let i = 0; i < nNew; i++) {
            const cell = this.makeCell(nextGrid[i][c], i);
            cell.y = i - nNew - 0.3;
            cell.state = 'fall';
            cell.delay = 0.03 * c;
            col.push(cell);
          }
          survivors.forEach((cell, i) => {
            const r = nNew + i;
            cell.target = r;
            cell.sym = nextGrid[r][c];
            if (cell.y < r) {
              cell.state = 'fall';
              cell.vy = 0;
              cell.delay = 0.03 * c;
              cell.bounces = 0;
            }
            col.push(cell);
          });
          for (const cell of col) {
            if (cell.state === 'fall') {
              pending++;
              cell.done = () => { if (--pending === 0) resolve(); };
            }
          }
          this.cells[c] = col;
        }
        if (!pending) resolve();
      });
    }

    stepCell(cell, dt) {
      if (cell.state !== 'fall') return;
      if (cell.delay > 0) {
        cell.delay -= dt;
        return;
      }
      cell.vy += this.gravity * dt;
      cell.y += cell.vy * dt;
      if (cell.y >= cell.target) {
        cell.y = cell.target;
        if (cell.bounces < 1 && cell.vy > 6) {
          cell.vy = -cell.vy * 0.18;
          cell.bounces++;
          if (cell.onLand) {
            cell.onLand();
            cell.onLand = null;
          }
        } else {
          cell.vy = 0;
          cell.state = 'idle';
          if (cell.onLand) {
            cell.onLand();
            cell.onLand = null;
          }
          if (cell.done) {
            const d = cell.done;
            cell.done = null;
            d();
          }
        }
      }
    }

    update(dt) {
      for (const col of this.cells) for (const cell of col) {
        this.stepCell(cell, dt);
        if (cell.state === 'explode') cell.t += dt;
      }
      if (this.outgoing) {
        for (const cell of this.outgoing) {
          if (cell.delay > 0) {
            cell.delay -= dt;
            continue;
          }
          cell.vy += this.gravity * dt;
          cell.y += cell.vy * dt;
        }
      }
      this.updateParticles(dt);
    }

    drawCells() {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.w, this.h);
      ctx.clip();
      this.drawSpotTiles();
      if (this.outgoing) {
        for (const cell of this.outgoing) this.drawSprite(cell.sym, cell.c * this.cw, cell.y * this.ch, 0.96);
      }
      for (let c = 0; c < this.cols; c++) {
        const col = this.cells[c];
        for (let r = 0; r < col.length; r++) {
          const cell = col[r];
          const x = c * this.cw;
          const y = cell.y * this.ch;
          if (cell.state === 'explode') {
            const k = clamp(cell.t / 0.24, 0, 1);
            this.drawSprite(cell.sym, x, y, 1 + k * 0.45, 1 - k);
            continue;
          }
          if (cell.sym === 'SCATTER' && cell.state === 'idle') this.drawRays(x, y, (this.cfg.symbols.SCATTER || {}).color || '#ffd76a');
          const isMult = /^M\d+$/.test(cell.sym);
          if (isMult && cell.state === 'idle') this.drawRays(x, y, window.SlotColor.multTierColor(Number(cell.sym.slice(1))), 0.28);
          const s = (cell.state === 'idle' ? this.popScale(r, c) * this.winScale(r, c) : 1) * 0.96;
          this.drawSprite(cell.sym, x, y, s);
        }
      }
      this.drawSpotLabels();
      this.drawRunLines();
      ctx.restore();
    }

    drawRunLines() {
      if (!this.runLines.length) return;
      const ctx = this.ctx;
      const t = this.time;
      ctx.save();
      ctx.lineCap = 'round';
      for (const l of this.runLines) {
        const a = [l.from[1] * this.cw + this.cw / 2, l.from[0] * this.ch + this.ch / 2];
        const b = [l.to[1] * this.cw + this.cw / 2, l.to[0] * this.ch + this.ch / 2];
        const k = Math.min(1, (t - l.t0) / 0.25);
        const bx = a[0] + (b[0] - a[0]) * k;
        const by = a[1] + (b[1] - a[1]) * k;
        for (const [w, col, blur] of [[this.cell * 0.16, 'rgba(0,0,0,0.55)', 0], [this.cell * 0.09, l.color, this.cell * 0.3], [this.cell * 0.03, '#ffffff', 0]]) {
          ctx.lineWidth = w;
          ctx.strokeStyle = col;
          ctx.shadowColor = l.color;
          ctx.shadowBlur = blur;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  SlotKit.views.TumbleView = TumbleView;
})();
