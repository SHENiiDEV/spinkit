/**
 * Paints the artwork of the "giants" skins (src/games/skins/giants.js):
 *   public/games/<id>/assets/stage.jpg   1400x1254  cabinet: background scene, frame, logo, empty reel panel
 *   public/games/<id>/assets/giant.png    400x1000  tall portrait of the top-paying giant
 *   public/games/<id>/assets/wild.png     400x1000  tall portrait of the giant Wild
 *
 * Everything is drawn procedurally on a canvas in headless Chromium (Playwright), with
 * Twemoji characters and the bundled fonts. Replace any of the files with your own art
 * (same size) whenever you like; the game picks them up automatically.
 *
 * Skins marked custom_art (painted artwork) are never repainted, unless that one game is
 * requested explicitly with --force (node scripts/gen-art.js <id> --force).
 */
const { GIANT_SKINS } = require('../../../src/games/skins/giants');
const { paintingPage, writeImages, assetsDir } = require('../runner');
const base = require('../painter/base');

const FONTS = [
  { family: 'Cinzel', file: 'cinzel-latin-900-normal.woff2' },
  { family: 'Russo One', file: 'russo-one-latin-400-normal.woff2' },
  { family: 'Pirata One', file: 'pirata-one-latin-400-normal.woff2' },
  { family: 'Bangers', file: 'bangers-latin-400-normal.woff2' },
  { family: 'Creepster', file: 'creepster-latin-400-normal.woff2' },
  { family: 'Rye', file: 'rye-latin-400-normal.woff2' },
  { family: 'Lobster', file: 'lobster-latin-400-normal.woff2' },
  { family: 'Orbitron', file: 'orbitron-latin-900-normal.woff2' },
  { family: 'Bungee', file: 'bungee-latin-400-normal.woff2' }
];

