/**
 * Paints the artwork of Wolf Moon Hold & Win procedurally in headless Chromium:
 *   public/games/wolf_moon_holdwin/assets/stage.jpg      1400x1050 cabinet (moonlit forest, silver frame, logo, empty 5x3 panel)
 *   public/games/wolf_moon_holdwin/assets/sym_<id>.png   320x320 symbols (transparent); coins are drawn live by the client
 */
const base = require('../painter/base');
const carved = require('../painter/carved');

const painter = String.raw`
const SILVER = ['#ffffff', '#a8b8d8', '#3a4a6a'];
const SYM = {
  WILD(ctx) {
    const g = ctx.createRadialGradient(160, 140, 10, 160, 140, 150); g.addColorStop(0, 'rgba(200,220,255,0.9)'); g.addColorStop(1, 'rgba(200,220,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 320);
    medallion(ctx, 160, 146, 112, SILVER, '#1a2a5a', '🐺');
    ctx.save(); ctx.fillStyle = metalGrad(ctx, 60, 238, 260, 300, ['#2a3a6a', '#101830', '#000000']); ctx.beginPath(); ctx.roundRect(58, 236, 204, 62, 16); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#cfe0ff'; ctx.stroke(); ctx.restore();
    carvedText(ctx, 'WILD', 160, 268, 54, ['#ffffff', '#cfe0ff', '#5a7ab0']);
  },
  BISON(ctx) { medallion(ctx, 160, 160, 138, GOLD, '#6a3a1a', '🦬'); },
  BEAR(ctx) { medallion(ctx, 160, 160, 132, ['#ffd8b0', '#b0703a', '#4a2a08'], '#3a1a0a', '🐻'); },
  EAGLE(ctx) { medallion(ctx, 160, 160, 128, SILVER, '#2a3a6a', '🦅'); },
  DEER(ctx) { medallion(ctx, 160, 160, 124, ['#d8ffe8', '#2aa86a', '#0a4a2a'], '#0a3a2a', '🦌'); }
};

function pine(ctx, x, base, h, c) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, base - h);
  for (let i = 1; i <= 5; i++) { const y = base - h + (h * i) / 5.4; const w = h * 0.08 * i; ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.45, y - h * 0.02); }
  ctx.lineTo(x + h * 0.04, base); ctx.lineTo(x - h * 0.04, base);
  for (let i = 5; i >= 1; i--) { const y = base - h + (h * i) / 5.4; const w = h * 0.08 * i; ctx.lineTo(x - w * 0.45, y - h * 0.02); ctx.lineTo(x - w, y); }
  ctx.closePath(); ctx.fill();
}

function drawStage(ctx, P) {
  const W = 1400, H = 1050; seed = 31;
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#02040e'); sky.addColorStop(0.5, '#0f1c48'); sky.addColorStop(1, '#1a2a5a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.8) + ')'; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H * 0.7, rnd() * 1.8, 0, TAU); ctx.fill(); }
  // moon
  const mx = 1270, my = 150;
  const halo = ctx.createRadialGradient(mx, my, 60, mx, my, 420); halo.addColorStop(0, 'rgba(210,225,255,0.55)'); halo.addColorStop(1, 'rgba(210,225,255,0)'); ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  const mg = ctx.createRadialGradient(mx - 30, my - 30, 10, mx, my, 120); mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.7, '#e6ecff'); mg.addColorStop(1, '#b8c4e8');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 120, 0, TAU); ctx.fill();
  [[-40, -20, 22], [30, 30, 16], [20, -50, 12], [-20, 50, 10]].forEach(([dx, dy, r]) => { ctx.fillStyle = 'rgba(150,160,200,0.35)'; ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); });
  // mountains
  const range = (base, amp, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H); let x = 0; while (x <= W) { ctx.lineTo(x, base - amp * (0.3 + rnd() * 0.7)); x += 80 + rnd() * 90; } ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); };
  range(620, 260, '#16244e'); range(720, 200, '#0e1838');
  ctx.save(); ctx.filter = 'blur(24px)'; ctx.fillStyle = 'rgba(140,170,230,0.25)'; ctx.fillRect(0, 700, W, 120); ctx.restore();
  for (let i = 0; i < 60; i++) { const x = rnd() * W; pine(ctx, x, 900 + rnd() * 60, 180 + rnd() * 160, i % 2 ? '#070d22' : '#0a1230'); }
  ctx.fillStyle = '#050a18'; ctx.fillRect(0, 930, W, H - 930);
  // howling wolf on a rock (silhouette of the Twemoji wolf)
  ctx.fillStyle = '#060b1c'; ctx.beginPath(); ctx.moveTo(1210, 640); ctx.lineTo(1300, 590); ctx.lineTo(1400, 600); ctx.lineTo(1400, 700); ctx.lineTo(1200, 700); ctx.closePath(); ctx.fill();
  if (imgs['🐺']) { ctx.save(); ctx.filter = 'brightness(0.08)'; ctx.translate(1300, 530); ctx.rotate(-0.35); ctx.drawImage(imgs['🐺'], -75, -75, 150, 150); ctx.restore(); }
  ctx.fillStyle = '#060b1c'; ctx.beginPath(); ctx.moveTo(0, 700); ctx.lineTo(0, 610); ctx.lineTo(120, 580); ctx.lineTo(200, 640); ctx.lineTo(200, 700); ctx.closePath(); ctx.fill();
  // frame: moon silver with sapphire moonstones
  const F = { x: P.x - 50, y: P.y - 50, w: P.w + 100, h: P.h + 100 };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.fillStyle = metalGrad(ctx, F.x, F.y, F.x, F.y + F.h, SILVER); ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 30); ctx.fill(); ctx.restore();
  ctx.fillStyle = metalGrad(ctx, F.x, 0, F.x + F.w, 0, SILVER); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 30); ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(F.x + 8, F.y + 8, F.w - 16, F.h - 16, 24); ctx.stroke();
  ctx.lineWidth = 7; ctx.strokeStyle = metalGrad(ctx, 0, P.y, 0, P.y + P.h, GOLD); ctx.beginPath(); ctx.roundRect(P.x - 10, P.y - 10, P.w + 20, P.h + 20, 14); ctx.stroke();
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, '#101a3e'); pg.addColorStop(1, '#050918');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(P.x - 6, P.y - 6, P.w + 12, P.h + 12, 10); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(P.x - 6, P.y - 6, P.w + 12, P.h + 12); ctx.clip();
  for (let c = 1; c < 5; c++) { ctx.fillStyle = 'rgba(150,180,255,0.08)'; ctx.fillRect(P.x + (P.w / 5) * c - 1, P.y, 2, P.h); }
  ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 40; ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeRect(P.x - 21, P.y - 21, P.w + 42, P.h + 42);
  ctx.restore();
  [[F.x + 26, F.y + 26], [F.x + F.w - 26, F.y + 26], [F.x + 26, F.y + F.h - 26], [F.x + F.w - 26, F.y + F.h - 26], [F.x + F.w / 2, F.y + F.h - 14]].forEach(([x, y]) => gem(ctx, x, y, 20, '#3a6aff', [...Array(8)].map((_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)])));
  // logo plaque
  const cy = P.y - 118;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30;
  ctx.fillStyle = metalGrad(ctx, 0, cy - 100, 0, cy + 100, ['#2a3a6a', '#101830', '#050814']);
  ctx.beginPath(); ctx.moveTo(380, cy + 92); ctx.lineTo(430, cy - 70); ctx.quadraticCurveTo(700, cy - 140, 970, cy - 70); ctx.lineTo(1020, cy + 92); ctx.quadraticCurveTo(700, cy + 120, 380, cy + 92); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = metalGrad(ctx, 380, 0, 1020, 0, SILVER); ctx.stroke();
  carvedText(ctx, 'WOLF MOON', 700, cy - 12, 92, ['#ffffff', '#cfe0ff', '#6a8ac8']);
  carvedText(ctx, 'HOLD & WIN', 700, cy + 62, 50, ['#fff6c8', '#ffcf4a', '#8a5a06']);
}
`;

module.exports = {
  game: 'wolf_moon_holdwin',
  stage: { width: 1400, height: 1050 },
  // Reel panel inside the stage picture (5 x 3) — keep in sync with theme.stage.reels
  panel: { x: 240, y: 318, w: 920, h: 552 },
  fonts: [{ family: 'Cinzel', weight: 900, file: 'cinzel-latin-900-normal.woff2' }],
  glyphs: ['🐺', '🦬', '🐻', '🦅', '🦌'],
  symbolSeed: 9,
  painter: [base, carved, painter]
};
