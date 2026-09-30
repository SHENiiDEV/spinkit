/**
 * MegawaysView — cascading columns of different heights.
 * Registered on SlotKit.views; see docs/ARCHITECTURE.md (client).
 */
(function () {
  const { TAU, clamp, key } = SlotKit.util;
  const { TumbleView } = SlotKit.views;

  // ================================================================ MEGAWAYS
  /**
   * Cascading reels with a different number of rows on every reel (mechanic 'megaways').
   * Works on columns: cols[c] = symbols top -> bottom, length = that reel's height.
   */
  class MegawaysView extends TumbleView {
    constructor(canvas, art, cfg, cols) {
      super(canvas, art, cfg, null);
      this.setColumns(cols || this.randomColumns());
    }

    randomColumns() {
      return Array.from({ length: this.cols }, (_, c) => Array.from({ length: 3 + ((c * 2 + 1) % 4) }, () => this.randomSymbol()));
    }

    setColumns(cols) {
      this.heights = cols.map((col) => col.length);
      this.cells = cols.map((col) => col.map((sym, r) => this.makeCell(sym, r)));
    }

    colH(c) {
      return this.h / (this.heights[c] || this.rows);
    }

    /** Box of a cell: position and size in canvas pixels. */
    box(r, c) {
      const cell = this.cells[c] && this.cells[c][r];
      if (!cell) return null;
      const h = this.colH(c);
      return { x: c * this.cw, y: cell.y * h, w: this.cw, h, s: Math.min(this.cw, h) };
    }

    cellPos(r, c) {
      const b = this.box(r, c);
      return b ? { x: b.x, y: b.y } : null;
    }

    drawIn(sym, x, y, w, h, scale = 1, alpha = 1) {
      if (!sym) return;
      const img = this.art.get(sym);
      const s = Math.min(w, h) * scale;
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(img, x + (w - s) / 2, y + (h - s) / 2, s, s);
      this.ctx.globalAlpha = 1;
    }

    centroid(positions) {
      let x = 0;
      let y = 0;
      let n = 0;
      for (const [r, c] of positions) {
        const b = this.box(r, c);
        if (!b) continue;
        x += b.x + b.w / 2;
        y += b.y + b.h / 2;
        n++;
      }
      return n ? [x / n, y / n] : [this.w / 2, this.h / 2];
    }

    burst(r, c, color, n = 14) {
      const b = this.box(r, c);
      if (!b) return;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = b.s * (1.5 + Math.random() * 3.5);
        this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - b.s, life: 0.6 + Math.random() * 0.4, t: 0, r: b.s * (0.03 + Math.random() * 0.05), color });
      }
    }

    drawDim() {
      if (!this.highlight || !this.highlight.dim) return;
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.cells.forEach((col, c) => col.forEach((_, r) => {
        if (this.highlight.set.has(key(r, c))) return;
        const b = this.box(r, c);
        if (b) this.ctx.fillRect(b.x, b.y, b.w, b.h);
      }));
    }

    drawHighlightFrames() {
      if (!this.highlight) return;
      const ctx = this.ctx;
      const t = this.time - this.highlight.t0;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 5.5));
      ctx.save();
      ctx.strokeStyle = window.SlotColor.rgba(this.accent, pulse);
      ctx.shadowColor = this.accent;
      for (const k of this.highlight.set) {
        const [r, c] = k.split(',').map(Number);
        const b = this.box(r, c);
        if (!b) continue;
        const f = b.s * 0.9;
        ctx.lineWidth = Math.max(2, b.s * 0.04);
        ctx.shadowBlur = b.s * 0.15;
        ctx.beginPath();
        ctx.roundRect(b.x + (b.w - f) / 2, b.y + (b.h - f) / 2, f, f, f * 0.14);
        ctx.stroke();
      }
      ctx.restore();
    }

    dropOut(quick) {
      this.clearWin();
      return new Promise((resolve) => {
        this.outgoing = [];
        this.cells.forEach((col, c) => {
          const h = this.colH(c);
          col.forEach((cell, r) => this.outgoing.push({ ...cell, c, h, vy: 0, delay: (quick ? 0.015 : 0.04) * c + (col.length - 1 - r) * 0.012, target: 20, state: 'fall' }));
        });
        this.cells = this.cells.map(() => []);
        setTimeout(resolve, quick ? 260 : 460);
      });
    }

    dropIn(cols, quick, onColumnLand) {
      this.outgoing = [];
      this.heights = cols.map((col) => col.length);
      return new Promise((resolve) => {
        let pending = 0;
        this.cells = cols.map((colSyms, c) => colSyms.map((sym, r) => {
          const cell = this.makeCell(sym, r);
          cell.y = r - colSyms.length - 0.5;
          cell.state = 'fall';
          cell.delay = (quick ? 0.03 : 0.085) * c + (colSyms.length - 1 - r) * 0.02;
          cell.onLand = r === colSyms.length - 1 ? () => onColumnLand && onColumnLand(c) : null;
          pending++;
          cell.done = () => { if (--pending === 0) resolve(); };
          return cell;
        }));
        if (!pending) resolve();
      });
    }

    collapse(nextCols, removed) {
      this.highlight = null;
      return new Promise((resolve) => {
        const removedSet = new Set(removed.map(([r, c]) => key(r, c)));
        let pending = 0;
        this.cells = this.cells.map((col, c) => {
          const next = nextCols[c];
          const survivors = col.filter((_, r) => !removedSet.has(key(r, c)));
          const nNew = next.length - survivors.length;
          const out = [];
          for (let i = 0; i < nNew; i++) {
            const cell = this.makeCell(next[i], i);
            cell.y = i - nNew - 0.3;
            cell.state = 'fall';
            cell.delay = 0.03 * c;
            out.push(cell);
          }
          survivors.forEach((cell, i) => {
            const r = nNew + i;
            cell.target = r;
            cell.sym = next[r];
            if (cell.y < r) {
              cell.state = 'fall';
              cell.vy = 0;
              cell.delay = 0.03 * c;
              cell.bounces = 0;
            }
            out.push(cell);
          });
          out.forEach((cell) => {
            if (cell.state === 'fall') {
              pending++;
              cell.done = () => { if (--pending === 0) resolve(); };
            }
          });
          return out;
        });
        if (!pending) resolve();
      });
    }

    drawCells() {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.w, this.h);
      ctx.clip();
      // reel separators + height tags
      for (let c = 1; c < this.cols; c++) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(c * this.cw - 1, 0, 2, this.h);
      }
      if (this.outgoing) {
        for (const cell of this.outgoing) this.drawIn(cell.sym, cell.c * this.cw, cell.y * cell.h, this.cw, cell.h, 0.94);
      }
      // cell tiles show how tall every reel is on this spin
      this.heights.forEach((n, c) => {
        const h = this.colH(c);
        for (let r = 0; r < n; r++) {
          ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.085)';
          ctx.beginPath();
          ctx.roundRect(c * this.cw + 3, r * h + 3, this.cw - 6, h - 6, Math.min(this.cw, h) * 0.12);
          ctx.fill();
        }
      });
      this.cells.forEach((col, c) => {
        const h = this.colH(c);
        col.forEach((cell, r) => {
          const x = c * this.cw;
          const y = cell.y * h;
          if (cell.state === 'explode') {
            const k = clamp(cell.t / 0.24, 0, 1);
            this.drawIn(cell.sym, x, y, this.cw, h, 1 + k * 0.45, 1 - k);
            return;
          }
          if (cell.sym === 'SCATTER' && cell.state === 'idle') {
            const s = Math.min(this.cw, h);
            ctx.save();
            ctx.translate(x + this.cw / 2, y + h / 2);
            ctx.rotate(this.time * 0.8);
            ctx.fillStyle = window.SlotColor.rgba((this.cfg.symbols.SCATTER || {}).color || '#ffd76a', 0.3);
            for (let i = 0; i < 12; i++) {
              ctx.rotate(TAU / 12);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(s * 0.62, -s * 0.075);
              ctx.lineTo(s * 0.62, s * 0.075);
              ctx.closePath();
              ctx.fill();
            }
            ctx.restore();
          }
          const sc = (cell.state === 'idle' ? this.popScale(r, c) * this.winScale(r, c) : 1) * 0.94;
          this.drawIn(cell.sym, x, y, this.cw, h, sc);
        });
      });
      ctx.restore();
    }
  }

  SlotKit.views.MegawaysView = MegawaysView;
})();
