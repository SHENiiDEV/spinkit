/**
 * HoldWinView — reels + the Hold & Win coin bonus.
 * Registered on SlotKit.views; see docs/ARCHITECTURE.md (client).
 */
(function () {
  const { TAU, key } = SlotKit.util;
  const { ReelView } = SlotKit.views;

  // ================================================================ HOLD & WIN
  /**
   * Reels with money coins (mechanic 'holdwin'). In the base game coins show their value;
   * the Hold & Win bonus turns the grid into 15 cells where coins lock and empty cells respin.
   */
  const COIN_STYLE = {
    MINI: ['#7dffb0', '#1a8a4a', 'MINI'],
    MINOR: ['#8ad0ff', '#1a4a9a', 'MINOR'],
    MAJOR: ['#ff9a8a', '#a01a1a', 'MAJOR'],
    COLLECT: ['#e8b0ff', '#6a1aa0', 'COLLECT'],
    BOOST: ['#ffb08a', '#c03a0a', 'x2']
  };

  class HoldWinView extends ReelView {
    constructor(canvas, art, cfg, matrix) {
      super(canvas, art, cfg, matrix);
      this.coins = {}; // base game: 'r,c' -> coin
      this.bonus = null; // { grid, spinning, pops, flash }
      this.fmtCoin = (coin) => `x${coin.v}`;
    }

    startSpin(quick) {
      this.coins = {};
      super.startSpin(quick);
    }

    drawCoin(cx, cy, R, coin, alpha = 1) {
      const ctx = this.ctx;
      const style = coin && (COIN_STYLE[coin.jp] || COIN_STYLE[coin.special]);
      const names = (this.cfg.holdwin && this.cfg.holdwin.jackpot_names) || {};
      const c0 = style ? style[0] : '#fff3b0';
      const c1 = style ? style[1] : '#b07a10';
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = style ? c0 : '#ffd23f';
      ctx.shadowBlur = R * 0.5;
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, c0);
      g.addColorStop(0.8, c1);
      g.addColorStop(1, window.SlotColor.rgba(c1, 1));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = R * 0.1;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.8, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = R * 0.06;
      ctx.strokeStyle = window.SlotColor.rgba(c1, 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, 0, TAU);
      ctx.stroke();
      if (!coin) {
        ctx.fillStyle = 'rgba(120,70,0,0.55)';
        ctx.font = `400 ${R * 0.9}px "Bungee", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + R * 0.05);
      } else {
        const top = style ? (coin.jp && names[coin.jp]) || style[2] : null;
        const val = coin.special === 'BOOST' ? null : this.fmtCoin(coin);
        const line = (text, y, size) => {
          ctx.font = `400 ${size}px "Bungee", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let fs = size;
          while (ctx.measureText(text).width > R * 1.55 && fs > 6) { fs -= 1; ctx.font = `400 ${fs}px "Bungee", sans-serif`; }
          ctx.lineJoin = 'round';
          ctx.lineWidth = fs * 0.28;
          ctx.strokeStyle = 'rgba(40,20,0,0.9)';
          ctx.strokeText(text, cx, y);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, cx, y);
        };
        if (top && val && coin.v > 0) {
          line(top, cy - R * 0.28, R * 0.42);
          line(val, cy + R * 0.25, R * 0.36);
        } else if (top) {
          line(top, cy, R * (top.length > 4 ? 0.34 : 0.6));
        } else if (val) {
          line(val, cy, R * 0.44);
        }
      }
      ctx.restore();
    }

    drawSprite(sym, x, y, scale = 1, alpha = 1) {
      if (sym !== 'COIN') return super.drawSprite(sym, x, y, scale, alpha);
      this.drawCoin(x + this.cw / 2, y + this.ch / 2, this.cell * 0.4 * scale, null, alpha);
    }

    // ----------------------------------------------------------- bonus
    enterBonus(grid) {
      this.bonus = { grid: { ...grid }, spinning: false, pops: {}, flash: 0, collect: null };
      this.clearWin();
    }

    exitBonus() {
      this.bonus = null;
    }

    setBonusSpinning(on) {
      if (this.bonus) this.bonus.spinning = on;
    }

    landCoin(k, coin) {
      if (!this.bonus) return;
      this.bonus.grid[k] = coin;
      this.bonus.pops[k] = this.time;
      const [r, c] = k.split(',').map(Number);
      this.burst(r, c, coin.jp || coin.special ? '#ffffff' : '#ffd23f', 16);
    }

    syncGrid(grid) {
      if (this.bonus) this.bonus.grid = { ...grid };
    }

    /** Coins fly into the collector, then its value updates. */
    collectAnim(at, value) {
      if (!this.bonus) return Promise.resolve();
      const [tr, tc] = at.split(',').map(Number);
      const tx = tc * this.cw + this.cw / 2;
      const ty = tr * this.ch + this.ch / 2;
      for (const k of Object.keys(this.bonus.grid)) {
        if (k === at) continue;
        const [r, c] = k.split(',').map(Number);
        const x = c * this.cw + this.cw / 2;
        const y = r * this.ch + this.ch / 2;
        for (let i = 0; i < 6; i++) this.particles.push({ x, y, vx: (tx - x) / 0.45 + (Math.random() - 0.5) * 60, vy: (ty - y) / 0.45 + (Math.random() - 0.5) * 60, life: 0.45, t: 0, r: this.cell * 0.05, color: '#e8b0ff', float: true });
      }
      return new Promise((res) => setTimeout(() => {
        this.bonus.grid[at] = { v: value, special: 'COLLECT' };
        this.bonus.pops[at] = this.time;
        this.burst(tr, tc, '#e8b0ff', 30);
        res();
      }, 480));
    }

    boostAnim() {
      if (!this.bonus) return Promise.resolve();
      this.bonus.flash = this.time;
      for (const k of Object.keys(this.bonus.grid)) this.bonus.pops[k] = this.time;
      return new Promise((res) => setTimeout(res, 650));
    }

    updateParticles(dt) {
      this.particles = this.particles.filter((p) => (p.t += dt) < p.life);
      for (const p of this.particles) {
        if (!p.float) p.vy += this.cell * 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    drawCells() {
      if (!this.bonus) {
        super.drawCells();
        // coin values on the landed base-game coins
        for (const [k, coin] of Object.entries(this.coins)) {
          const [r, c] = k.split(',').map(Number);
          const p = this.cellPos(r, c);
          if (!p) continue;
          const s = this.popScale(r, c) * this.winScale(r, c);
          this.drawCoin(p.x + this.cw / 2, p.y + this.ch / 2, this.cell * 0.4 * s, coin);
        }
        return;
      }
      const ctx = this.ctx;
      const B = this.bonus;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const k = key(r, c);
          const x = c * this.cw;
          const y = r * this.ch;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.strokeStyle = 'rgba(255,210,63,0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x + 4, y + 4, this.cw - 8, this.ch - 8, this.cell * 0.12);
          ctx.fill();
          ctx.stroke();
          const coin = B.grid[k];
          if (coin) {
            let sc = 1;
            const t0 = B.pops[k];
            if (t0 !== undefined) {
              const t = this.time - t0;
              if (t < 0.45) sc = 1 + Math.sin((t / 0.45) * Math.PI) * 0.3;
              else delete B.pops[k];
            }
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 4, this.cw - 8, this.ch - 8, this.cell * 0.12);
            ctx.fill();
            ctx.restore();
            this.drawCoin(x + this.cw / 2, y + this.ch / 2, this.cell * 0.42 * sc, coin);
          } else if (B.spinning) {
            // blurred flicker of coins / blanks while the empty cell respins
            const ph = Math.floor(this.time * 18 + r * 3 + c * 7) % 3;
            ctx.save();
            ctx.globalAlpha = 0.28;
            if (ph === 0) this.drawCoin(x + this.cw / 2, y + this.ch / 2 - this.ch * 0.15, this.cell * 0.36, null);
            else if (ph === 1) this.drawCoin(x + this.cw / 2, y + this.ch / 2 + this.ch * 0.15, this.cell * 0.36, null);
            ctx.restore();
          }
        }
      }
      if (B.flash && this.time - B.flash < 0.5) {
        ctx.fillStyle = `rgba(255,160,90,${0.5 * (1 - (this.time - B.flash) / 0.5)})`;
        ctx.fillRect(0, 0, this.w, this.h);
      }
    }
  }

  SlotKit.views.HoldWinView = HoldWinView;
})();
