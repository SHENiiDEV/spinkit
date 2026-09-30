/**
 * SymbolArt — renders every slot symbol once into an offscreen canvas
 * (per cell size) so the reel renderer only blits bitmaps.
 *
 * Symbol kinds (from game_config.symbols):
 *   royal   big metallic card letters (A K Q J 10)
 *   icon    illustrated symbol (Twemoji SVG, or custom `image`)
 *   wild    golden plaque + icon + WILD ribbon
 *   scatter glow + icon + SCATTER ribbon (rays are animated live)
 *   seven   classic red 7
 *   bar     triple BAR plate
 *   mult    multiplier orb / candy bomb with value (rendered per value)
 */
(function () {
  const ICON_PATH = '/games/assets/icons/';

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, target, t) {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  }
  const lighten = (hex, t) => mix(hex, '#ffffff', t);
  const darken = (hex, t) => mix(hex, '#000000', t);
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function multTierColor(v) {
    if (v >= 100) return '#ffd23f';
    if (v >= 25) return '#ff4d4d';
    if (v >= 10) return '#b06bff';
    if (v >= 5) return '#3db7ff';
    return '#3ddc84';
  }

  const RIMS = {
    gold: ['#fff3b0', '#e0a526', '#7a4a06'],
    chrome: ['#ffffff', '#b8c2cc', '#4a5560'],
    neon: ['#e6fdff', '#18e0ff', '#0a4a66'],
    marble: ['#fffbe8', '#e8c46a', '#8a6420'],
    candy: ['#ffffff', '#ffd6ea', '#d63d86'],
    jade: ['#fff3b0', '#e0b64a', '#5e3b06'],
    wood: ['#ffe2a8', '#d69a4a', '#5a3310'],
    silver: ['#ffffff', '#c3ccd6', '#48525e'],
    bronze: ['#ffe0b8', '#c07a3a', '#4a2508'],
    ice: ['#ffffff', '#a8e6ff', '#1d5a80'],
    ruby: ['#ffd6d6', '#e0303f', '#5a0610'],
    emerald: ['#e8ffe8', '#2fbf71', '#0b4a24'],
    amethyst: ['#f3e0ff', '#a45ce0', '#3a0e5e'],
    rose: ['#ffffff', '#ffb0d0', '#a8306a'],
    obsidian: ['#d0d0e0', '#5a5a78', '#101018']
  };
  window.SlotRims = RIMS;

  class SymbolArt {
    constructor(config) {
      this.config = config;
      this.theme = config.theme || {};
      this.font = this.theme.font || 'Cinzel';
      this.rim = RIMS[this.theme.frame] || RIMS.gold;
      this.images = {};
      this.tallImages = {}; // giant (multi-row) artwork, see mechanic 'giants'
      this.tallVideos = {}; // animated giants: { video, mask } (symbol.tall_video + symbol.tall_mask)
      this.cache = new Map();
      this.tallCache = new Map();
      this.size = 128;
    }

    async load() {
      const jobs = [];
      for (const sym of Object.values(this.config.symbols)) {
        const src = sym.image || (sym.icon_file ? ICON_PATH + sym.icon_file : null);
        if (!src) continue;
        jobs.push(new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { this.images[sym.id] = img; resolve(); };
          img.onerror = () => resolve();
          img.src = src;
        }));
        if (sym.tall_image) {
          jobs.push(new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.tallImages[sym.id] = img; resolve(); };
            img.onerror = () => resolve();
            img.src = sym.tall_image;
          }));
        }
        if (sym.tall_video) this.loadTallVideo(sym);
      }
      const fontJobs = [
        document.fonts.load(`900 64px "${this.font}"`),
        document.fonts.load(`700 64px "${this.font}"`),
        document.fonts.load('900 64px "Bungee"')
      ].map((p) => p.catch(() => null));
      await Promise.all([...jobs, ...fontJobs]);
    }

    /**
     * Animated giant: a looping video (WebM / MP4) drawn frame by frame; `tall_mask` (a PNG whose alpha is the card
     * shape) cuts the video's background away. Until the video can play, the still tall_image is used.
     */
    loadTallVideo(sym) {
      const video = document.createElement('video');
      Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      const entry = { video, mask: null, ready: false };
      video.addEventListener('canplay', () => { entry.ready = true; video.play().catch(() => {}); });
      // tall_video: one URL or a list (e.g. [webm, mp4]); the first format this browser can play wins
      const list = [].concat(sym.tall_video);
      const type = (u) => (/\.webm$/i.test(u) ? 'video/webm' : 'video/mp4');
      video.src = list.find((u) => video.canPlayType(type(u))) || list[list.length - 1];
      if (sym.tall_mask) {
        const m = new Image();
        m.onload = () => { entry.mask = m; };
        m.src = sym.tall_mask;
      }
      // browsers may block autoplay until the first tap
      const kick = () => { video.play().catch(() => {}); };
      window.addEventListener('pointerdown', kick, { once: true });
      window.addEventListener('keydown', kick, { once: true });
      this.tallVideos[sym.id] = entry;
    }

    setSize(px) {
      const s = Math.max(32, Math.round(px));
      if (s !== this.size) {
        this.size = s;
        this.cache.clear();
        this.tallCache.clear();
      }
    }

    /** width / height of a giant's artwork (null if it has none). */
    tallAspect(id) {
      const img = this.tallImages[id];
      return img ? img.width / img.height : null;
    }

    /** Giant artwork pre-scaled to w x h device pixels (cached per size). */
    getTall(id, w, h) {
      const vid = this.tallVideos[id];
      if (vid && vid.ready && vid.video.readyState >= 2) return this.getTallVideoFrame(id, vid, w, h);
      const img = this.tallImages[id];
      if (!img) return null;
      w = Math.max(8, Math.round(w));
      h = Math.max(8, Math.round(h));
      const key = `${id}|${w}|${h}`;
      if (this.tallCache.has(key)) return this.tallCache.get(key);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Boxes of another shape (e.g. a reel giant 3 to 6 rows tall) get a centred "cover" crop
      // instead of a stretched picture; near-matching boxes are drawn whole as before.
      const src = img.width / img.height;
      const dst = w / h;
      if (Math.abs(dst / src - 1) > 0.12) {
        const sw = dst > src ? img.width : img.height * dst;
        const sh = dst > src ? img.width / dst : img.height;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }
      this.tallCache.set(key, c);
      return c;
    }

    /** Current video frame of an animated giant, cover-cropped to w x h and masked (redrawn once per frame). */
    getTallVideoFrame(id, vid, w, h) {
      w = Math.max(8, Math.round(w));
      h = Math.max(8, Math.round(h));
      const key = `v|${id}|${w}|${h}`;
      let entry = this.tallCache.get(key);
      if (!entry) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        entry = { canvas: c, t: -1, frame: -1 };
        this.tallCache.set(key, entry);
      }
      const frame = Math.floor(performance.now() / 16);
      if (entry.frame === frame && entry.t === vid.video.currentTime) return entry.canvas;
      entry.frame = frame;
      entry.t = vid.video.currentTime;
      const ctx = entry.canvas.getContext('2d');
      const vw = vid.video.videoWidth;
      const vh = vid.video.videoHeight;
      const dst = w / h;
      const src = vw / vh;
      const sw = dst > src ? vw : vh * dst;
      const sh = dst > src ? vw / dst : vh;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(vid.video, sx, sy, sw, sh, 0, 0, w, h);
      if (vid.mask) {
        // the mask has the video's size: crop it the same way
        ctx.globalCompositeOperation = 'destination-in';
        const kx = vid.mask.width / vw;
        const ky = vid.mask.height / vh;
        ctx.drawImage(vid.mask, sx * kx, sy * ky, sw * kx, sh * ky, 0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';
      return entry.canvas;
    }

    // Transparent PNG artwork drawn as-is (no plaques / ribbons); giants are fitted into the square.
    drawPlain(ctx, sym) {
      const S = this.size;
      const tall = this.tallImages[sym.id];
      if (tall) {
        const h = S * 0.96;
        const w = h * (tall.width / tall.height);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = S * 0.05;
        ctx.drawImage(tall, (S - w) / 2, (S - h) / 2, w, h);
        ctx.restore();
        return;
      }
      this.glowDisc(ctx, sym.color, 0.46, sym.isScatter ? 0.4 : 0.16);
      this.drawImage(ctx, sym, this.theme.symbolScale || 0.9);
    }

    get(id) {
      const key = id;
      if (this.cache.has(key)) return this.cache.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = this.size;
      const ctx = canvas.getContext('2d');
      if (typeof id === 'string' && id[0] === 'M' && /^M\d+$/.test(id)) {
        this.drawMult(ctx, Number(id.slice(1)));
      } else {
        const sym = this.config.symbols[id] || { id, kind: 'royal', label: id, color: '#ffffff' };
        const fn = {
          royal: this.drawRoyal,
          icon: this.drawIcon,
          wild: this.drawWild,
          scatter: this.drawScatter,
          seven: this.drawSeven,
          bar: this.drawBar,
          mult: this.drawIcon
        }[sym.kind] || this.drawIcon;
        const plain = (this.theme.plainSymbols || sym.plain) && (sym.image || sym.tall_image);
        (plain ? this.drawPlain : fn).call(this, ctx, sym);
      }
      this.cache.set(key, canvas);
      return canvas;
    }

    // ------------------------------------------------------------ helpers
    fitText(ctx, text, maxW, sizePx, weight = 900, family = this.font) {
      let size = sizePx;
      ctx.font = `${weight} ${size}px "${family}", serif`;
      const inkWidth = () => {
        const m = ctx.measureText(text);
        const ink = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0);
        return Math.max(m.width, ink) + size * 0.12;
      };
      while (inkWidth() > maxW && size > 8) {
        size -= 2;
        ctx.font = `${weight} ${size}px "${family}", serif`;
      }
      return size;
    }

    glossyText(ctx, text, x, y, { color, size, family = this.font, weight = 900, rim = this.rim, outline = 0.13, rimW = 0.075, skew = 0 }) {
      const S = this.size;
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = S;
      const t = tmp.getContext('2d');
      t.textAlign = 'center';
      t.textBaseline = 'middle';
      if (skew) t.setTransform(1, 0, skew, 1, -skew * y, 0);
      this.fitText(t, text, S * 0.76, size, weight, family);
      t.lineJoin = 'round';
      // dark outline
      t.lineWidth = size * outline;
      t.strokeStyle = 'rgba(0,0,0,0.85)';
      t.strokeText(text, x, y);
      // metal rim
      const rg = t.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      rg.addColorStop(0, rim[0]);
      rg.addColorStop(0.5, rim[1]);
      rg.addColorStop(1, rim[2]);
      t.lineWidth = size * rimW;
      t.strokeStyle = rg;
      t.strokeText(text, x, y);
      // body
      const fg = t.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      fg.addColorStop(0, lighten(color, 0.55));
      fg.addColorStop(0.45, color);
      fg.addColorStop(1, darken(color, 0.45));
      t.fillStyle = fg;
      t.fillText(text, x, y);
      // gloss (only on the letters)
      t.globalCompositeOperation = 'source-atop';
      const gl = t.createLinearGradient(0, y - size / 2, 0, y);
      gl.addColorStop(0, 'rgba(255,255,255,0.55)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      t.fillStyle = gl;
      t.fillRect(0, y - size / 2, S, size * 0.45);
      t.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = S * 0.05;
      ctx.shadowOffsetY = S * 0.025;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    }

    glowDisc(ctx, color, radius = 0.46, alpha = 0.35) {
      const S = this.size;
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * radius);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }

    drawImage(ctx, sym, scale = 0.78, cy = 0.5) {
      const S = this.size;
      const img = this.images[sym.id];
      const w = S * scale;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = S * 0.06;
      ctx.shadowOffsetY = S * 0.03;
      if (img) {
        if (this.theme.framedSymbols || sym.framed) {
          const x = (S - w) / 2;
          const y = S * cy - w / 2;
          const r = w * 0.16;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, w, w, r);
          ctx.clip();
          ctx.drawImage(img, x, y, w, w);
          ctx.restore();

          // Ornate metallic rim
          const rim = ctx.createLinearGradient(0, y, 0, y + w);
          rim.addColorStop(0, this.rim[0]);
          rim.addColorStop(0.5, this.rim[1]);
          rim.addColorStop(1, this.rim[2]);
          ctx.lineWidth = w * 0.055;
          ctx.strokeStyle = rim;
          ctx.beginPath();
          ctx.roundRect(x, y, w, w, r);
          ctx.stroke();
        } else {
          ctx.drawImage(img, (S - w) / 2, S * cy - w / 2, w, w);
        }
      } else {
        ctx.font = `${w * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym.glyph || '?', S / 2, S * cy);
      }
      ctx.restore();
    }

    ribbon(ctx, text, color, y, size) {
      this.glossyText(ctx, text, this.size / 2, y, { color, size, outline: 0.16, rimW: 0.08 });
    }

    // ------------------------------------------------------------ kinds
    drawRoyal(ctx, sym) {
      const S = this.size;
      const size = sym.label.length > 1 ? S * 0.5 : S * 0.6;
      this.glowDisc(ctx, sym.color, 0.4, 0.18);
      this.glossyText(ctx, sym.label, S / 2, S * 0.54, { color: sym.color, size });
    }

    drawIcon(ctx, sym) {
      if (sym.gem) return this.drawGem(ctx, sym);
      if (sym.medallion || (this.theme.medallions && sym.kind === 'icon')) {
        this.drawMedallion(ctx, sym);
        this.drawImage(ctx, sym, 0.62);
        return;
      }
      this.glowDisc(ctx, sym.color, 0.45, 0.3);
      this.drawImage(ctx, sym, 0.8);
    }

    drawMedallion(ctx, sym) {
      const S = this.size;
      const R = S * 0.44;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = S * 0.06;
      ctx.shadowOffsetY = S * 0.03;
      const rim = ctx.createLinearGradient(0, S / 2 - R, 0, S / 2 + R);
      rim.addColorStop(0, this.rim[0]);
      rim.addColorStop(0.5, this.rim[1]);
      rim.addColorStop(1, this.rim[2]);
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();
      ctx.restore();
      const inner = ctx.createRadialGradient(S * 0.45, S * 0.38, S * 0.02, S / 2, S / 2, R * 0.9);
      inner.addColorStop(0, lighten(sym.color, 0.25));
      inner.addColorStop(0.55, darken(sym.color, 0.35));
      inner.addColorStop(1, darken(sym.color, 0.75));
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, R * 0.86, 0, Math.PI * 2);
      ctx.fillStyle = inner;
      ctx.fill();
      // gloss
      ctx.save();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, R * 0.86, 0, Math.PI * 2);
      ctx.clip();
      const gl = ctx.createLinearGradient(0, S / 2 - R, 0, S / 2);
      gl.addColorStop(0, 'rgba(255,255,255,0.28)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.ellipse(S / 2, S / 2 - R * 0.35, R * 0.8, R * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /** Procedural faceted gem (used for tumble low-pay symbols). */
    drawGem(ctx, sym) {
      const S = this.size;
      const cx = S / 2;
      const cy = S / 2;
      const R = S * 0.4;
      const shape = sym.shape || 'hex';
      const poly = {
        hex: [...Array(6)].map((_, i) => [Math.cos(Math.PI / 6 + i * Math.PI / 3), Math.sin(Math.PI / 6 + i * Math.PI / 3)]),
        diamond: [[0, -1.05], [0.72, 0], [0, 1.05], [-0.72, 0]],
        octagon: [...Array(8)].map((_, i) => [Math.cos(Math.PI / 8 + i * Math.PI / 4) * 0.95, Math.sin(Math.PI / 8 + i * Math.PI / 4) * 1.05]),
        triangle: [[0, -1.02], [1, 0.78], [-1, 0.78]],
        square: [[-0.82, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82]],
        oval: [...Array(14)].map((_, i) => [Math.cos(i * Math.PI / 7) * 0.8, Math.sin(i * Math.PI / 7) * 1.02]),
        heart: [[0, -0.45], [0.35, -0.95], [0.95, -0.7], [0.95, -0.05], [0, 0.98], [-0.95, -0.05], [-0.95, -0.7], [-0.35, -0.95]]
      }[shape] || [];
      const pts = poly.map(([x, y]) => [cx + x * R, cy + y * R]);
      const inner = poly.map(([x, y]) => [cx + x * R * 0.55, cy + y * R * 0.55 - R * 0.04]);
      ctx.save();
      ctx.shadowColor = sym.color;
      ctx.shadowBlur = S * 0.12;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = darken(sym.color, 0.35);
      ctx.fill();
      ctx.restore();
      // facets: each outer edge to the inner table, shaded by facing direction
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        const mx = (pts[i][0] + pts[j][0]) / 2 - cx;
        const my = (pts[i][1] + pts[j][1]) / 2 - cy;
        const light = (-mx - my * 1.4) / (R * 1.6); // light from top-left
        const t = Math.max(-1, Math.min(1, light));
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.lineTo(inner[j][0], inner[j][1]);
        ctx.lineTo(inner[i][0], inner[i][1]);
        ctx.closePath();
        ctx.fillStyle = t > 0 ? lighten(sym.color, t * 0.55) : darken(sym.color, -t * 0.5);
        ctx.fill();
      }
      // table
      ctx.beginPath();
      inner.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      const tg = ctx.createLinearGradient(cx - R * 0.5, cy - R * 0.5, cx + R * 0.5, cy + R * 0.5);
      tg.addColorStop(0, lighten(sym.color, 0.6));
      tg.addColorStop(1, sym.color);
      ctx.fillStyle = tg;
      ctx.fill();
      // outline
      ctx.lineJoin = 'round';
      ctx.lineWidth = S * 0.02;
      ctx.strokeStyle = darken(sym.color, 0.65);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      // sparkle
      const sx = cx - R * 0.28;
      const sy = cy - R * 0.32;
      const sp = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.35);
      sp.addColorStop(0, 'rgba(255,255,255,0.95)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sp;
      ctx.fillRect(sx - R * 0.4, sy - R * 0.4, R * 0.8, R * 0.8);
    }

    drawWild(ctx, sym) {
      const S = this.size;
      const pad = S * 0.05;
      const r = S * 0.14;
      ctx.save();
      // plaque
      ctx.beginPath();
      ctx.roundRect(pad, pad, S - pad * 2, S - pad * 2, r);
      const bg = ctx.createRadialGradient(S / 2, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.7);
      bg.addColorStop(0, rgba(sym.color, 0.55));
      bg.addColorStop(1, 'rgba(10,6,20,0.92)');
      ctx.fillStyle = bg;
      ctx.fill();
      const rim = ctx.createLinearGradient(0, pad, 0, S - pad);
      rim.addColorStop(0, this.rim[0]);
      rim.addColorStop(0.5, this.rim[1]);
      rim.addColorStop(1, this.rim[2]);
      ctx.lineWidth = S * 0.045;
      ctx.strokeStyle = rim;
      ctx.stroke();
      ctx.restore();
      this.drawImage(ctx, sym, 0.62, 0.42);
      this.ribbon(ctx, 'WILD', '#ffcf3a', S * 0.8, S * 0.27);
    }

    drawScatter(ctx, sym) {
      const S = this.size;
      this.glowDisc(ctx, sym.color, 0.5, 0.55);
      this.drawImage(ctx, sym, 0.7, 0.42);
      this.ribbon(ctx, 'SCATTER', sym.color, S * 0.83, S * 0.2);
    }

    drawSeven(ctx, sym) {
      const S = this.size;
      this.glowDisc(ctx, sym.color, 0.45, 0.3);
      this.glossyText(ctx, '7', S / 2, S * 0.53, { color: sym.color, size: S * 0.86, family: 'Bungee', weight: 400, rim: RIMS.gold, skew: -0.12 });
    }

    drawBar(ctx) {
      const S = this.size;
      const h = S * 0.2;
      for (let i = 0; i < 3; i++) {
        const y = S * 0.2 + i * (h + S * 0.04);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(S * 0.1, y, S * 0.8, h, h * 0.25);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#3a3a3a');
        g.addColorStop(1, '#050505');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = S * 0.03;
        ctx.fill();
        ctx.lineWidth = S * 0.025;
        ctx.strokeStyle = '#e0a526';
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.font = `400 ${h * 0.78}px "Bungee", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('BAR', S / 2, y + h * 0.56);
        ctx.restore();
      }
    }

    drawMult(ctx, value) {
      const S = this.size;
      const color = multTierColor(value);
      const bomb = this.config.symbols.MULT && this.config.symbols.MULT.bomb;
      if (bomb) {
        this.glowDisc(ctx, color, 0.5, 0.5);
        this.drawImage(ctx, this.config.symbols.MULT, 0.86, 0.5);
      } else {
        // glowing orb
        const g = ctx.createRadialGradient(S * 0.42, S * 0.38, S * 0.04, S / 2, S / 2, S * 0.42);
        g.addColorStop(0, lighten(color, 0.8));
        g.addColorStop(0.45, color);
        g.addColorStop(1, darken(color, 0.6));
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = S * 0.18;
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.35;
        this.drawImage(ctx, this.config.symbols.MULT || { id: 'MULT', glyph: '⚡' }, 0.6, 0.5);
        ctx.restore();
      }
      const label = 'x' + value;
      this.glossyText(ctx, label, S / 2, S * 0.54, {
        color: bomb ? '#ffffff' : lighten(color, 0.75),
        size: S * (label.length > 3 ? 0.34 : 0.42),
        family: 'Bungee',
        weight: 400,
        rim: RIMS.gold
      });
    }
  }

  window.SymbolArt = SymbolArt;
  window.SlotColor = { hexToRgb, lighten, darken, rgba, multTierColor };
})();
