/**
 * Browser-side "carved" cabinet kit: metal gradients, medallions, faceted gems, step pyramids,
 * leaves and carved titles. Set TITLE_FONT (e.g. '900 {size}px "Cinzel"') before carvedText.
 */
module.exports = String.raw`
let TITLE_FONT = '900 {size}px "Cinzel"';
function emoji(ctx, g, x, y, s, alpha = 1) { const im = imgs[g]; if (!im) return; ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = s * 0.06; ctx.shadowOffsetY = s * 0.03; ctx.drawImage(im, x - s / 2, y - s / 2, s, s); ctx.restore(); }
function metalGrad(ctx, x0, y0, x1, y1, m) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, m[0]); g.addColorStop(0.25, m[1]); g.addColorStop(0.5, m[0]); g.addColorStop(0.75, m[2]); g.addColorStop(1, m[1]);
  return g;
}
const GOLD = ['#fff1b0', '#d9a33a', '#7a4a08'];
const STONE = ['#c9c2a8', '#8a846a', '#3e3a2c'];

/** Carved medallion: rim with notches, inner disc, emoji relief. */
function medallion(ctx, cx, cy, R, metal, inner, glyph) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = R * 0.12; ctx.shadowOffsetY = R * 0.05;
  ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const r = i % 2 ? R : R * 0.94; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, cx - R, cy - R, cx + R, cy + R, metal); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, 0, TAU); ctx.fillStyle = metalGrad(ctx, cx + R, cy - R, cx - R, cy + R, metal); ctx.fill();
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.fillStyle = darken(metal[1], 0.35); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72, R * 0.035, 0, TAU); ctx.fill(); }
  const ig = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.05, cx, cy, R * 0.66); ig.addColorStop(0, lighten(inner, 0.35)); ig.addColorStop(1, darken(inner, 0.45));
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.64, 0, TAU); ctx.fillStyle = ig; ctx.fill(); ctx.lineWidth = R * 0.04; ctx.strokeStyle = darken(metal[1], 0.5); ctx.stroke();
  emoji(ctx, glyph, cx, cy, R * 1.05);
  const s = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, 0, cx - R * 0.4, cy - R * 0.5, R * 0.8); s.addColorStop(0, 'rgba(255,255,255,0.45)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
}
function gem(ctx, cx, cy, R, color, poly) {
  const pts = poly.map(([x, y]) => [cx + x * R, cy + y * R]);
  const bez = poly.map(([x, y]) => [cx + x * R * 1.16, cy + y * R * 1.16]);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = R * 0.15; ctx.shadowOffsetY = R * 0.06;
  ctx.beginPath(); bez.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, cx - R, cy - R, cx + R, cy + R, GOLD); ctx.fill(); ctx.restore();
  bez.forEach(([x, y]) => { ctx.fillStyle = metalGrad(ctx, x - 8, y - 8, x + 8, y + 8, GOLD); ctx.beginPath(); ctx.arc(x, y, R * 0.07, 0, TAU); ctx.fill(); });
  const inner = poly.map(([x, y]) => [cx + x * R * 0.5, cy + y * R * 0.5 - R * 0.04]);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length; const mx = (pts[i][0] + pts[j][0]) / 2 - cx, my = (pts[i][1] + pts[j][1]) / 2 - cy;
    const t = Math.max(-1, Math.min(1, (-mx - my * 1.4) / (R * 1.6)));
    ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[j]); ctx.lineTo(...inner[j]); ctx.lineTo(...inner[i]); ctx.closePath();
    ctx.fillStyle = t > 0 ? lighten(color, t * 0.6) : darken(color, -t * 0.55); ctx.fill();
  }
  ctx.beginPath(); inner.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  const tg = ctx.createLinearGradient(cx - R * 0.5, cy - R * 0.5, cx + R * 0.5, cy + R * 0.5); tg.addColorStop(0, lighten(color, 0.65)); tg.addColorStop(1, color); ctx.fillStyle = tg; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(cx - R * 0.3, cy - R * 0.28); ctx.lineTo(cx - R * 0.12, cy - R * 0.34); ctx.lineTo(cx - R * 0.22, cy - R * 0.12); ctx.closePath(); ctx.fill();
}
function stepPyramid(ctx, cx, base, w, h, c1, c2, steps = 6) {
  for (let i = 0; i < steps; i++) {
    const sw = w * (1 - i / (steps + 1.2)), sh = h / steps, y = base - (i + 1) * sh;
    const g = ctx.createLinearGradient(cx - sw / 2, 0, cx + sw / 2, 0); g.addColorStop(0, c1); g.addColorStop(0.7, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(cx - sw / 2, y, sw, sh + 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - sw / 2, y + sh - 4, sw, 4);
  }
  const tw = w * 0.2, th = h * 0.22, ty = base - h - th;
  ctx.fillStyle = c1; ctx.fillRect(cx - tw / 2, ty, tw, th); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - tw * 0.15, ty + th * 0.35, tw * 0.3, th * 0.65);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(cx - w * 0.06, base - h, w * 0.12, h);
}
function leaf(ctx, x, y, len, ang, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, darken(color, 0.3)); g.addColorStop(1, lighten(color, 0.15));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); ctx.fill();
  ctx.strokeStyle = rgba('#0a2a10', 0.5); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
  ctx.restore();
}
function carvedText(ctx, t, x, y, size, fill) {
  ctx.font = TITLE_FONT.replace('{size}', size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#1a0e02'; ctx.strokeText(t, x, y);
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c));
  ctx.lineWidth = size * 0.07; ctx.strokeStyle = fill[0]; ctx.strokeText(t, x, y); ctx.fillStyle = g; ctx.fillText(t, x, y);
}

`;
