/**
 * Visual FX: animated themed background particles and the coin shower
 * used by Big / Mega / Epic win celebrations.
 */
(function () {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  class BackgroundFX {
    constructor(canvas, style, accent) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.style = style || 'dust';
      this.accent = accent || '#ffd76a';
      this.parts = [];
      this.boost = 0;
      this.resize();
      window.addEventListener('resize', () => this.resize());
      const count = { dust: 70, neon: 55, clouds: 14, sparkle: 70, petals: 40, lights: 0, snow: 110, bubbles: 45, embers: 70, leaves: 30, stars: 120 }[this.style] ?? 50;
      for (let i = 0; i < count; i++) this.parts.push(this.spawn(true));
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    spawn(initial) {
      const w = this.w;
      const h = this.h;
      const s = this.style;
      const p = { x: rand(0, w), y: initial ? rand(0, h) : h + 20, life: rand(0, TAU) };
      if (s === 'dust') Object.assign(p, { r: rand(0.6, 2.4), vx: rand(-6, 6), vy: rand(-18, -6), a: rand(0.2, 0.7) });
      else if (s === 'neon') Object.assign(p, { r: rand(1, 3.5), vx: 0, vy: rand(-40, -12), a: rand(0.3, 0.9), c: Math.random() < 0.5 ? '#18e0ff' : '#ff2bd6' });
      else if (s === 'clouds') Object.assign(p, { y: rand(0, h), x: initial ? rand(-200, w) : -300, r: rand(80, 220), vx: rand(4, 14), vy: 0, a: rand(0.05, 0.14) });
      else if (s === 'sparkle') Object.assign(p, { r: rand(1, 3.2), vx: rand(-4, 4), vy: rand(-10, -2), a: rand(0.3, 1), c: ['#ffffff', '#ffe4f2', '#fff7b0', '#c9f1ff'][(Math.random() * 4) | 0] });
      else if (s === 'petals') Object.assign(p, { y: initial ? rand(0, h) : -20, r: rand(3, 7), vx: rand(8, 24), vy: rand(14, 34), a: rand(0.4, 0.85), rot: rand(0, TAU) });
      else if (s === 'leaves') Object.assign(p, { y: initial ? rand(0, h) : -20, r: rand(5, 10), vx: rand(6, 20), vy: rand(16, 36), a: rand(0.35, 0.8), rot: rand(0, TAU), c: ['#4caf50', '#8bc34a', '#cddc39', '#2e7d32'][(Math.random() * 4) | 0] });
      else if (s === 'snow') Object.assign(p, { y: initial ? rand(0, h) : -10, r: rand(1, 3.6), vx: rand(-8, 8), vy: rand(14, 44), a: rand(0.4, 0.95), c: '#ffffff' });
      else if (s === 'bubbles') Object.assign(p, { r: rand(3, 11), vx: rand(-4, 4), vy: rand(-40, -14), a: rand(0.25, 0.6) });
      else if (s === 'embers') Object.assign(p, { r: rand(0.8, 2.6), vx: rand(-10, 10), vy: rand(-50, -18), a: rand(0.4, 1), c: ['#ff9100', '#ff3d00', '#ffd740'][(Math.random() * 3) | 0] });
      else if (s === 'stars') Object.assign(p, { y: rand(0, h), r: rand(0.5, 2), vx: 0, vy: 0, a: rand(0.3, 1), c: '#ffffff' });
      return p;
    }

    loop(t) {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      const speed = 1 + this.boost * 3;
      this.boost = Math.max(0, this.boost - dt * 0.5);
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        p.life += dt;
        p.x += (p.vx + Math.sin(p.life) * 4) * dt * speed;
        p.y += p.vy * dt * speed;
        const out = p.y < -30 || p.y > this.h + 40 || p.x > this.w + 320 || p.x < -340;
        if (out) {
          this.parts[i] = this.spawn(false);
          continue;
        }
        this.draw(ctx, p);
      }
      requestAnimationFrame((tt) => this.loop(tt));
    }

    draw(ctx, p) {
      const s = this.style;
      if (s === 'clouds') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,255,255,${p.a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        return;
      }
      if (s === 'bubbles') {
        ctx.globalAlpha = p.a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
      if (s === 'petals' || s === 'leaves') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 1.5 + p.rot);
        ctx.globalAlpha = s === 'leaves' ? p.a : 1;
        ctx.fillStyle = s === 'leaves' ? p.c : `rgba(255,150,190,${p.a})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }
      const twinkle = 0.55 + 0.45 * Math.sin(p.life * 3);
      ctx.globalAlpha = p.a * twinkle;
      ctx.fillStyle = p.c || this.accent;
      if (s === 'neon') {
        ctx.fillRect(p.x, p.y, p.r, p.r * 3);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  class CoinShower {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.coins = [];
      this.running = false;
      this.rate = 0;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = this.canvas.clientWidth;
      this.h = this.canvas.clientHeight;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    start(rate = 60) {
      this.resize();
      this.rate = rate;
      if (!this.running) {
        this.running = true;
        this.last = performance.now();
        requestAnimationFrame((t) => this.loop(t));
      }
    }

    stop() {
      this.rate = 0;
    }

    burst(n = 40) {
      for (let i = 0; i < n; i++) this.coins.push(this.makeCoin(true));
    }

    makeCoin(fromCenter) {
      const w = this.w;
      const h = this.h;
      return fromCenter
        ? { x: w / 2 + rand(-60, 60), y: h * 0.55, vx: rand(-420, 420), vy: rand(-900, -350), r: rand(10, 20), spin: rand(0, TAU), vs: rand(6, 14) }
        : { x: rand(0, w), y: -30, vx: rand(-40, 40), vy: rand(80, 260), r: rand(10, 20), spin: rand(0, TAU), vs: rand(6, 14) };
    }

    loop(t) {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.rate) {
        this.acc = (this.acc || 0) + this.rate * dt;
        while (this.acc > 1) {
          this.coins.push(this.makeCoin(Math.random() < 0.35));
          this.acc -= 1;
        }
      }
      this.coins = this.coins.filter((c) => c.y < this.h + 40);
      for (const c of this.coins) {
        c.vy += 900 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.spin += c.vs * dt;
        this.drawCoin(ctx, c);
      }
      if (this.coins.length || this.rate) requestAnimationFrame((tt) => this.loop(tt));
      else this.running = false;
    }

    drawCoin(ctx, c) {
      const sx = Math.abs(Math.cos(c.spin));
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(Math.max(0.12, sx), 1);
      const g = ctx.createRadialGradient(-c.r * 0.3, -c.r * 0.3, 1, 0, 0, c.r);
      g.addColorStop(0, '#fff6b0');
      g.addColorStop(0.5, '#f5c542');
      g.addColorStop(1, '#a26b09');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, TAU);
      ctx.fill();
      ctx.lineWidth = c.r * 0.14;
      ctx.strokeStyle = '#8a5a06';
      ctx.stroke();
      ctx.fillStyle = 'rgba(138,90,6,0.9)';
      ctx.font = `900 ${c.r * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, c.r * 0.06);
      ctx.restore();
    }
  }

  window.BackgroundFX = BackgroundFX;
  window.CoinShower = CoinShower;
})();