const painter = String.raw`
const W = 1400, H = 1254, P = { x: 244, y: 254, w: 914, h: 853 };
function emoji(ctx, g, x, y, s, { shadow = 0.5, rot = 0, alpha = 1 } = {}) {
  const im = imgs[g]; if (!im) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,' + shadow + ')'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetY = s * 0.04; }
  ctx.drawImage(im, -s / 2, -s / 2, s, s); ctx.restore();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function metal(ctx, x0, y0, x1, y1, f) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, f[0]); g.addColorStop(0.18, f[1]); g.addColorStop(0.42, f[0]); g.addColorStop(0.6, f[1]); g.addColorStop(0.85, f[2]); g.addColorStop(1, f[1]);
  return g;
}
function ridge(ctx, yBase, amp, color, freq = 3, jag = 0.35, top = null) {
  ctx.beginPath(); ctx.moveTo(0, H);
  const ph = rnd() * 10;
  for (let x = 0; x <= W; x += 8) {
    const t = x / W;
    let y = yBase - amp * (0.55 + 0.45 * Math.sin(t * freq * TAU + ph)) - amp * jag * Math.abs(Math.sin(t * freq * 5.3 + ph * 2));
    if (top) y = Math.min(y, top(x) ?? y);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function glow(ctx, x, y, r, color, a = 0.8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function clouds(ctx, n, color, yMin, yMax, a = 0.5) {
  ctx.save(); ctx.filter = 'blur(18px)';
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = yMin + rnd() * (yMax - yMin), w = 160 + rnd() * 260;
    ctx.fillStyle = rgba(color, a * (0.5 + rnd() * 0.5));
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.22, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- scenes
const SCENES = {
  pyramids(ctx, a) {
    clouds(ctx, 10, '#ffd0a0', 120, 420, 0.35);
    ridge(ctx, 820, 60, mix(a.sky[2], '#5a2a10', 0.55), 1.2, 0.05);
    const pyr = (cx, base, w, h, c) => {
      ctx.beginPath(); ctx.moveTo(cx - w / 2, base); ctx.lineTo(cx, base - h); ctx.lineTo(cx + w / 2, base); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, base - h); ctx.lineTo(cx + w / 2, base); ctx.lineTo(cx + w * 0.1, base); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    };
    pyr(160, 900, 520, 430, '#c98a4a'); pyr(1260, 900, 560, 470, '#c08040'); pyr(420, 820, 300, 230, '#a86a36'); pyr(1030, 820, 280, 210, '#a86a36');
    ridge(ctx, 1000, 70, '#d9a05a', 1.6, 0.05); ridge(ctx, 1120, 60, '#b8793a', 2.1, 0.05);
    [[70, 980, 230, -0.08], [1330, 960, 250, 0.08], [230, 1080, 180, 0.04], [1180, 1090, 170, -0.05]].forEach(([x, y, s, r]) => emoji(ctx, a.deco, x, y, s, { rot: r }));
  },
  fjords(ctx, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(12px)';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 200 + k * 70 + Math.sin(x / 180 + k) * 60);
      ctx.lineWidth = 60 - k * 12; ctx.strokeStyle = ['rgba(60,255,170,0.35)', 'rgba(120,200,255,0.3)', 'rgba(190,120,255,0.25)'][k]; ctx.stroke();
    }
    ctx.restore();
    const peaks = (base, amp, c, snow) => {
      ctx.beginPath(); ctx.moveTo(0, H); let x = 0; const pts = [];
      while (x <= W + 100) { const y = base - amp * (0.4 + rnd() * 0.6); pts.push([x, y]); x += 90 + rnd() * 120; }
      pts.forEach(([px, py], i) => { ctx.lineTo(px, py); if (i < pts.length - 1) ctx.lineTo((px + pts[i + 1][0]) / 2, base - amp * 0.15); });
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      if (snow) pts.forEach(([px, py]) => { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 34, py + 60); ctx.lineTo(px + 30, py + 55); ctx.closePath(); ctx.fillStyle = 'rgba(235,248,255,0.85)'; ctx.fill(); });
    };
    peaks(760, 420, '#35587a', true); peaks(900, 380, '#1c3350', true);
    ctx.fillStyle = '#0c2238'; ctx.fillRect(0, 950, W, 400);
    ridge(ctx, 1150, 50, '#0a1626', 2, 0.1);
    for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + rnd() * 0.6) + ')'; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 1 + rnd() * 3, 0, TAU); ctx.fill(); }
  },
  sea(ctx, a) {
    clouds(ctx, 12, '#ffd8b8', 100, 520, 0.4);
    const hy = 760;
    const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, '#2a6a8a'); g.addColorStop(1, '#082438');
    ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
    glow(ctx, a.sun[0], hy + 40, 260, '#ffd0a0', 0.35);
    ctx.strokeStyle = 'rgba(255,230,200,0.25)'; ctx.lineWidth = 3;
    for (let i = 0; i < 40; i++) { const y = hy + 20 + rnd() * 450, x = rnd() * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 8, x + 70, y); ctx.stroke(); }
    const ship = (cx, base, s) => {
      ctx.save(); ctx.translate(cx, base); ctx.scale(s, s); ctx.fillStyle = '#1a0e08';
      ctx.beginPath(); ctx.moveTo(-160, 0); ctx.lineTo(160, 0); ctx.lineTo(120, 50); ctx.lineTo(-130, 50); ctx.closePath(); ctx.fill();
      [-70, 20, 100].forEach((mx, i) => { ctx.fillRect(mx - 4, -260 + i * 30, 8, 260 - i * 30); ctx.fillStyle = 'rgba(240,225,190,0.92)'; [0, 1].forEach((k) => { ctx.beginPath(); ctx.moveTo(mx - 60, -230 + i * 30 + k * 110); ctx.quadraticCurveTo(mx, -250 + i * 30 + k * 110, mx + 60, -230 + i * 30 + k * 110); ctx.lineTo(mx + 55, -140 + i * 30 + k * 110); ctx.quadraticCurveTo(mx, -120 + i * 30 + k * 110, mx - 55, -140 + i * 30 + k * 110); ctx.closePath(); ctx.fill(); }); ctx.fillStyle = '#1a0e08'; });
      ctx.restore();
    };
    ship(1290, 800, 0.95); ship(110, 780, 0.6);
    emoji(ctx, a.deco, 1300, 330, 110, { rot: 0.1 });
    ridge(ctx, 1190, 40, '#c8a060', 1.5, 0.05);
  },
  temple(ctx, a) {
    clouds(ctx, 22, '#ffffff', 80, 1100, 0.45);
    ridge(ctx, 820, 160, '#7a6ab8', 1.4, 0.2);
    const cols = (x0, n, top, bot) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 70; const g = ctx.createLinearGradient(x, 0, x + 44, 0);
        g.addColorStop(0, '#9a90b8'); g.addColorStop(0.4, '#ffffff'); g.addColorStop(1, '#8a80a8');
        ctx.fillStyle = g; ctx.fillRect(x, top, 44, bot - top); ctx.fillStyle = '#e8e4f4'; ctx.fillRect(x - 8, top - 20, 60, 22); ctx.fillRect(x - 8, bot, 60, 18);
      }
      ctx.fillStyle = '#f0ecfa'; ctx.beginPath(); ctx.moveTo(x0 - 30, top - 20); ctx.lineTo(x0 + n * 70 / 2 - 10, top - 120); ctx.lineTo(x0 + n * 70 + 10, top - 20); ctx.closePath(); ctx.fill();
    };
    cols(-40, 3, 520, 1080); cols(1230, 3, 520, 1080);
    clouds(ctx, 10, '#ffffff', 1000, 1250, 0.7);
    [[90, 1150, 150], [1310, 1150, 150]].forEach(([x, y, s]) => emoji(ctx, a.deco, x, y, s));
  },
  pagoda(ctx, a) {
    for (let k = 0; k < 4; k++) ridge(ctx, 620 + k * 130, 200 - k * 30, mix('#6a2a5a', a.sky[0], 0.15 * (3 - k) + 0.1), 1 + k * 0.4, 0.25);
    ctx.fillStyle = '#1a0610';
    const px = 1250, pb = 900;
    for (let i = 0; i < 5; i++) { const w = 220 - i * 32, y = pb - i * 95; ctx.fillRect(px - w / 2 + 20, y - 70, w - 40, 70); ctx.beginPath(); ctx.moveTo(px - w / 2 - 30, y - 60); ctx.quadraticCurveTo(px, y - 110, px + w / 2 + 30, y - 60); ctx.lineTo(px + w / 2 - 10, y - 80); ctx.lineTo(px - w / 2 + 10, y - 80); ctx.closePath(); ctx.fill(); }
    ctx.fillRect(px - 4, pb - 560, 8, 110);
    ctx.strokeStyle = '#2a0a14'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, 1100); ctx.quadraticCurveTo(120, 700, 60, 300); ctx.stroke();
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(80, 600); ctx.quadraticCurveTo(200, 450, 330, 380); ctx.stroke(); ctx.beginPath(); ctx.moveTo(70, 380); ctx.quadraticCurveTo(200, 200, 420, 140); ctx.stroke();
    for (let i = 0; i < 260; i++) { const x = rnd() * 420, y = 60 + rnd() * 700; if (x > 300 && y > 500) continue; ctx.fillStyle = rgba(['#ffb6d5', '#ff8ab8', '#ffe0ee'][i % 3], 0.85); ctx.beginPath(); ctx.arc(x, y, 6 + rnd() * 12, 0, TAU); ctx.fill(); }
    ridge(ctx, 1170, 40, '#2a0a18', 2, 0.05);
    [[80, 1130, 120], [1330, 1120, 110]].forEach(([x, y, s]) => emoji(ctx, a.deco, x, y, s));
  },
  gothic(ctx, a) {
    clouds(ctx, 14, '#5a1020', 100, 700, 0.5);
    const castle = (x0, base, s) => {
      ctx.save(); ctx.translate(x0, base); ctx.scale(s, s); ctx.fillStyle = '#07030a';
      ctx.fillRect(-150, -300, 300, 300);
      [[-150, 420, 70], [150, 480, 80], [0, 560, 90], [-70, 380, 50], [80, 360, 50]].forEach(([tx, th, tw]) => { ctx.fillRect(tx - tw / 2, -th, tw, th); ctx.beginPath(); ctx.moveTo(tx - tw / 2 - 10, -th); ctx.lineTo(tx, -th - tw * 1.6); ctx.lineTo(tx + tw / 2 + 10, -th); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,190,80,0.85)'; [[-150, -330], [150, -380], [0, -420], [-40, -200], [60, -160]].forEach(([wx, wy]) => ctx.fillRect(wx - 7, wy, 14, 26));
      ctx.restore();
    };
    castle(1270, 960, 1.05); castle(130, 1000, 0.8);
    ridge(ctx, 1050, 90, '#0a0306', 1.2, 0.3);
    ctx.save(); ctx.filter = 'blur(20px)'; ctx.fillStyle = 'rgba(160,120,150,0.25)'; ctx.fillRect(0, 1000, W, 200); ctx.restore();
    for (let i = 0; i < 9; i++) emoji(ctx, '🦇', 60 + rnd() * 300 + (i % 2) * 1000, 120 + rnd() * 400, 40 + rnd() * 40, { rot: rnd() - 0.5, shadow: 0 });
    [[90, 1170, 120], [1310, 1170, 120]].forEach(([x, y, s]) => emoji(ctx, a.deco, x, y, s));
  },
  desert(ctx, a) {
    clouds(ctx, 8, '#ffd0a0', 120, 450, 0.35);
    const mesa = (x, base, w, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w / 2 - 60, base); ctx.lineTo(x - w / 2, base - h); ctx.lineTo(x + w / 2, base - h); ctx.lineTo(x + w / 2 + 60, base); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + w / 4, base - h, w / 4, h); };
    mesa(160, 900, 300, 330, '#a8482a'); mesa(1250, 900, 360, 380, '#b0502a'); mesa(500, 860, 200, 180, '#8a3a22'); mesa(960, 860, 220, 200, '#8a3a22');
    ridge(ctx, 1000, 60, '#d88a4a', 1.6, 0.05); ridge(ctx, 1130, 40, '#b86a32', 2.4, 0.05);
    [[80, 1000, 220, -0.05], [1330, 990, 240, 0.06], [260, 1110, 130, 0], [1150, 1110, 120, 0]].forEach(([x, y, s, r]) => emoji(ctx, a.deco, x, y, s, { rot: r }));
  },
  underwater(ctx, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const x = rnd() * W; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(180,255,250,0.22)'); g.addColorStop(1, 'rgba(180,255,250,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 160 + rnd() * 100, H); ctx.lineTo(x - 60, H); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const weed = (x, h, c) => { ctx.strokeStyle = c; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, H); for (let y = 0; y < h; y += 20) ctx.lineTo(x + Math.sin(y / 60 + x) * 26, H - y); ctx.stroke(); };
    for (let i = 0; i < 7; i++) { weed(20 + i * 30, 500 + rnd() * 400, i % 2 ? '#1a8a5a' : '#0f6a48'); weed(W - 20 - i * 30, 500 + rnd() * 400, i % 2 ? '#1a8a5a' : '#0f6a48'); }
    ridge(ctx, 1180, 60, '#c8b080', 1.4, 0.05);
    for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 12; ctx.strokeStyle = 'rgba(220,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    [[110, 1160, 120], [1300, 1160, 130], [250, 1200, 80]].forEach(([x, y, s]) => emoji(ctx, a.deco, x, y, s));
    emoji(ctx, '🐠', 110, 380, 90, { rot: -0.1 }); emoji(ctx, '🐟', 1300, 460, 80, { rot: 0.2 });
  },
  space(ctx, a) {
    for (let i = 0; i < 380; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.8) + ')'; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 2.2, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.filter = 'blur(60px)'; ctx.globalCompositeOperation = 'lighter';
    [['#ff2bd6', 200, 300, 260], ['#2b6bff', 1200, 700, 320], ['#3dffd0', 300, 1000, 220], ['#8a2bff', 1100, 200, 240]].forEach(([c, x, y, r]) => { ctx.fillStyle = rgba(c, 0.35); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
    ctx.restore();
    const planet = (x, y, r, c1, c2, ring) => {
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, c1); g.addColorStop(1, c2);
      if (ring) { ctx.strokeStyle = 'rgba(255,220,180,0.6)'; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.45, -0.3, Math.PI, TAU); ctx.stroke(); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (ring) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.45, -0.3, 0, Math.PI); ctx.stroke(); }
    };
    planet(120, 820, 170, '#ffb86a', '#6a2a0a', true); planet(1300, 420, 110, '#8ad8ff', '#0a2a6a', false); planet(1250, 1080, 70, '#ff8ad8', '#4a0a3a', true);
    emoji(ctx, '🛸', 1290, 180, 110, { rot: 0.15 }); emoji(ctx, '🚀', 110, 260, 120, { rot: 0.6 });
  }
};

// ---------------------------------------------------------------- patterns inside the reel panel
function pattern(ctx, kind, color) {
  ctx.save(); ctx.strokeStyle = rgba(color, 0.08); ctx.fillStyle = rgba(color, 0.05); ctx.lineWidth = 3;
  const { x, y, w, h } = P;
  if (kind === 'scales') for (let r = 0; r < h / 40 + 1; r++) for (let c = -1; c < w / 60 + 1; c++) { ctx.beginPath(); ctx.arc(x + c * 60 + (r % 2) * 30, y + r * 40, 34, 0, Math.PI); ctx.stroke(); }
  else if (kind === 'planks') { for (let yy = y; yy < y + h; yy += 70) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); for (let xx = x + ((yy / 70) % 2) * 150; xx < x + w; xx += 300) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 70); ctx.stroke(); } } }
  else if (kind === 'hex') for (let r = 0; r < h / 52 + 1; r++) for (let c = 0; c < w / 90 + 1; c++) { const cx = x + c * 90 + (r % 2) * 45, cy = y + r * 52; ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(cx + 30 * Math.cos(i * Math.PI / 3), cy + 30 * Math.sin(i * Math.PI / 3)); ctx.closePath(); ctx.stroke(); }
  else if (kind === 'waves') for (let r = 0; r < h / 36 + 1; r++) for (let c = -1; c < w / 72 + 1; c++) { const cx = x + c * 72 + (r % 2) * 36, cy = y + r * 36; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 12, Math.PI, TAU); ctx.stroke(); } }
  else if (kind === 'meander') for (let yy = y + 40; yy < y + h; yy += 120) for (let xx = x; xx < x + w; xx += 60) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 30); ctx.lineTo(xx + 40, yy - 30); ctx.lineTo(xx + 40, yy - 10); ctx.lineTo(xx + 20, yy - 10); ctx.stroke(); }
  else if (kind === 'runes') { ctx.font = '42px serif'; const R = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'; for (let yy = y + 60; yy < y + h; yy += 110) for (let xx = x + 30; xx < x + w; xx += 110) ctx.fillText(R[Math.floor(rnd() * R.length)], xx + ((yy / 110) % 2) * 55, yy); }
  else if (kind === 'damask') for (let r = 0; r < h / 110 + 1; r++) for (let c = 0; c < w / 110 + 1; c++) { const cx = x + c * 110 + (r % 2) * 55, cy = y + r * 110; ctx.beginPath(); ctx.moveTo(cx, cy - 40); ctx.bezierCurveTo(cx + 40, cy - 20, cx + 30, cy + 20, cx, cy + 40); ctx.bezierCurveTo(cx - 30, cy + 20, cx - 40, cy - 20, cx, cy - 40); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- stage
function drawStage(ctx, sk) {
  const a = sk.art; seed = [...sk.id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 2147483646 + 1;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a.sky[0]); g.addColorStop(0.55, a.sky[1]); g.addColorStop(1, a.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  glow(ctx, a.sun[0], a.sun[1], 460, a.sun[2], 0.55);
  if (a.scene !== 'underwater') { ctx.fillStyle = rgba(a.sun[2], 0.95); ctx.beginPath(); ctx.arc(a.sun[0], a.sun[1], a.scene === 'gothic' ? 130 : 70, 0, TAU); ctx.fill(); }
  SCENES[a.scene](ctx, a);

  // floor under the cabinet
  const fl = ctx.createLinearGradient(0, 1140, 0, H); fl.addColorStop(0, rgba(a.frame[2], 0.0)); fl.addColorStop(0.3, rgba(a.frame[2], 0.85)); fl.addColorStop(1, a.frame[2]);
  ctx.fillStyle = fl; ctx.fillRect(0, 1140, W, H - 1140);

  const F = a.frame;
  // pillars
  [[112, 1188], [1218, 1188]].forEach(([px]) => {
    const pg = ctx.createLinearGradient(px, 0, px + 70, 0); pg.addColorStop(0, F[2]); pg.addColorStop(0.35, F[0]); pg.addColorStop(0.6, F[1]); pg.addColorStop(1, F[2]);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.fillStyle = pg; ctx.fillRect(px, 360, 70, 790); ctx.restore();
    ctx.fillStyle = metal(ctx, px - 20, 330, px + 90, 380, F); rr(ctx, px - 18, 318, 106, 50, 10); ctx.fill();
    rr(ctx, px - 22, 1120, 114, 60, 10); ctx.fill();
    ctx.strokeStyle = rgba(F[2], 0.6); ctx.lineWidth = 3; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + k * 17.5, 380); ctx.lineTo(px + k * 17.5, 1110); ctx.stroke(); }
  });
  // cabinet frame
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  ctx.fillStyle = metal(ctx, 0, 206, 0, 1160, F); rr(ctx, 192, 204, 1016, 954, 42); ctx.fill(); ctx.restore();
  ctx.fillStyle = metal(ctx, 192, 0, 1208, 0, F); ctx.globalAlpha = 0.45; rr(ctx, 192, 204, 1016, 954, 42); ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineWidth = 4; ctx.strokeStyle = F[0]; rr(ctx, 200, 212, 1000, 938, 36); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(F[2], 0.9); rr(ctx, 214, 226, 972, 910, 30); ctx.stroke();
  // panel
  const pg = ctx.createRadialGradient(700, 640, 60, 700, 680, 640); pg.addColorStop(0, a.panel[0]); pg.addColorStop(1, a.panel[1]);
  ctx.fillStyle = pg; rr(ctx, P.x, P.y, P.w, P.h, 16); ctx.fill();
  ctx.save(); rr(ctx, P.x, P.y, P.w, P.h, 16); ctx.clip(); pattern(ctx, a.pattern, '#ffffff');
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 40; ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; rr(ctx, P.x - 15, P.y - 15, P.w + 30, P.h + 30, 26); ctx.stroke(); ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = metal(ctx, 0, P.y, 0, P.y + P.h, F); rr(ctx, P.x - 3, P.y - 3, P.w + 6, P.h + 6, 18); ctx.stroke();
  // corner jewels
  [[222, 234], [1178, 234], [222, 1128], [1178, 1128]].forEach(([x, y]) => {
    ctx.fillStyle = metal(ctx, x - 30, y - 30, x + 30, y + 30, F); ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
    const jg = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 18); jg.addColorStop(0, '#ffffff'); jg.addColorStop(0.35, a.gem); jg.addColorStop(1, mix(a.gem, '#000000', 0.6));
    ctx.fillStyle = jg; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
  });
  // decorations on the frame and pillars
  [300, 430, 970, 1100].forEach((x, i) => emoji(ctx, a.deco, x, 214, 64, { rot: (i % 2 ? 0.2 : -0.2) }));
  [[147, 560], [147, 820], [1253, 560], [1253, 820]].forEach(([x, y], i) => emoji(ctx, a.deco, x, y, 70, { rot: i % 2 ? 0.15 : -0.15 }));
  // crest + logo
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30;
  ctx.fillStyle = metal(ctx, 0, 70, 0, 270, F);
  ctx.beginPath(); ctx.moveTo(390, 250); ctx.lineTo(420, 120); ctx.quadraticCurveTo(700, 40, 980, 120); ctx.lineTo(1010, 250); ctx.quadraticCurveTo(700, 290, 390, 250); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = F[0]; ctx.stroke();
  const inner = ctx.createLinearGradient(0, 100, 0, 260); inner.addColorStop(0, mix(a.panel[0], '#000000', 0.2)); inner.addColorStop(1, a.panel[1]);
  ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(418, 240); ctx.lineTo(440, 134); ctx.quadraticCurveTo(700, 62, 960, 134); ctx.lineTo(982, 240); ctx.quadraticCurveTo(700, 272, 418, 240); ctx.closePath(); ctx.fill();
  emoji(ctx, a.giantEmblem, 470, 150, 58, { rot: -0.25 }); emoji(ctx, a.wildEmblem, 930, 150, 58, { rot: 0.25 });
  logo(ctx, sk.look.title, a.logo, sk.look.font);
}
function fitFont(ctx, text, font, size, maxW) { do { ctx.font = size + 'px "' + font + '"'; size -= 2; } while (ctx.measureText(text).width > maxW && size > 20); return size + 2; }
function logoText(ctx, text, x, y, size, font, L, maxW) {
  const s = fitFont(ctx, text, font, size, maxW);
  ctx.font = s + 'px "' + font + '"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.2; ctx.strokeStyle = 'rgba(20,6,2,0.95)';
  ctx.save(); ctx.shadowColor = L[1]; ctx.shadowBlur = 26; ctx.strokeText(text, x, y); ctx.restore();
  const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2); g.addColorStop(0, L[0]); g.addColorStop(0.5, L[1]); g.addColorStop(1, L[2]);
  ctx.lineWidth = s * 0.07; ctx.strokeStyle = L[0]; ctx.strokeText(text, x, y);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
}
function logo(ctx, title, L, font) {
  const [l1, l2] = title;
  if (l1) logoText(ctx, l1, 700, 138, 58, font, L, 440);
  logoText(ctx, l2, 700, 204, 92, font, L, 520);
}

// ---------------------------------------------------------------- giant portraits (400x1000)
function drawGiant(ctx, sk, kind) {
  const a = sk.art, GW = 400, GH = 1000, F = a.frame;
  const bg = kind === 'wild' ? a.wildBg : a.giantBg;
  const glyph = kind === 'wild' ? sk.wild[1] : sk.giant[1];
  const emblem = kind === 'wild' ? a.wildEmblem : a.giantEmblem;
  seed = (kind === 'wild' ? 99 : 7) + sk.id.length;
  ctx.clearRect(0, 0, GW, GH);
  ctx.fillStyle = metal(ctx, 0, 0, GW, GH, F); rr(ctx, 4, 4, GW - 8, GH - 8, 30); ctx.fill();
  ctx.save(); rr(ctx, 20, 20, GW - 40, GH - 40, 20); ctx.clip();
  const g = ctx.createRadialGradient(200, 360, 20, 200, 480, 620); g.addColorStop(0, bg[0]); g.addColorStop(0.55, mix(bg[0], bg[1], 0.6)); g.addColorStop(1, bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, GW, GH);
  ctx.save(); ctx.translate(200, 380); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, -90); ctx.lineTo(900, 90); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.08 + rnd() * 0.25) + ')'; ctx.beginPath(); ctx.arc(rnd() * GW, rnd() * GH, 3 + rnd() * 14, 0, TAU); ctx.fill(); }
  glow(ctx, 200, 420, 230, '#ffffff', 0.45);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(200, 610, 150, 26, 0, 0, TAU); ctx.fill();
  emoji(ctx, glyph, 200, 400, 370, { shadow: 0.55 });
  // emblem medallion
  ctx.fillStyle = metal(ctx, 110, 640, 290, 820, F); ctx.beginPath(); ctx.arc(200, 730, 92, 0, TAU); ctx.fill();
  const mg = ctx.createRadialGradient(185, 710, 10, 200, 730, 78); mg.addColorStop(0, mix(bg[0], '#ffffff', 0.4)); mg.addColorStop(1, bg[1]);
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(200, 730, 76, 0, TAU); ctx.fill();
  emoji(ctx, emblem, 200, 730, 112, { shadow: 0.4 });
  // vignette
  const v = ctx.createRadialGradient(200, 480, 250, 200, 480, 640); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, GW, GH);
  ctx.restore();
  // plate
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16;
  ctx.fillStyle = metal(ctx, 0, 850, 0, 960, F); rr(ctx, 30, 852, 340, 108, 22); ctx.fill(); ctx.restore();
  ctx.fillStyle = mix(a.panel[0], '#000000', 0.25); rr(ctx, 42, 864, 316, 84, 16); ctx.fill();
  const label = kind === 'wild' ? 'WILD' : sk.giant[0].toUpperCase();
  const L = kind === 'wild' ? ['#fff8d0', '#ffd23f', '#a05a00'] : a.logo;
  logoText(ctx, label, 200, 908, kind === 'wild' ? 74 : 52, kind === 'wild' ? 'Bungee' : sk.look.font, L, 290);
  // inner rim + corner jewels
  ctx.lineWidth = 4; ctx.strokeStyle = F[0]; rr(ctx, 20, 20, GW - 40, GH - 40, 20); ctx.stroke();
  [[26, 26], [GW - 26, 26], [26, GH - 26], [GW - 26, GH - 26], [26, 500], [GW - 26, 500]].forEach(([x, y]) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    const jg = ctx.createLinearGradient(-12, -12, 12, 12); jg.addColorStop(0, '#ffffff'); jg.addColorStop(0.4, a.gem); jg.addColorStop(1, mix(a.gem, '#000000', 0.6));
    ctx.fillStyle = jg; ctx.fillRect(-13, -13, 26, 26); ctx.strokeStyle = F[2]; ctx.lineWidth = 3; ctx.strokeRect(-13, -13, 26, 26); ctx.restore();
  });
}
`;

