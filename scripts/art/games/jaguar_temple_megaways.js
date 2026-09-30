/**
 * Paints the artwork of Jaguar Temple Megaways procedurally in headless Chromium:
 *   public/games/jaguar_temple_megaways/assets/stage.jpg      1400x1254 cabinet (jungle temple, stone frame, logo, empty panel)
 *   public/games/jaguar_temple_megaways/assets/sym_<id>.png   320x320 symbols (transparent)
 */
const base = require('../painter/base');
const carved = require('../painter/carved');

const painter = String.raw`
const SYM = {
  WILD(ctx) {
    ctx.save(); ctx.translate(160, 150);
    for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff9a1a'; ctx.beginPath(); ctx.moveTo(-18, -96); ctx.lineTo(0, -148); ctx.lineTo(18, -96); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    medallion(ctx, 160, 150, 104, GOLD, '#ff9a1a', '☀️');
    ctx.save(); ctx.fillStyle = metalGrad(ctx, 60, 238, 260, 300, ['#3a2a10', '#1a1006', '#000000']); ctx.beginPath(); ctx.roundRect(58, 236, 204, 62, 16); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); ctx.restore();
    carvedText(ctx, 'WILD', 160, 268, 54, ['#fff8d0', '#ffd23f', '#a05a00']);
  },
  SCATTER(ctx) {
    const g = ctx.createRadialGradient(160, 150, 10, 160, 150, 160); g.addColorStop(0, 'rgba(120,255,190,0.8)'); g.addColorStop(1, 'rgba(120,255,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 320);
    stepPyramid(ctx, 160, 250, 250, 150, '#a89a72', '#5a5038', 5);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(126, 64, 68, 36);
    emoji(ctx, '🐍', 160, 150, 60);
    ctx.save(); ctx.fillStyle = metalGrad(ctx, 40, 254, 280, 306, ['#0a5a3a', '#063a24', '#021a10']); ctx.beginPath(); ctx.roundRect(38, 252, 244, 54, 14); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#3ddc97'; ctx.stroke(); ctx.restore();
    carvedText(ctx, 'SCATTER', 160, 280, 40, ['#e8fff4', '#3ddc97', '#0a6a3a']);
  },
  JAGUAR(ctx) { medallion(ctx, 160, 160, 138, GOLD, '#e07a1a', '🐆'); },
  IDOL(ctx) { medallion(ctx, 160, 160, 132, ['#f4f6fa', '#a8b0c0', '#4a5060'], '#5a6a8a', '🗿'); },
  SERPENT(ctx) { medallion(ctx, 160, 160, 128, ['#d8ffe8', '#2aa86a', '#0a4a2a'], '#0a6a3a', '🐍'); },
  EAGLE(ctx) { medallion(ctx, 160, 160, 124, ['#ffd8b0', '#b0703a', '#4a2a08'], '#8a3a10', '🦅'); },
  JADE(ctx) { gem(ctx, 160, 160, 104, '#22c46b', [...Array(6)].map((_, i) => [Math.cos(Math.PI / 6 + i * Math.PI / 3), Math.sin(Math.PI / 6 + i * Math.PI / 3)])); },
  RUBY(ctx) { gem(ctx, 160, 160, 104, '#e8283f', [...Array(8)].map((_, i) => [Math.cos(Math.PI / 8 + i * Math.PI / 4) * 0.95, Math.sin(Math.PI / 8 + i * Math.PI / 4) * 1.02])); },
  TOPAZ(ctx) { gem(ctx, 160, 172, 110, '#ffb020', [[0, -1.02], [1, 0.72], [-1, 0.72]]); },
  SAPPHIRE(ctx) { gem(ctx, 160, 160, 110, '#2f7cf0', [[0, -1.05], [0.72, 0], [0, 1.05], [-0.72, 0]]); }
};

function drawStage(ctx, P) {
  const W = 1400, H = 1254; seed = 21;
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0a2a3a'); sky.addColorStop(0.4, '#1a6a6a'); sky.addColorStop(0.7, '#e89a4a'); sky.addColorStop(1, '#3a2a10');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(700, 560, 10, 700, 560, 560); sun.addColorStop(0, 'rgba(255,220,140,0.9)'); sun.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.filter = 'blur(16px)'; for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(255,230,200,' + (0.15 + rnd() * 0.2) + ')'; ctx.beginPath(); ctx.ellipse(rnd() * W, 80 + rnd() * 380, 160 + rnd() * 200, 30 + rnd() * 30, 0, 0, TAU); ctx.fill(); } ctx.restore();
  // distant pyramids + mist
  stepPyramid(ctx, 700, 700, 1100, 460, '#5a5a4a', '#3a3a2e', 8);
  stepPyramid(ctx, 150, 820, 520, 300, '#4a4a3a', '#2e2e22', 6);
  stepPyramid(ctx, 1260, 820, 560, 320, '#4a4a3a', '#2e2e22', 6);
  ctx.save(); ctx.filter = 'blur(30px)'; ctx.fillStyle = 'rgba(200,230,210,0.35)'; ctx.fillRect(0, 760, W, 180); ctx.restore();
  // jungle canopy
  const greens = ['#1a5a2a', '#2a7a3a', '#0f4a20', '#3a8a3a'];
  for (let i = 0; i < 90; i++) { const side = i % 2 ? 1 : 0; const x = side ? W - rnd() * 330 : rnd() * 330; const y = 120 + rnd() * 1100; leaf(ctx, x, y, 120 + rnd() * 160, side ? Math.PI + (rnd() - 0.3) * 1.4 : (rnd() - 0.7) * 1.4, greens[i % 4]); }
  for (let i = 0; i < 40; i++) { const x = rnd() * W; leaf(ctx, x, -10, 100 + rnd() * 140, Math.PI / 2 + (rnd() - 0.5) * 1.2, greens[i % 4]); }
  for (let i = 0; i < 50; i++) { const x = rnd() * W; leaf(ctx, x, H + 10, 120 + rnd() * 160, -Math.PI / 2 + (rnd() - 0.5) * 1.4, greens[i % 4]); }
  // torches
  [[250, 520], [1150, 520]].forEach(([x, y]) => {
    ctx.fillStyle = metalGrad(ctx, x - 16, 0, x + 16, 0, STONE); ctx.fillRect(x - 14, y, 28, 180);
    ctx.fillStyle = metalGrad(ctx, x - 34, 0, x + 34, 0, GOLD); ctx.beginPath(); ctx.moveTo(x - 34, y); ctx.lineTo(x + 34, y); ctx.lineTo(x + 20, y + 30); ctx.lineTo(x - 20, y + 30); ctx.closePath(); ctx.fill();
    const f = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 110); f.addColorStop(0, 'rgba(255,240,160,1)'); f.addColorStop(0.3, 'rgba(255,140,30,0.8)'); f.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y - 30, 110, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.quadraticCurveTo(x - 24, y - 50, x, y - 90); ctx.quadraticCurveTo(x + 24, y - 50, x + 22, y); ctx.closePath(); ctx.fill();
  });
  // stone frame with carved band and gold inlays
  const F = { x: P.x - 56, y: P.y - 56, w: P.w + 112, h: P.h + 112 };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.fillStyle = metalGrad(ctx, F.x, F.y, F.x + F.w, F.y + F.h, STONE); ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 18); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 18); ctx.rect(P.x - 14, P.y - 14, P.w + 28, P.h + 28); ctx.clip('evenodd');
  for (let i = 0; i < 1400; i++) { ctx.fillStyle = 'rgba(0,0,0,' + rnd() * 0.12 + ')'; ctx.fillRect(F.x + rnd() * F.w, F.y + rnd() * F.h, 2 + rnd() * 4, 2 + rnd() * 4); }
  // carved step-fret pattern
  ctx.strokeStyle = 'rgba(40,30,10,0.55)'; ctx.lineWidth = 4;
  const fret = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s * 0.6); ctx.lineTo(x + s * 0.4, y + s * 0.6); ctx.lineTo(x + s * 0.4, y + s * 0.3); ctx.stroke(); };
  for (let x = F.x + 14; x < F.x + F.w - 30; x += 40) { fret(x, F.y + 10, 26); fret(x, F.y + F.h - 36, 26); }
  for (let y = F.y + 54; y < F.y + F.h - 60; y += 40) { fret(F.x + 12, y, 26); fret(F.x + F.w - 38, y, 26); }
  ctx.restore();
  ctx.lineWidth = 8; ctx.strokeStyle = metalGrad(ctx, 0, P.y, 0, P.y + P.h, GOLD); ctx.beginPath(); ctx.roundRect(P.x - 12, P.y - 12, P.w + 24, P.h + 24, 10); ctx.stroke();
  // panel
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, '#16261a'); pg.addColorStop(1, '#070e09');
  ctx.fillStyle = pg; ctx.fillRect(P.x - 8, P.y - 8, P.w + 16, P.h + 16);
  ctx.save(); ctx.beginPath(); ctx.rect(P.x - 8, P.y - 8, P.w + 16, P.h + 16); ctx.clip();
  ctx.strokeStyle = 'rgba(80,140,90,0.10)'; ctx.lineWidth = 3;
  for (let k = 0; k < 40; k++) { const y = P.y + k * 28; ctx.beginPath(); ctx.moveTo(P.x, y); for (let x = P.x; x <= P.x + P.w; x += 28) ctx.lineTo(x, y + ((x / 28) % 2 ? 10 : 0)); ctx.stroke(); }
  ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 40; ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeRect(P.x - 23, P.y - 23, P.w + 46, P.h + 46);
  ctx.restore();
  // corner jade stones
  [[F.x + 28, F.y + 28], [F.x + F.w - 28, F.y + 28], [F.x + 28, F.y + F.h - 28], [F.x + F.w - 28, F.y + F.h - 28]].forEach(([x, y]) => { gem(ctx, x, y, 22, '#22c46b', [...Array(6)].map((_, i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)])); });
  // crest + logo
  const cy = P.y - 110;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30;
  ctx.fillStyle = metalGrad(ctx, 0, cy - 110, 0, cy + 110, STONE);
  ctx.beginPath(); ctx.moveTo(360, cy + 90); ctx.lineTo(420, cy - 40); ctx.lineTo(520, cy - 40); ctx.lineTo(560, cy - 100); ctx.lineTo(840, cy - 100); ctx.lineTo(880, cy - 40); ctx.lineTo(980, cy - 40); ctx.lineTo(1040, cy + 90); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = metalGrad(ctx, 360, 0, 1040, 0, GOLD); ctx.stroke();
  medallion(ctx, 700, cy - 118, 56, GOLD, '#e07a1a', '🐆');
  carvedText(ctx, 'JAGUAR TEMPLE', 700, cy + 4, 70, ['#fff6c8', '#ffcf4a', '#8a5a06']);
  carvedText(ctx, 'MEGAWAYS', 700, cy + 64, 46, ['#e8fff4', '#3ddc97', '#0a6a3a']);
}
`;

module.exports = {
  game: 'jaguar_temple_megaways',
  stage: { width: 1400, height: 1254 },
  // Reel panel inside the stage picture (6 x 7 square cells) — keep in sync with theme.stage.reels
  panel: { x: 350, y: 272, w: 700, h: 816 },
  fonts: [{ family: 'Cinzel', weight: 900, file: 'cinzel-latin-900-normal.woff2' }],
  glyphs: ['🐆', '🗿', '🐍', '🦅', '☀️'],
  symbolSeed: 9,
  painter: [base, carved, painter]
};
