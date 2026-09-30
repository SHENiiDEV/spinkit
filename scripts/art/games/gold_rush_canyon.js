/**
 * Paints the artwork of Gold Rush Canyon procedurally in headless Chromium:
 *   public/games/gold_rush_canyon/assets/stage.jpg      1400x1254 cabinet (canyon at sunset, wooden frame, logo, empty 7x8 panel)
 *   public/games/gold_rush_canyon/assets/sym_<id>.png   320x320 symbols (transparent); A-9 stay procedural
 */
const base = require('../painter/base');
const carved = require('../painter/carved');

const painter = String.raw`
TITLE_FONT = '400 {size}px "Rye"';
const WOOD = ['#d8a060', '#8a4a1a', '#3a1a06'];
const COPPER = ['#ffd8b0', '#b0602a', '#4a1a04'];
function sheriffStar(ctx, cx, cy, R) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = R * 0.15; ctx.shadowOffsetY = R * 0.06;
  ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i * Math.PI / 6; const r = i % 2 ? R * 0.55 : R; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, cx - R, cy - R, cx + R, cy + R, GOLD); ctx.fill(); ctx.restore();
  ctx.lineWidth = R * 0.05; ctx.strokeStyle = '#6a3a04'; ctx.stroke();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; ctx.fillStyle = metalGrad(ctx, x - 12, y - 12, x + 12, y + 12, GOLD); ctx.beginPath(); ctx.arc(x, y, R * 0.12, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, TAU); ctx.fillStyle = metalGrad(ctx, cx + R, cy - R, cx - R, cy + R, GOLD); ctx.fill(); ctx.lineWidth = R * 0.04; ctx.strokeStyle = '#6a3a04'; ctx.stroke();
}
const SYM = {
  WILD(ctx) {
    const g = ctx.createRadialGradient(160, 130, 10, 160, 130, 150); g.addColorStop(0, 'rgba(255,160,60,0.9)'); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 320);
    emoji(ctx, '🧨', 160, 132, 210);
    ctx.save(); ctx.fillStyle = metalGrad(ctx, 60, 238, 260, 300, ['#6a2a0a', '#3a1204', '#120400']); ctx.beginPath(); ctx.roundRect(58, 236, 204, 62, 12); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffcf3a'; ctx.stroke(); ctx.restore();
    carvedText(ctx, 'WILD', 160, 268, 52, ['#fff8d0', '#ffd23f', '#a05a00']);
  },
  SCATTER(ctx) {
    const g = ctx.createRadialGradient(160, 150, 10, 160, 150, 160); g.addColorStop(0, 'rgba(255,230,120,0.9)'); g.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 320);
    sheriffStar(ctx, 160, 140, 118);
    carvedText(ctx, 'SHERIFF', 160, 142, 30, ['#fff8d0', '#ffd23f', '#8a5006']);
    ctx.save(); ctx.fillStyle = metalGrad(ctx, 40, 254, 280, 306, ['#6a2a0a', '#3a1204', '#120400']); ctx.beginPath(); ctx.roundRect(38, 256, 244, 50, 12); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffcf3a'; ctx.stroke(); ctx.restore();
    carvedText(ctx, 'SCATTER', 160, 282, 34, ['#fff8d0', '#ffd23f', '#a05a00']);
  },
  SHERIFF(ctx) { medallion(ctx, 160, 160, 138, GOLD, '#8a3a0a', '🤠'); },
  HORSE(ctx) { medallion(ctx, 160, 160, 132, COPPER, '#4a2a10', '🐎'); },
  BOOTS(ctx) { medallion(ctx, 160, 160, 128, WOOD, '#3a1a06', '👢'); },
  GOLD(ctx) { medallion(ctx, 160, 160, 124, ['#f4f6fa', '#a8b0c0', '#4a5060'], '#5a3a10', '💰'); }
};

function drawStage(ctx, P) {
  const W = 1400, H = 1254; seed = 41;
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2a1450'); sky.addColorStop(0.35, '#c0482a'); sky.addColorStop(0.62, '#ffb24a'); sky.addColorStop(1, '#6a2a0a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(700, 640, 20, 700, 640, 600); sun.addColorStop(0, 'rgba(255,240,170,0.95)'); sun.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.filter = 'blur(10px)'; for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(255,190,150,' + (0.2 + rnd() * 0.25) + ')'; ctx.beginPath(); ctx.ellipse(rnd() * W, 80 + rnd() * 360, 160 + rnd() * 200, 18 + rnd() * 20, 0, 0, TAU); ctx.fill(); } ctx.restore();
  const mesa = (x, base, w, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w / 2 - 70, base); ctx.lineTo(x - w / 2, base - h); ctx.lineTo(x + w / 2, base - h); ctx.lineTo(x + w / 2 + 70, base); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + w / 5, base - h, w / 3, h); for (let k = 1; k < 5; k++) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x - w / 2 - 10 * k, base - h + k * h / 5, w + 20 * k, 6); } };
  mesa(150, 800, 330, 380, '#8a3a1e'); mesa(1250, 790, 360, 420, '#94401e'); mesa(560, 760, 220, 180, '#6a2a14'); mesa(900, 760, 240, 200, '#6a2a14');
  ctx.fillStyle = '#c0703a'; ctx.fillRect(0, 780, W, 480);
  const dg = ctx.createLinearGradient(0, 780, 0, H); dg.addColorStop(0, '#d88a4a'); dg.addColorStop(1, '#5a2a0e'); ctx.fillStyle = dg; ctx.fillRect(0, 780, W, 480);
  // saloon silhouettes
  ctx.fillStyle = '#2a1206';
  [[60, 900, 200, 170], [1180, 900, 220, 190]].forEach(([x, b, w, h]) => { ctx.fillRect(x - w / 2, b - h, w, h); ctx.fillRect(x - w / 2 - 10, b - h - 40, w + 20, 44); ctx.fillStyle = 'rgba(255,200,90,0.8)'; ctx.fillRect(x - 50, b - h + 50, 30, 36); ctx.fillRect(x + 20, b - h + 50, 30, 36); ctx.fillStyle = '#2a1206'; });
  // cacti
  const cactus = (x, base, h) => { ctx.fillStyle = '#2a6a2a'; ctx.beginPath(); ctx.roundRect(x - h * 0.08, base - h, h * 0.16, h, h * 0.08); ctx.fill(); ctx.beginPath(); ctx.roundRect(x - h * 0.32, base - h * 0.7, h * 0.12, h * 0.36, h * 0.06); ctx.fill(); ctx.fillRect(x - h * 0.3, base - h * 0.4, h * 0.25, h * 0.1); ctx.beginPath(); ctx.roundRect(x + h * 0.2, base - h * 0.8, h * 0.12, h * 0.4, h * 0.06); ctx.fill(); ctx.fillRect(x + h * 0.05, base - h * 0.48, h * 0.25, h * 0.1); };
  cactus(90, 1180, 300); cactus(1320, 1200, 320); cactus(230, 1230, 170); cactus(1180, 1240, 160);
  // tumbleweed dots
  for (let i = 0; i < 160; i++) { ctx.fillStyle = 'rgba(80,30,10,' + rnd() * 0.3 + ')'; ctx.fillRect(rnd() * W, 900 + rnd() * 350, 3, 3); }
  // wooden frame with gold nails
  const F = { x: P.x - 58, y: P.y - 58, w: P.w + 116, h: P.h + 116 };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#6a3410'; ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 16); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 16); ctx.rect(P.x - 12, P.y - 12, P.w + 24, P.h + 24); ctx.clip('evenodd');
  for (let y = F.y; y < F.y + F.h; y += 29) { const g = ctx.createLinearGradient(0, y, 0, y + 29); g.addColorStop(0, '#b0682a'); g.addColorStop(0.5, '#8a4a1a'); g.addColorStop(1, '#5a2a0a'); ctx.fillStyle = g; ctx.fillRect(F.x, y, F.w, 28); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(F.x, y + 27, F.w, 2); }
  for (let i = 0; i < 260; i++) { ctx.strokeStyle = 'rgba(40,15,0,0.25)'; ctx.lineWidth = 1.5; const x = F.x + rnd() * F.w, y = F.y + rnd() * F.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 20, y + 3, x + 40, y - 3, x + 70, y); ctx.stroke(); }
  ctx.restore();
  for (let x = F.x + 24; x < F.x + F.w - 10; x += 60) [F.y + 22, F.y + F.h - 22].forEach((y) => { ctx.fillStyle = metalGrad(ctx, x - 8, y - 8, x + 8, y + 8, GOLD); ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); });
  for (let y = F.y + 70; y < F.y + F.h - 50; y += 60) [F.x + 22, F.x + F.w - 22].forEach((x) => { ctx.fillStyle = metalGrad(ctx, x - 8, y - 8, x + 8, y + 8, GOLD); ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); });
  ctx.lineWidth = 8; ctx.strokeStyle = metalGrad(ctx, 0, P.y, 0, P.y + P.h, GOLD); ctx.beginPath(); ctx.roundRect(P.x - 10, P.y - 10, P.w + 20, P.h + 20, 10); ctx.stroke();
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, '#3b2412'); pg.addColorStop(1, '#1a0c04');
  ctx.fillStyle = pg; ctx.fillRect(P.x - 6, P.y - 6, P.w + 12, P.h + 12);
  ctx.save(); ctx.beginPath(); ctx.rect(P.x - 6, P.y - 6, P.w + 12, P.h + 12); ctx.clip();
  const cw = P.w / 7, ch = P.h / 8;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) { ctx.fillStyle = (r + c) % 2 ? 'rgba(255,220,160,0.05)' : 'rgba(255,220,160,0.09)'; ctx.fillRect(P.x + c * cw + 2, P.y + r * ch + 2, cw - 4, ch - 4); }
  ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 40; ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeRect(P.x - 21, P.y - 21, P.w + 42, P.h + 42);
  ctx.restore();
  // hanging wooden sign with the logo
  const cy = P.y - 150;
  ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(470, P.y - 60); ctx.lineTo(500, cy - 70); ctx.moveTo(930, P.y - 60); ctx.lineTo(900, cy - 70); ctx.stroke();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30; ctx.fillStyle = '#7a3c12'; ctx.beginPath(); ctx.moveTo(400, cy - 80); ctx.lineTo(1000, cy - 80); ctx.lineTo(1030, cy); ctx.lineTo(1000, cy + 80); ctx.lineTo(400, cy + 80); ctx.lineTo(370, cy); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.clip();
  for (let y = cy - 80; y < cy + 80; y += 32) { const g = ctx.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, '#c07a3a'); g.addColorStop(1, '#6a3010'); ctx.fillStyle = g; ctx.fillRect(360, y, 680, 31); }
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = metalGrad(ctx, 370, 0, 1030, 0, GOLD); ctx.beginPath(); ctx.moveTo(400, cy - 80); ctx.lineTo(1000, cy - 80); ctx.lineTo(1030, cy); ctx.lineTo(1000, cy + 80); ctx.lineTo(400, cy + 80); ctx.lineTo(370, cy); ctx.closePath(); ctx.stroke();
  sheriffStar(ctx, 430, cy, 42); sheriffStar(ctx, 970, cy, 42);
  carvedText(ctx, 'GOLD RUSH', 700, cy - 22, 76, ['#fff6c8', '#ffcf4a', '#8a5a06']);
  carvedText(ctx, 'CANYON', 700, cy + 44, 50, ['#ffe0c0', '#ff8a3a', '#7a2a06']);
}
`;

module.exports = {
  game: 'gold_rush_canyon',
  stage: { width: 1400, height: 1254 },
  // Reel panel inside the stage picture (7 x 8 square cells) — keep in sync with theme.stage.reels
  panel: { x: 336, y: 300, w: 728, h: 832 },
  fonts: [{ family: 'Rye', file: 'rye-latin-400-normal.woff2' }],
  glyphs: ['🤠', '🐎', '👢', '💰', '🧨'],
  symbolSeed: 9,
  painter: [base, carved, painter]
};