async function run(browser, { only = null, force = false } = {}) {
  const skins = GIANT_SKINS.filter((s) => !only || s.id === only);
  const glyphs = new Set(['🦇', '🐠', '🐟', '🛸', '🚀']);
  for (const s of skins) [s.giant[1], s.wild[1], s.art.deco, s.art.giantEmblem, s.art.wildEmblem].forEach((g) => glyphs.add(g));
  const page = await paintingPage(browser, { painter: [base, painter], fonts: FONTS, glyphs: [...glyphs] });
  for (const sk of skins) {
    if (sk.custom_art && !(force && only === sk.id)) {
      console.log(`- ${sk.id}: painted artwork, skipped (overwrite only with: gen-art.js ${sk.id} --force)`);
      continue;
    }
    const images = await page.evaluate((s) => {
      /* eslint-disable no-undef */
      const c = document.createElement('canvas'); c.width = 1400; c.height = 1254;
      drawStage(c.getContext('2d'), s);
      const out = { 'stage.jpg': c.toDataURL('image/jpeg', 0.9) };
      const g = document.createElement('canvas'); g.width = 400; g.height = 1000;
      drawGiant(g.getContext('2d'), s, 'giant'); out['giant.png'] = g.toDataURL('image/png');
      drawGiant(g.getContext('2d'), s, 'wild'); out['wild.png'] = g.toDataURL('image/png');
      return out;
    }, sk);
    console.log(`✔ ${sk.id}: ${writeImages(assetsDir(sk.id), images).join(', ')}`);
  }
  await page.close();
}

module.exports = { games: GIANT_SKINS.map((s) => s.id), run };
