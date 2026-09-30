/**
 * Paints the artwork of Sweet Spot Mania (clusters) procedurally in headless Chromium:
 *   public/games/sweet_spot_mania/assets/stage.jpg        1400x1254 cabinet (candy land, candy-cane frame, logo, empty panel)
 *   public/games/sweet_spot_mania/assets/sym_<id>.png     320x320 glossy candy symbols (transparent)
 *
 * Replace any file with painted artwork of the same size whenever you like.
 */
const base = require('../painter/base');

const painter = String.raw`
/** Glossy candy fill for the current path: body gradient, rim, highlight. */
function gloss(ctx, cx, cy, r, color, { rim = true, shine = true, sugar = false } = {}) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.15);
  g.addColorStop(0, lighten(color, 0.55)); g.addColorStop(0.45, color); g.addColorStop(1, darken(color, 0.45));
  ctx.fillStyle = g; ctx.fill();
  if (rim) { ctx.lineWidth = r * 0.045; ctx.strokeStyle = darken(color, 0.55); ctx.stroke(); }
  ctx.clip();
  if (sugar) for (let i = 0; i < 90; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.4) + ')'; ctx.beginPath(); ctx.arc(cx + (rnd() - 0.5) * r * 2.2, cy + (rnd() - 0.5) * r * 2.2, r * (0.012 + rnd() * 0.02), 0, TAU); ctx.fill(); }
  if (shine) {
    const s = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 0.6);
    s.addColorStop(0, 'rgba(255,255,255,0.85)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.42, r * 0.5, r * 0.28, -0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function shadow(ctx, s) { ctx.shadowColor = 'rgba(60,0,40,0.45)'; ctx.shadowBlur = s * 0.06; ctx.shadowOffsetY = s * 0.03; }
function starPath(ctx, cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n; const rr = i % 2 ? r : R; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
}
function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.35, cy + s * 0.05, cx - s * 0.95, cy - s * 1.0, cx, cy - s * 0.42);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 1.0, cx + s * 1.35, cy + s * 0.05, cx, cy + s * 0.9);
  ctx.closePath();
}
function sprinkles(ctx, cx, cy, rx, ry, n, inside, size = rx) {
  const cols = ['#ffffff', '#ffe04a', '#4ad1ff', '#7aff8a', '#ff4a8a', '#b07aff'];
  for (let i = 0; i < n; i++) {
    const x = cx + (rnd() - 0.5) * 2 * rx, y = cy + (rnd() - 0.5) * 2 * ry;
    if (inside && !inside(x, y)) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * TAU);
    ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.roundRect(-size * 0.06, -size * 0.018, size * 0.12, size * 0.036, size * 0.018); ctx.fill(); ctx.restore();
  }
}

// ---------------------------------------------------------------- symbols (drawn in a 320x320 box)
const SYM = {
  SCATTER(ctx) { lollipop(ctx, 160, 128, 104, ['#ff3f9a', '#ffffff', '#ffd23a', '#ffffff'], true); },
  CUPCAKE(ctx) {
    ctx.save(); shadow(ctx, 320);
    // wrapper
    ctx.beginPath(); ctx.moveTo(78, 176); ctx.lineTo(242, 176); ctx.lineTo(220, 292); ctx.lineTo(100, 292); ctx.closePath();
    const wg = ctx.createLinearGradient(78, 0, 242, 0); wg.addColorStop(0, '#2aa8c8'); wg.addColorStop(0.5, '#7ae8ff'); wg.addColorStop(1, '#1a7a9a');
    ctx.fillStyle = wg; ctx.fill(); ctx.restore();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 7;
    for (let i = 0; i < 9; i++) { const t = i / 8; ctx.beginPath(); ctx.moveTo(78 + t * 164, 176); ctx.lineTo(100 + t * 120, 292); ctx.stroke(); }
    ctx.restore();
    // frosting swirl (3 tiers)
    [[160, 170, 96, 34], [160, 136, 76, 30], [160, 104, 52, 26]].forEach(([x, y, rx, ry]) => {
      ctx.save(); shadow(ctx, 200); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.restore();
      gloss(ctx, x, y, rx, '#ff7ac0', { rim: true });
    });
    sprinkles(ctx, 160, 140, 90, 50, 26, (x, y) => ((x - 160) / 92) ** 2 + ((y - 150) / 60) ** 2 < 1);
    // cherry
    ctx.strokeStyle = '#3a8a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(166, 66); ctx.quadraticCurveTo(178, 40, 196, 32); ctx.stroke();
    ctx.beginPath(); ctx.arc(162, 76, 22, 0, TAU); gloss(ctx, 162, 76, 22, '#e8102a');
  },
  DONUT(ctx) {
    const cx = 160, cy = 168;
    ctx.save(); shadow(ctx, 320);
    ctx.beginPath(); ctx.ellipse(cx, cy, 128, 112, 0, 0, TAU); ctx.ellipse(cx, cy, 40, 32, 0, 0, TAU);
    const dg = ctx.createRadialGradient(cx - 40, cy - 50, 10, cx, cy, 140); dg.addColorStop(0, '#ffd89a'); dg.addColorStop(0.6, '#e0a050'); dg.addColorStop(1, '#8a5020');
    ctx.fillStyle = dg; ctx.fill('evenodd'); ctx.restore();
    // wavy icing
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU; const r = 104 + Math.sin(a * 7) * 9; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.87 - 6); }
    ctx.closePath(); ctx.ellipse(cx, cy - 6, 50, 42, 0, 0, TAU);
    ctx.save();
    const ig = ctx.createRadialGradient(cx - 40, cy - 60, 8, cx, cy, 130); ig.addColorStop(0, '#ffd0ec'); ig.addColorStop(0.5, '#ff5fb0'); ig.addColorStop(1, '#c0206a');
    ctx.fillStyle = ig; ctx.fill('evenodd'); ctx.lineWidth = 4; ctx.strokeStyle = '#a0104a'; ctx.stroke();
    ctx.clip('evenodd');
    sprinkles(ctx, cx, cy - 6, 104, 92, 70);
    const s = ctx.createRadialGradient(cx - 50, cy - 70, 0, cx - 50, cy - 70, 70); s.addColorStop(0, 'rgba(255,255,255,0.8)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, 320, 320);
    ctx.restore();
  },
  CHOCO(ctx) {
    ctx.save(); ctx.translate(160, 166); ctx.rotate(-0.28);
    ctx.save(); shadow(ctx, 320); ctx.beginPath(); ctx.roundRect(-92, -128, 184, 250, 16);
    ctx.fillStyle = '#4a2410'; ctx.fill(); ctx.restore();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const x = -80 + c * 84, y = -116 + r * 64;
      const g = ctx.createLinearGradient(x, y, x + 76, y + 56); g.addColorStop(0, '#a86038'); g.addColorStop(0.5, '#6a3418'); g.addColorStop(1, '#3a1a08');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, 76, 56, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,180,0.25)'; ctx.fillRect(x + 6, y + 5, 64, 6);
    }
    // gold foil + red wrapper on the lower part
    const fy = 70;
    ctx.beginPath(); ctx.moveTo(-96, fy); for (let i = 0; i <= 12; i++) ctx.lineTo(-96 + i * 16, fy - 12 + (i % 2) * 16); ctx.lineTo(96, 126); ctx.lineTo(-96, 126); ctx.closePath();
    const fg = ctx.createLinearGradient(-96, 0, 96, 0); fg.addColorStop(0, '#b07a10'); fg.addColorStop(0.35, '#fff0a0'); fg.addColorStop(0.6, '#e0a020'); fg.addColorStop(1, '#8a5a08');
    ctx.fillStyle = fg; ctx.fill();
    ctx.beginPath(); ctx.roundRect(-98, 92, 196, 40, 8); const rg = ctx.createLinearGradient(0, 92, 0, 132); rg.addColorStop(0, '#ff4a6a'); rg.addColorStop(1, '#a0102a');
    ctx.fillStyle = rg; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 26px "Fredoka"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♥', 0, 113);
    ctx.restore();
  },
  RED(ctx) { ctx.save(); shadow(ctx, 320); heartPath(ctx, 160, 168, 118); ctx.fillStyle = '#e8103a'; ctx.fill(); ctx.restore(); heartPath(ctx, 160, 168, 118); gloss(ctx, 160, 150, 120, '#ff2a55', { sugar: true }); },
  ORANGE(ctx) {
    ctx.beginPath(); ctx.moveTo(52, 250); ctx.bezierCurveTo(40, 110, 110, 52, 160, 52); ctx.bezierCurveTo(210, 52, 280, 110, 268, 250); ctx.quadraticCurveTo(160, 282, 52, 250); ctx.closePath();
    ctx.save(); shadow(ctx, 320); ctx.fillStyle = '#e0700a'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(52, 250); ctx.bezierCurveTo(40, 110, 110, 52, 160, 52); ctx.bezierCurveTo(210, 52, 280, 110, 268, 250); ctx.quadraticCurveTo(160, 282, 52, 250); ctx.closePath();
    gloss(ctx, 160, 160, 120, '#ff9a1a', { sugar: true });
  },
  GREEN(ctx) { ctx.save(); shadow(ctx, 320); starPath(ctx, 160, 166, 128, 60); ctx.lineJoin = 'round'; ctx.fillStyle = '#2a9a2a'; ctx.fill(); ctx.restore(); starPath(ctx, 160, 166, 128, 60); gloss(ctx, 160, 160, 120, '#4ad14a', { sugar: true }); },
  BLUE(ctx) {
    const cx = 160, cy = 164;
    const twist = (dir) => {
      ctx.beginPath(); ctx.moveTo(cx + dir * 70, cy); ctx.lineTo(cx + dir * 150, cy - 62); ctx.quadraticCurveTo(cx + dir * 132, cy, cx + dir * 150, cy + 62); ctx.closePath();
      const g = ctx.createLinearGradient(cx + dir * 70, 0, cx + dir * 150, 0); g.addColorStop(0, 'rgba(120,200,255,0.95)'); g.addColorStop(1, 'rgba(210,240,255,0.9)');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(40,110,200,0.7)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + dir * 78, cy + k * 6); ctx.lineTo(cx + dir * 144, cy + k * 44); ctx.stroke(); }
    };
    ctx.save(); shadow(ctx, 320); twist(-1); twist(1); ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, cy, 86, 70, 0, 0, TAU);
    ctx.save(); ctx.fillStyle = '#1a5ad0'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 16;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 40 - 60, cy - 80); ctx.quadraticCurveTo(cx + i * 40, cy, cx + i * 40 + 60, cy + 80); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, cy, 86, 70, 0, 0, TAU); gloss(ctx, cx, cy, 86, '#3a8aff');
  }
};
function lollipop(ctx, cx, cy, R, stripes, stick) {
  if (stick) {
    const sg = ctx.createLinearGradient(cx - 10, 0, cx + 10, 0); sg.addColorStop(0, '#d8d0c8'); sg.addColorStop(0.5, '#ffffff'); sg.addColorStop(1, '#b8b0a8');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(cx - 10, cy + R * 0.6, 20, 150, 8); ctx.fill();
  }
  ctx.save(); shadow(ctx, R * 3); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = stripes[0]; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  for (let k = 1; k < stripes.length; k++) {
    ctx.strokeStyle = stripes[k]; ctx.lineWidth = R * 0.09; ctx.beginPath();
    for (let a = 0; a < TAU * 3.2; a += 0.05) { const r = (a / (TAU * 3.2)) * R * 1.05; const aa = a + k * (TAU / stripes.length); ctx.lineTo(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = R * 0.05; ctx.strokeStyle = darken(stripes[0], 0.4); ctx.stroke();
  // cellophane shine
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  const s = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, 0, cx - R * 0.4, cy - R * 0.45, R * 0.75); s.addColorStop(0, 'rgba(255,255,255,0.75)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.restore();
  if (stick) {
    // bow
    ctx.fillStyle = '#ff4a9a';
    [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(cx, cy + R + 14); ctx.quadraticCurveTo(cx + d * 60, cy + R - 20, cx + d * 56, cy + R + 36); ctx.closePath(); ctx.fill(); });
    ctx.beginPath(); ctx.arc(cx, cy + R + 14, 11, 0, TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------- stage
function drawStage(ctx, P) {
  const W = 1400, H = 1254; seed = 11;
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#6a3ae0'); sky.addColorStop(0.45, '#ff7ac8'); sky.addColorStop(0.8, '#ffc0e0'); sky.addColorStop(1, '#ffe0f0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // sun glow + stars
  const sg = ctx.createRadialGradient(700, 420, 20, 700, 420, 620); sg.addColorStop(0, 'rgba(255,240,200,0.8)'); sg.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + rnd() * 0.7) + ')'; starPath(ctx, rnd() * W, rnd() * 360, 3 + rnd() * 5, 1.4 + rnd() * 2, 4); ctx.fill(); }
  // cotton candy clouds
  const cloud = (x, y, s, c) => { ctx.save(); ctx.filter = 'blur(2px)'; for (let i = 0; i < 7; i++) { const ox = (i - 3) * s * 0.32, oy = -Math.abs(Math.sin(i)) * s * 0.3; const g = ctx.createRadialGradient(x + ox - s * 0.1, y + oy - s * 0.1, 2, x + ox, y + oy, s * 0.36); g.addColorStop(0, '#ffffff'); g.addColorStop(1, c); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, s * 0.36, 0, TAU); ctx.fill(); } ctx.restore(); };
  cloud(160, 250, 220, '#ffb0e0'); cloud(1250, 210, 240, '#c0d8ff'); cloud(700, 120, 200, '#ffd0f0'); cloud(420, 560, 160, '#d0c0ff'); cloud(1020, 600, 170, '#ffc0e0');
  // gumdrop hills
  const hills = (base, amp, color, n) => { for (let i = 0; i < n; i++) { const x = (i + 0.5) * W / n + (rnd() - 0.5) * 80, r = amp * (0.7 + rnd() * 0.5); ctx.beginPath(); ctx.ellipse(x, base, r * 1.1, r, 0, Math.PI, TAU); gloss(ctx, x, base - r * 0.5, r, color, { rim: false, sugar: true }); } };
  hills(900, 220, '#9a7aff', 6); hills(1000, 200, '#ff8ad0', 7); hills(1110, 170, '#6ae0c0', 8);
  // lollipop trees at the sides
  [[90, 640, 90, ['#ff3f9a', '#ffffff']], [1310, 610, 100, ['#3ab0ff', '#ffffff', '#ffd23a']], [210, 860, 60, ['#ffd23a', '#ff3f9a']], [1195, 880, 64, ['#7a4aff', '#ffffff']]].forEach(([x, y, r, st]) => lollipop(ctx, x, y, r, st, true));
  // floor
  const fl = ctx.createLinearGradient(0, 1100, 0, H); fl.addColorStop(0, '#ff9ad0'); fl.addColorStop(1, '#c04a9a'); ctx.fillStyle = fl; ctx.fillRect(0, 1110, W, H - 1110);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 1110, W, H); ctx.clip(); sprinkles(ctx, 700, 1180, 700, 70, 420, null, 110); ctx.restore();

  // candy-cane pillars
  const cane = (x, top, bottom, dir) => {
    const hook = () => { ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, top); if (dir > 0) ctx.arc(x + 58, top, 58, Math.PI, 0, false); else ctx.arc(x - 58, top, 58, 0, Math.PI, true); ctx.lineTo(x + dir * 116, top + 40); };
    ctx.save(); shadow(ctx, 300); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 54; ctx.strokeStyle = '#ffffff'; hook(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.lineCap = 'butt'; ctx.lineWidth = 54; ctx.strokeStyle = '#ff2a4a'; ctx.setLineDash([26, 34]); hook(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(x - 12, bottom - 10); ctx.lineTo(x - 12, top); ctx.stroke(); ctx.restore();
  };
  cane(P.x - 96, P.y + 90, P.y + P.h + 150, -1); cane(P.x + P.w + 96, P.y + 90, P.y + P.h + 150, 1);

  // frame: glossy pink with candy stripes
  const F = { x: P.x - 44, y: P.y - 44, w: P.w + 88, h: P.h + 88 };
  ctx.save(); shadow(ctx, 900); ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 56); ctx.fillStyle = '#ff5fae'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.roundRect(F.x, F.y, F.w, F.h, 56); ctx.roundRect(P.x - 6, P.y - 6, P.w + 12, P.h + 12, 26); ctx.clip('evenodd');
  const fg = ctx.createLinearGradient(0, F.y, 0, F.y + F.h); fg.addColorStop(0, '#ff9ad4'); fg.addColorStop(0.5, '#ff4aa2'); fg.addColorStop(1, '#d01a7a'); ctx.fillStyle = fg; ctx.fillRect(F.x, F.y, F.w, F.h);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = -F.h; k < F.w + F.h; k += 64) { ctx.beginPath(); ctx.moveTo(F.x + k, F.y); ctx.lineTo(F.x + k + 26, F.y); ctx.lineTo(F.x + k + 26 - F.h, F.y + F.h); ctx.lineTo(F.x + k - F.h, F.y + F.h); ctx.closePath(); ctx.fill(); }
  const sh = ctx.createLinearGradient(0, F.y, 0, F.y + 60); sh.addColorStop(0, 'rgba(255,255,255,0.6)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(F.x, F.y, F.w, 60);
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(F.x + 3, F.y + 3, F.w - 6, F.h - 6, 54); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = '#a0105a'; ctx.beginPath(); ctx.roundRect(P.x - 6, P.y - 6, P.w + 12, P.h + 12, 26); ctx.stroke();
  // panel: frosted sugar glass
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, '#5a2a9a'); pg.addColorStop(1, '#2a0f55');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(P.x - 3, P.y - 3, P.w + 6, P.h + 6, 24); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(P.x - 3, P.y - 3, P.w + 6, P.h + 6, 24); ctx.clip();
  const cw = P.w / 7, ch = P.h / 7;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) { ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(255,120,210,0.10)'; ctx.beginPath(); ctx.roundRect(P.x + c * cw + 4, P.y + r * ch + 4, cw - 8, ch - 8, 16); ctx.fill(); }
  ctx.shadowColor = 'rgba(140,0,80,0.5)'; ctx.shadowBlur = 30; ctx.lineWidth = 20; ctx.strokeStyle = 'rgba(160,20,100,0.35)'; ctx.beginPath(); ctx.roundRect(P.x - 13, P.y - 13, P.w + 26, P.h + 26, 30); ctx.stroke();
  ctx.restore();
  // gumdrops on the corners
  [[F.x + 20, F.y + 20, '#ffd23a'], [F.x + F.w - 20, F.y + 20, '#3ab0ff'], [F.x + 20, F.y + F.h - 20, '#6ae0a0'], [F.x + F.w - 20, F.y + F.h - 20, '#b07aff']].forEach(([x, y, c]) => {
    ctx.save(); shadow(ctx, 200); ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.restore(); ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); gloss(ctx, x, y, 34, c, { sugar: true });
  });

  // logo plaque (cloud shaped) + logo
  ctx.save(); shadow(ctx, 600);
  ctx.beginPath(); const lx = 700, ly = 170;
  [[-250, 30, 80], [-160, -10, 100], [-40, -40, 120], [90, -30, 110], [200, 0, 95], [270, 40, 70], [0, 50, 140]].forEach(([dx, dy, r]) => { ctx.moveTo(lx + dx + r, ly + dy); ctx.arc(lx + dx, ly + dy, r, 0, TAU); });
  const lg = ctx.createLinearGradient(0, 40, 0, 300); lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, '#ffc0e4'); ctx.fillStyle = lg; ctx.fill(); ctx.restore();
  const text = (t, y, size, fill) => {
    ctx.font = '700 ' + size + 'px "Fredoka"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.26; ctx.strokeStyle = '#5a1080'; ctx.strokeText(t, lx, y);
    ctx.lineWidth = size * 0.12; ctx.strokeStyle = '#ffffff'; ctx.strokeText(t, lx, y);
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c));
    ctx.fillStyle = g; ctx.fillText(t, lx, y);
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
  };
  text('SWEET SPOT', ly - 30, 84, ['#fff3a0', '#ffb020', '#ff6a00']);
  text('MANIA', ly + 62, 118, ['#ffd0f0', '#ff3fa0', '#b0106a']);
  lollipop(ctx, lx - 330, ly + 20, 44, ['#ff3f9a', '#ffffff'], false);
  lollipop(ctx, lx + 330, ly + 20, 44, ['#3ab0ff', '#ffffff'], false);
}
`;

module.exports = {
  game: 'sweet_spot_mania',
  stage: { width: 1400, height: 1254 },
  // Reel panel inside the stage picture — keep in sync with theme.stage.reels in src/games/definitions/sweet_spot_mania.js
  panel: { x: 320, y: 300, w: 760, h: 760 },
  fonts: [{ family: 'Fredoka', weight: 700, file: 'fredoka-latin-700-normal.woff2' }],
  glyphs: [],
  symbolSeed: 3,
  painter: [base, painter]
};
