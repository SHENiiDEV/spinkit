/**
 * ReelView — spinning reel strips (lines, ways, hold & win base game).
 * Registered on SlotKit.views; see docs/ARCHITECTURE.md (client).
 */
(function () {
  const { clamp } = SlotKit.util;
  const { GridView } = SlotKit.views;

  // ================================================================ REELS
  class ReelView extends GridView {
    constructor(canvas, art, cfg, matrix) {
      super(canvas, art, cfg);
      this.reels = [];
      for (let c = 0; c < this.cols; c++) {
        const syms = [this.randomSymbol()];
        for (let r = 0; r < this.rows; r++) syms.push(matrix ? matrix[r][c] : this.randomSymbol());
        this.reels.push({ syms, offset: 0, speed: 0, state: 'idle', queue: null, t: 0, bounce: 0, onStop: null });
      }
      this.maxSpeed = 24;
    }

    cellPos(r, c) {
      const reel = this.reels[c];
      if (reel.state !== 'idle' && reel.state !== 'bounce') return null;
      return { x: c * this.cw, y: r * this.ch + this.bounceY(reel) };
    }

    bounceY(reel) {
      if (reel.state !== 'bounce') return 0;
      const t = reel.t;
      return Math.sin(clamp(t / 0.22, 0, 1) * Math.PI) * this.cell * 0.14 * (1 - t / 0.22);
    }

    visible(c) {
      return this.reels[c].syms.slice(1, this.rows + 1);
    }

    /** Next random symbol entering a spinning reel from the top. */
    feedSymbol() {
      return this.randomSymbol();
    }

    startSpin(quick) {
      this.clearWin();
      this.badges = {};
      this.maxSpeed = quick ? 34 : 24;
      this.reels.forEach((reel, c) => {
        reel.state = 'windup';
        reel.t = -c * (quick ? 0.02 : 0.06);
        reel.queue = null;
        reel.speed = 0;
      });
    }

    /** Queue the final column; resolves when the reel has landed. */
    stopReel(c, finalCol) {
      const reel = this.reels[c];
      return new Promise((resolve) => {
        // Symbols enter from the top: feed bottom row first, then one hidden buffer
        const q = [];
        for (let r = this.rows - 1; r >= 0; r--) q.push(finalCol[r]);
        q.push(this.randomSymbol());
        reel.queue = q;
        reel.onStop = resolve;
        if (reel.state === 'windup' || reel.speed < this.maxSpeed * 0.6) reel.speed = this.maxSpeed;
        reel.state = 'stopping';
      });
    }

    update(dt) {
      for (let c = 0; c < this.cols; c++) {
        const reel = this.reels[c];
        if (reel.state === 'windup') {
          reel.t += dt;
          if (reel.t < 0) continue;
          // small upward pull before the spin, like real cabinets
          reel.offset = -Math.sin(clamp(reel.t / 0.14, 0, 1) * Math.PI / 2) * 0.18;
          if (reel.t >= 0.14) {
            reel.state = 'spin';
            reel.speed = 4;
          }
          continue;
        }
        if (reel.state === 'spin' || reel.state === 'stopping') {
          const target = this.anticipation.has(c) ? this.maxSpeed * 1.35 : this.maxSpeed;
          reel.speed += (target - reel.speed) * Math.min(1, dt * 8);
          reel.offset += reel.speed * dt;
          while (reel.offset >= 1) {
            reel.offset -= 1;
            reel.syms.pop();
            if (reel.state === 'stopping' && reel.queue && reel.queue.length) {
              reel.syms.unshift(reel.queue.shift());
              if (!reel.queue.length) {
                reel.offset = 0;
                reel.state = 'bounce';
                reel.t = 0;
                reel.speed = 0;
                const cb = reel.onStop;
                reel.onStop = null;
                if (cb) cb();
                break;
              }
            } else {
              reel.syms.unshift(this.feedSymbol(reel, c));
            }
          }
          continue;
        }
        if (reel.state === 'bounce') {
          reel.t += dt;
          if (reel.t >= 0.22) {
            reel.state = 'idle';
            reel.t = 0;
          }
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
      for (let c = 0; c < this.cols; c++) {
        const reel = this.reels[c];
        const x = c * this.cw;
        const moving = reel.state === 'spin' || reel.state === 'stopping' || reel.state === 'windup';
        const by = this.bounceY(reel);
        if (this.anticipation.has(c)) {
          const g = ctx.createLinearGradient(x, 0, x + this.cw, 0);
          const a = 0.25 + 0.2 * Math.sin(this.time * 12);
          g.addColorStop(0, 'rgba(255,215,90,0)');
          g.addColorStop(0.5, `rgba(255,215,90,${a})`);
          g.addColorStop(1, 'rgba(255,215,90,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x, 0, this.cw, this.h);
        }
        for (let i = 0; i <= this.rows; i++) {
          const sym = reel.syms[i];
          const y = (i - 1 + reel.offset) * this.ch + by;
          if (!moving && sym === 'SCATTER') this.drawRays(x, y, (this.cfg.symbols.SCATTER || {}).color || '#ffd76a');
          if (moving && reel.speed > 8) {
            // motion blur: ghost copies along the travel direction
            this.drawSprite(sym, x, y - this.ch * 0.16, 0.96, 0.25);
            this.drawSprite(sym, x, y - this.ch * 0.08, 0.96, 0.45);
            this.drawSprite(sym, x, y, 0.96, 0.8);
          } else {
            const r = i - 1;
            const s = r >= 0 ? this.popScale(r, c) * this.winScale(r, c) : 1;
            this.drawSprite(sym, x, y, s);
          }
        }
      }
      ctx.restore();
    }
  }

  SlotKit.views.ReelView = ReelView;
})();
