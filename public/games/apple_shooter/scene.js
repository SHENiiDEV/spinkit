/*
 * Apple Shooter — retro pixel scene (400x225 canvas, scaled with nearest-neighbour).
 *
 * Purely visual. The game tells the scene what the server decided (outcome of the shot,
 * wind, distance) and the scene animates it: the arrow's curve is bent onto the impact point
 * the server chose. Aim and pull only shape the first part of the flight.
 *
 * API (all animations return promises):
 *   scene.setSkin(id) · setWind(ms) · setLevelDistance(m, {walk}) · setHelmet(bool) · setMultiplier(text)
 *   scene.newRound(distance) · scene.shoot({ outcome, saved }) · scene.autoAim() · scene.enableAim(bool)
 *   scene.onRelease = ({ angle, power }) => …
 */
(function () {
  const W = 400;
  const H = 225;
  const GROUND = 186;
  const ARCHER_X = 44;
  const PX_PER_M = 7.1;
  const WALL_X = 376;
  const partnerX = (m) => Math.round(ARCHER_X + 16 + m * PX_PER_M);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- skins
  const SKINS = {
    classic: {
      name: 'Classic Flash',
      archer: { skin: '#f2c49b', hair: '#3a2416', shirt: '#2f8f3a', pants: '#5a3a22', shoe: '#2a1a10', hat: null, bow: '#8a5a2b', string: '#e8e0c8' },
      partner: { skin: '#f2c49b', hair: '#c9822b', shirt: '#e8e8f0', pants: '#2f4f9f', shoe: '#2a1a10', head: 'human', target: 'apple', hat: 'cowboy' }
    },
    robin: {
      name: 'Robin Hood',
      archer: { skin: '#f0c090', hair: '#7a4a1e', shirt: '#2f6f2a', pants: '#3c5a22', shoe: '#4a2e14', hat: 'robin', bow: '#6a3c18', string: '#f0e6c8' },
      partner: { skin: '#e8b88a', hair: '#2a1a10', shirt: '#8a6a3a', pants: '#5a4428', shoe: '#2a1a10', head: 'human', target: 'apple', hat: 'beret' }
    },
    cyber: {
      name: 'Cyber Sniper',
      archer: { skin: '#d8b090', hair: '#ff3df0', shirt: '#1a1a2e', pants: '#262640', shoe: '#0a0a14', hat: 'visor', bow: '#46e0ff', string: '#ff3df0' },
      partner: { skin: '#c8d0e0', hair: '#46e0ff', shirt: '#2a2a44', pants: '#16162a', shoe: '#0a0a14', head: 'robot', target: 'neon', hat: 'cap' }
    },
    office: {
      name: 'Office Hero',
      archer: { skin: '#f2c49b', hair: '#222222', shirt: '#f4f4f8', pants: '#2a2a36', shoe: '#111111', hat: 'tie', bow: '#555566', string: '#dddddd' },
      partner: { skin: '#f0c8a0', hair: '#5a3a22', shirt: '#9fc3ff', pants: '#3a3a48', shoe: '#111111', head: 'human', target: 'mug', hat: 'paper' }
    },
    shiba: {
      name: 'Pizza Shiba',
      archer: { skin: '#f2c49b', hair: '#3a2416', shirt: '#ffffff', pants: '#3a3a3a', shoe: '#2a1a10', hat: 'chef', bow: '#c0782a', string: '#fff0d0' },
      partner: { skin: '#e8963a', hair: '#fff2dc', shirt: '#e8963a', pants: '#e8963a', shoe: '#fff2dc', head: 'dog', target: 'pizza', hat: 'chef' }
    }
  };

  // ---------------------------------------------------------------- weather palettes
  const WEATHER = {
    calm: { sky: ['#2b6cff', '#3d82ff', '#5a9bff', '#7ab4ff', '#9ccaff', '#c2e0ff'], hill: ['#3f9a4a', '#2e7a3a'], mount: '#7a8fd0', ground: ['#4fbf4a', '#3a9a36', '#7a5230'], cloud: '#ffffff', sun: true },
    breeze: { sky: ['#2f62e8', '#3f78f0', '#5a90f4', '#77a8f6', '#98c0f8', '#bcd8fa'], hill: ['#3c934a', '#2c7638'], mount: '#7488c8', ground: ['#4cb847', '#389434', '#77502e'], cloud: '#f4f8ff', sun: true },
    crosswind: { sky: ['#3a5aa8', '#4a6cb8', '#6080c4', '#7896cc', '#94acd4', '#b0c2da'], hill: ['#357f42', '#276634'], mount: '#6a78ae', ground: ['#43a240', '#33822f', '#6c4a2a'], cloud: '#dfe6f4', sun: false },
    storm: { sky: ['#1a1830', '#24223e', '#2e2c4c', '#3a3858', '#474462', '#56526e'], hill: ['#22503a', '#18402c'], mount: '#3c3c5c', ground: ['#2e6a34', '#24562a', '#4a3420'], cloud: '#6a6a88', sun: false }
  };

  // ---------------------------------------------------------------- pixel helpers
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }

  function pxLine(g, x0, y0, x1, y1, color, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    g.fillStyle = color;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor(w / 2);
    for (let i = 0; i < 2000; i++) {
      g.fillRect(x0 - o, y0 - o, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function pxCircle(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y + r * 0.6));
      g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }

  function rect(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function text(g, s, x, y, color, align = 'left', size = 8) {
    g.font = `${size}px "Press Start 2P", monospace`;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillStyle = '#000';
    g.fillText(s, Math.round(x) + 1, Math.round(y) + 1);
    g.fillStyle = color;
    g.fillText(s, Math.round(x), Math.round(y));
  }

  // ---------------------------------------------------------------- props (apple / hat / target variants)
  function drawTarget(g, kind, cx, cy, half = 0) {
    cx = Math.round(cx); cy = Math.round(cy);
    if (kind === 'mug') {
      rect(g, cx - 3, cy - 3, 6, 7, '#ffffff');
      rect(g, cx - 3, cy - 3, 6, 1, '#6a3a1a');
      rect(g, cx + 3, cy - 1, 2, 1, '#ffffff'); rect(g, cx + 4, cy - 1, 1, 3, '#ffffff'); rect(g, cx + 3, cy + 1, 2, 1, '#ffffff');
      rect(g, cx - 2, cy, 4, 1, '#ff3b3b');
      rect(g, cx - 1, cy - 6, 1, 2, 'rgba(255,255,255,0.6)'); rect(g, cx + 1, cy - 7, 1, 2, 'rgba(255,255,255,0.5)');
      return;
    }
    if (kind === 'pizza') {
      g.fillStyle = '#e8a83a';
      for (let i = 0; i < 6; i++) g.fillRect(cx - 4 + i, cy - 3 + i, 9 - i * 2 > 0 ? 9 - i * 2 : 1, 1);
      rect(g, cx - 4, cy - 4, 9, 1, '#b8641e');
      rect(g, cx - 2, cy - 2, 2, 2, '#d8281e'); rect(g, cx + 1, cy - 1, 2, 2, '#d8281e');
      return;
    }
    const body = kind === 'neon' ? '#ff3df0' : '#e8202a';
    const dark = kind === 'neon' ? '#9a1e94' : '#9a1018';
    const hi = kind === 'neon' ? '#ffd0fa' : '#ff8a8a';
    if (half) {
      // half apple (bullseye split): flat side shows the flesh
      const s = half;
      pxCircle(g, cx, cy, 3, body);
      rect(g, s < 0 ? cx : cx - 3, cy - 3, 4, 7, '#fff2c0');
      rect(g, s < 0 ? cx : cx - 1, cy - 1, 1, 2, '#3a2010');
      return;
    }
    pxCircle(g, cx, cy, 3, dark);
    pxCircle(g, cx, cy - 0.5, 3, body);
    rect(g, cx - 2, cy - 2, 1, 1, hi); rect(g, cx - 1, cy - 3, 1, 1, hi);
    rect(g, cx, cy - 5, 1, 2, '#5a3a1a');
    rect(g, cx + 1, cy - 5, 2, 1, kind === 'neon' ? '#46e0ff' : '#3ddc84');
  }

  function drawHat(g, kind, cx, by, color) {
    cx = Math.round(cx); by = Math.round(by); // by = bottom of the hat
    if (kind === 'beret') {
      rect(g, cx - 5, by - 2, 10, 2, '#8a1e2a'); rect(g, cx - 4, by - 3, 8, 1, '#8a1e2a'); rect(g, cx, by - 4, 1, 1, '#8a1e2a');
      return;
    }
    if (kind === 'paper') {
      g.fillStyle = '#f4f4f4';
      for (let i = 0; i < 5; i++) g.fillRect(cx - 5 + i, by - 1 - i, 11 - i * 2, 1);
      rect(g, cx - 5, by - 1, 11, 1, '#c8c8d0');
      return;
    }
    if (kind === 'chef') {
      rect(g, cx - 3, by - 2, 7, 2, '#ffffff'); rect(g, cx - 4, by - 6, 9, 4, '#ffffff'); rect(g, cx - 3, by - 7, 3, 1, '#ffffff'); rect(g, cx + 1, by - 7, 3, 1, '#ffffff');
      rect(g, cx - 3, by - 2, 7, 1, '#d8d8e0');
      return;
    }
    if (kind === 'cap') {
      rect(g, cx - 3, by - 3, 7, 3, '#46e0ff'); rect(g, cx - 6, by - 1, 4, 1, '#46e0ff'); rect(g, cx - 2, by - 2, 4, 1, '#ff3df0');
      return;
    }
    // cowboy
    const c = color || '#8a4a1e';
    rect(g, cx - 6, by - 1, 13, 1, c); rect(g, cx - 7, by - 2, 2, 1, c); rect(g, cx + 6, by - 2, 2, 1, c);
    rect(g, cx - 3, by - 5, 7, 4, c); rect(g, cx - 3, by - 2, 7, 1, '#3a2010'); rect(g, cx - 1, by - 5, 3, 1, '#6a3414');
  }

  function drawArrow(g, x, y, ang, len = 15, carry = null, skin = null) {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const tx = x; const ty = y; // tip
    const bx = x - dx * len; const by = y - dy * len;
    pxLine(g, bx, by, tx - dx * 2, ty - dy * 2, '#c8965a');
    pxLine(g, tx - dx * 2, ty - dy * 2, tx, ty, '#d0d0e0');
    rect(g, tx, ty, 1, 1, '#ffffff');
    // fletching
    const nx = -dy; const ny = dx;
    pxLine(g, bx, by, bx + dx * 3 + nx * 2, by + dy * 3 + ny * 2, '#ff3b3b');
    pxLine(g, bx, by, bx + dx * 3 - nx * 2, by + dy * 3 - ny * 2, '#ff3b3b');
    if (carry === 'apple' && skin) drawTarget(g, skin.partner.target, tx - dx * 4, ty - dy * 4 + 0.5);
    if (carry === 'hat' && skin) drawHat(g, skin.partner.hat, tx - dx * 5, ty - dy * 5 + 3);
  }

  // ---------------------------------------------------------------- characters
  function drawArcher(g, sk, x, aimAng, pull, nocked, t) {
    const a = sk.archer;
    const fx = Math.round(x);
    const breathe = Math.round(Math.sin(t * 2) * 0.6);
    // legs (stance)
    rect(g, fx - 5, GROUND - 13, 3, 13, a.pants); rect(g, fx + 2, GROUND - 13, 3, 13, a.pants);
    rect(g, fx - 6, GROUND - 2, 5, 2, a.shoe); rect(g, fx + 2, GROUND - 2, 5, 2, a.shoe);
    // torso
    const ty = GROUND - 27 + breathe;
    rect(g, fx - 5, ty, 10, 14, a.shirt);
    rect(g, fx - 5, ty + 12, 10, 2, 'rgba(0,0,0,0.25)');
    if (a.hat === 'tie') { rect(g, fx, ty + 1, 2, 8, '#d8202a'); rect(g, fx - 1, ty, 4, 2, '#d8202a'); }
    if (a.hat === 'chef') rect(g, fx - 5, ty + 6, 10, 1, '#d8d8e0');
    // head (facing right)
    const hy = ty - 11;
    rect(g, fx - 4, hy, 9, 10, a.skin);
    rect(g, fx - 5, hy, 10, 3, a.hair); rect(g, fx - 5, hy, 3, 7, a.hair);
    rect(g, fx + 2, hy + 4, 2, 2, '#1a1a1a');
    rect(g, fx + 1, hy + 8, 3, 1, '#a0604a');
    if (a.hat === 'robin') {
      g.fillStyle = '#2f6f2a';
      for (let i = 0; i < 5; i++) g.fillRect(fx - 6 + i, hy - 1 - i, 12 - i * 2, 1);
      rect(g, fx - 6, hy - 1, 13, 2, '#2f6f2a');
      pxLine(g, fx - 3, hy - 2, fx - 8, hy - 8, '#ff3b3b');
    } else if (a.hat === 'visor') {
      rect(g, fx - 1, hy + 3, 7, 3, '#46e0ff'); rect(g, fx - 1, hy + 4, 7, 1, '#ffffff');
    } else if (a.hat === 'chef') {
      drawHat(g, 'chef', fx, hy + 1);
    }
    // arms + bow, rotated by aim
    const sx = fx + 1; const sy = ty + 3;
    const dx = Math.cos(aimAng); const dy = Math.sin(aimAng);
    const hx = sx + dx * 11; const hy2 = sy + dy * 11; // bow hand
    pxLine(g, sx, sy, hx, hy2, a.shirt, 2);
    rect(g, hx - 1, hy2 - 1, 2, 2, a.skin);
    // bow: arc through the hand, perpendicular to aim
    const nx = -dy; const ny = dx;
    const R = 12;
    let prev = null;
    for (let i = -6; i <= 6; i++) {
      const k = i / 6;
      const bend = (1 - k * k) * 3.5;
      const px = hx + nx * k * R + dx * bend;
      const py = hy2 + ny * k * R + dy * bend;
      if (prev) pxLine(g, prev[0], prev[1], px, py, a.bow, 2);
      prev = [px, py];
    }
    const tip1 = [hx - nx * R + dx * 0.5, hy2 - ny * R + dy * 0.5];
    const tip2 = [hx + nx * R + dx * 0.5, hy2 + ny * R + dy * 0.5];
    const pullD = 4 + pull * 10;
    const sxh = hx - dx * pullD; const syh = hy2 - dy * pullD; // string hand
    pxLine(g, tip1[0], tip1[1], sxh, syh, a.string);
    pxLine(g, tip2[0], tip2[1], sxh, syh, a.string);
    // draw arm
    pxLine(g, sx - 1, sy + 1, sxh, syh, a.shirt, 2);
    rect(g, sxh - 1, syh - 1, 2, 2, a.skin);
    if (nocked) drawArrow(g, sxh + dx * 17, syh + dy * 17, aimAng, 17);
    return { nock: [sxh + dx * 17, syh + dy * 17] };
  }

  function drawPartner(g, sk, p, t) {
    const a = sk.partner;
    let x = Math.round(p.x + p.shake);
    const walking = p.walkT != null;
    const legPh = walking ? Math.sin(p.walkT * 18) : 0;
    // legs
    rect(g, x - 4, GROUND - 13 + (legPh > 0 ? -1 : 0), 3, 13 - (legPh > 0 ? 1 : 0), a.pants);
    rect(g, x + 1, GROUND - 13 + (legPh < 0 ? -1 : 0), 3, 13 - (legPh < 0 ? 1 : 0), a.pants);
    rect(g, x - 6, GROUND - 2, 5, 2, a.shoe); rect(g, x, GROUND - 2, 5, 2, a.shoe);
    // torso
    const ty = GROUND - 27;
    rect(g, x - 5, ty, 10, 14, a.shirt);
    rect(g, x - 5, ty + 12, 10, 2, 'rgba(0,0,0,0.2)');
    if (a.head === 'dog') { rect(g, x + 5, ty + 8, 3, 2, a.shirt); rect(g, x + 7, ty + 6, 2, 3, a.hair); } // tail
    // arms hanging (raised when scared)
    const armUp = p.scared > 0;
    if (armUp) {
      rect(g, x - 7, ty - 6, 2, 9, a.shirt); rect(g, x + 5, ty - 6, 2, 9, a.shirt);
      rect(g, x - 7, ty - 8, 2, 2, a.skin); rect(g, x + 5, ty - 8, 2, 2, a.skin);
    } else {
      rect(g, x - 7, ty + 1, 2, 11, a.shirt); rect(g, x + 5, ty + 1, 2, 11, a.shirt);
      rect(g, x - 7, ty + 12, 2, 2, a.skin); rect(g, x + 5, ty + 12, 2, 2, a.skin);
    }
    // head (facing left)
    const hy = ty - 11;
    drawHead(g, a, x, hy, p.face);
    p.headTop = hy;
    if (p.helmet) {
      rect(g, x - 6, hy - 2, 12, 4, '#9aa4b8'); rect(g, x - 5, hy - 3, 10, 1, '#c8d0e0'); rect(g, x - 6, hy + 1, 12, 1, '#5a6478');
    }
    const top = hy - (p.helmet ? 3 : 0);
    p.targetY = top - 4;
    if (p.hasTarget) drawTarget(g, a.target, x, top - 4 + (p.targetDrop || 0));
    if (p.hasHat) drawHat(g, a.hat, x, top - 7 + (p.targetDrop || 0), null);
    // sweat
    if (p.scared > 0 && Math.floor(t * 8) % 2 === 0) { rect(g, x + 7, hy + 1, 1, 2, '#9fe8ff'); rect(g, x - 8, hy + 3, 1, 2, '#9fe8ff'); }
  }

  function drawHead(g, a, x, hy, face) {
    if (a.head === 'dog') {
      rect(g, x - 5, hy + 1, 10, 9, a.skin);
      rect(g, x - 8, hy + 5, 4, 4, a.skin); rect(g, x - 8, hy + 7, 4, 2, a.hair); // snout
      rect(g, x - 9, hy + 5, 2, 2, '#1a1a1a'); // nose
      rect(g, x - 4, hy - 1, 3, 3, a.skin); rect(g, x + 2, hy - 1, 3, 3, a.skin); // ears
      rect(g, x - 3, hy, 1, 1, a.hair); rect(g, x + 3, hy, 1, 1, a.hair);
      rect(g, x - 3, hy + 6, 6, 4, a.hair);
      eyes(x - 3, hy + 3, face, g);
      return;
    }
    if (a.head === 'robot') {
      rect(g, x - 5, hy, 10, 10, a.skin); rect(g, x - 5, hy, 10, 1, '#ffffff');
      rect(g, x - 6, hy + 3, 1, 4, '#8890a8'); rect(g, x + 5, hy + 3, 1, 4, '#8890a8');
      rect(g, x - 4, hy + 3, 6, 2, '#16162a');
      if (face === 'dead') { rect(g, x - 4, hy + 3, 6, 2, '#ff3b3b'); } else { rect(g, x - 4 + ((Date.now() / 120) | 0) % 5, hy + 3, 2, 2, '#46e0ff'); }
      rect(g, x - 3, hy + 7, 4, 1, '#16162a');
      return;
    }
    rect(g, x - 4, hy, 9, 10, a.skin);
    rect(g, x - 4, hy, 10, 3, a.hair); rect(g, x + 3, hy, 3, 7, a.hair);
    eyes(x - 3, hy + 4, face, g);
    if (face === 'scared') rect(g, x - 3, hy + 7, 3, 2, '#3a1010');
    else if (face === 'dead') rect(g, x - 3, hy + 8, 3, 1, '#3a1010');
    else rect(g, x - 3, hy + 8, 3, 1, '#a0604a');
  }

  function eyes(x, y, face, g) {
    if (face === 'dead') {
      rect(g, x, y, 1, 1, '#1a1a1a'); rect(g, x + 2, y, 1, 1, '#1a1a1a'); rect(g, x + 1, y + 1, 1, 1, '#1a1a1a'); rect(g, x, y + 2, 1, 1, '#1a1a1a'); rect(g, x + 2, y + 2, 1, 1, '#1a1a1a');
    } else if (face === 'scared') {
      rect(g, x, y - 1, 2, 3, '#ffffff'); rect(g, x, y, 1, 1, '#1a1a1a');
    } else {
      rect(g, x, y, 2, 2, '#1a1a1a');
    }
  }

  // ---------------------------------------------------------------- ragdoll (verlet)
  class Ragdoll {
    constructor(x, sk, push) {
      const P = (px, py) => ({ x: px, y: py, ox: px - push * rnd(0.6, 1.1), oy: py + rnd(0.6, 1.4) });
      this.sk = sk;
      this.p = {
        head: P(x, GROUND - 34), neck: P(x, GROUND - 27), hip: P(x, GROUND - 14),
        kL: P(x - 2, GROUND - 7), kR: P(x + 2, GROUND - 7), fL: P(x - 3, GROUND), fR: P(x + 3, GROUND),
        eL: P(x - 6, GROUND - 22), eR: P(x + 6, GROUND - 22), hL: P(x - 7, GROUND - 15), hR: P(x + 7, GROUND - 15)
      };
      this.p.head.ox -= push * 0.8; // the hit pushes the upper body hardest
      this.p.neck.ox -= push * 0.6;
      const s = [['head', 'neck'], ['neck', 'hip'], ['hip', 'kL'], ['hip', 'kR'], ['kL', 'fL'], ['kR', 'fR'], ['neck', 'eL'], ['neck', 'eR'], ['eL', 'hL'], ['eR', 'hR'], ['head', 'hip'], ['kL', 'kR']];
      this.sticks = s.map(([a, b]) => [a, b, Math.hypot(this.p[a].x - this.p[b].x, this.p[a].y - this.p[b].y)]);
      this.rest = 0;
    }
    step() {
      for (const k in this.p) {
        const q = this.p[k];
        const vx = (q.x - q.ox) * 0.985;
        const vy = (q.y - q.oy) * 0.985;
        q.ox = q.x; q.oy = q.y;
        q.x += vx; q.y += vy + 0.32;
        if (q.y > GROUND - 1) { q.y = GROUND - 1; q.ox = q.x - vx * 0.5; q.oy = q.y + vy * 0.3; }
        if (q.x > WALL_X - 2) { q.x = WALL_X - 2; q.ox = q.x + vx * 0.3; }
      }
      for (let it = 0; it < 4; it++) {
        for (const [a, b, len] of this.sticks) {
          const A = this.p[a]; const B = this.p[b];
          const dx = B.x - A.x; const dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const f = (d - len) / d / 2;
          A.x += dx * f; A.y += dy * f; B.x -= dx * f; B.y -= dy * f;
        }
      }
      this.rest++;
    }
    draw(g) {
      const a = this.sk.partner;
      const L = (u, v, c, w) => pxLine(g, this.p[u].x, this.p[u].y, this.p[v].x, this.p[v].y, c, w);
      L('hip', 'kL', a.pants, 3); L('kL', 'fL', a.pants, 3); L('hip', 'kR', a.pants, 3); L('kR', 'fR', a.pants, 3);
      L('neck', 'hip', a.shirt, 8);
      L('neck', 'eL', a.shirt, 2); L('eL', 'hL', a.shirt, 2); L('neck', 'eR', a.shirt, 2); L('eR', 'hR', a.shirt, 2);
      const h = this.p.head;
      drawHead(g, a, Math.round(h.x), Math.round(h.y) - 5, 'dead');
    }
    get chest() {
      return { x: lerp(this.p.neck.x, this.p.hip.x, 0.4), y: lerp(this.p.neck.y, this.p.hip.y, 0.4), ang: Math.atan2(this.p.hip.y - this.p.neck.y, this.p.hip.x - this.p.neck.x) };
    }
  }

  // ---------------------------------------------------------------- scene
  class Scene {
    constructor(canvas) {
      this.canvas = canvas;
      this.out = canvas.getContext('2d');
      this.out.imageSmoothingEnabled = false;
      [this.buf, this.g] = makeCanvas(W, H);
      this.skin = SKINS.classic;
      this.wind = 0;
      this.tier = 'calm';
      this.t = 0;
      this.aim = { ang: -0.12, pull: 0, active: false, enabled: false };
      this.nocked = true;
      this.partner = { x: partnerX(8), shake: 0, face: 'calm', scared: 0, hasTarget: true, hasHat: true, helmet: false, walkT: null };
      this.distance = 8;
      this.arrows = []; // stuck arrows {x,y,ang,carry}
      this.flying = null;
      this.props = []; // free-falling props
      this.parts = []; // particles
      this.ragdoll = null;
      this.clouds = Array.from({ length: 7 }, (_, i) => ({ x: i * 64 + rnd(0, 40), y: rnd(14, 70), w: rnd(18, 40), s: rnd(0.6, 1.2) }));
      this.rain = Array.from({ length: 140 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(3, 5) }));
      this.flash = 0;
      this.nextBolt = 4;
      this.bolt = null;
      this.shakeT = 0;
      this.zoom = { k: 1, cx: W / 2, cy: H / 2 };
      this.mult = '';
      this.layers = {};
      this.seedHills();
      this.bindInput();
      this.last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // -------------------------------------------------------------- setup
    seedHills() {
      const n = (x, f, s) => Math.sin(x * f + s) * 0.5 + Math.sin(x * f * 2.3 + s * 1.7) * 0.3 + Math.sin(x * f * 5.1 + s * 0.3) * 0.2;
      this.mount = Array.from({ length: W }, (_, x) => Math.round(108 + n(x, 0.018, 1.3) * 26));
      this.hills = Array.from({ length: W }, (_, x) => Math.round(150 + n(x, 0.03, 4.1) * 12));
      this.trees = [32, 96, 150, 190, 262, 300, 338].map((x) => ({ x, h: rnd(14, 22) | 0 }));
      this.tufts = Array.from({ length: 46 }, () => ({ x: rnd(0, W) | 0, h: rnd(2, 4) | 0 }));
    }

    background(tier) {
      if (this.layers[tier]) return this.layers[tier];
      const P = WEATHER[tier];
      const [c, g] = makeCanvas(W, H);
      // banded sky with checker dither between bands
      const bands = P.sky.length;
      const bh = Math.ceil(GROUND / bands);
      for (let i = 0; i < bands; i++) {
        rect(g, 0, i * bh, W, bh, P.sky[i]);
        if (i < bands - 1) {
          g.fillStyle = P.sky[i + 1];
          for (let x = 0; x < W; x += 2) { g.fillRect(x, i * bh + bh - 2, 1, 1); g.fillRect(x + 1, i * bh + bh - 1, 1, 1); }
        }
      }
      if (P.sun) { pxCircle(g, 330, 34, 12, '#fff3b0'); pxCircle(g, 330, 34, 10, '#ffe066'); }
      else if (tier === 'storm') { pxCircle(g, 70, 30, 8, '#8a88a8'); }
      // mountains
      for (let x = 0; x < W; x++) {
        rect(g, x, this.mount[x], 1, GROUND - this.mount[x], P.mount);
        if (this.mount[x] < 100) rect(g, x, this.mount[x], 1, 3, tier === 'storm' ? '#7a7a98' : '#eef2ff');
      }
      // hills
      for (let x = 0; x < W; x++) {
        rect(g, x, this.hills[x], 1, GROUND - this.hills[x], P.hill[0]);
        if ((x + this.hills[x]) % 7 === 0) rect(g, x, this.hills[x] + 4, 1, 1, P.hill[1]);
      }
      // barn wall (arrows stick here)
      rect(g, WALL_X, 92, W - WALL_X, GROUND - 92, '#8a2a1e');
      for (let y = 96; y < GROUND; y += 6) rect(g, WALL_X, y, W - WALL_X, 1, '#5a1810');
      rect(g, WALL_X - 3, 86, W - WALL_X + 3, 6, '#5a3a2a');
      rect(g, WALL_X, 92, 2, GROUND - 92, '#5a1810');
      // ground
      rect(g, 0, GROUND, W, H - GROUND, P.ground[2]);
      rect(g, 0, GROUND, W, 5, P.ground[0]);
      rect(g, 0, GROUND + 5, W, 2, P.ground[1]);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = 0; x < W; x += 2) g.fillRect(x + ((x / 2) % 2), GROUND + 7, 1, 1);
      for (let x = 3; x < W; x += 11) { rect(g, x, GROUND + 12, 3, 1, 'rgba(0,0,0,0.25)'); rect(g, x + 5, GROUND + 22, 2, 1, 'rgba(0,0,0,0.2)'); }
      this.layers[tier] = c;
      return c;
    }

    // -------------------------------------------------------------- public setters
    setSkin(id) { this.skin = SKINS[id] || SKINS.classic; }
    setWind(w, tier) {
      this.wind = w;
      this.tier = tier || this.tier;
      if (window.SFX) window.SFX.wind(w, this.tier === 'storm');
    }
    setHelmet(on) { if (!this.ragdoll) this.partner.helmet = !!on; }
    setMultiplier(s) { this.mult = s || ''; }
    enableAim(on) { this.aim.enabled = !!on; if (!on) { this.aim.active = false; } }

    /** New round: partner (alive again) at the first distance, props restored, wall cleared. */
    newRound(distance) {
      this.arrows = [];
      this.props = [];
      this.flying = null;
      if (this.ragdoll) this.poof(this.ragdoll.p.hip.x, GROUND - 14);
      this.ragdoll = null;
      Object.assign(this.partner, { x: partnerX(distance), shake: 0, face: 'calm', scared: 0, hasTarget: true, hasHat: true, walkT: null, targetDrop: 0, headTop: GROUND - 38, targetY: GROUND - 42 });
      this.distance = distance;
      this.nocked = true;
      this.zoom.k = 1;
      this.poof(this.partner.x, GROUND - 20);
    }

    /** After a cleared shot: the partner walks back to the next distance and gets a new apple. */
    async walkTo(distance) {
      const from = this.partner.x;
      const to = partnerX(distance);
      this.distance = distance;
      this.partner.hasTarget = false;
      this.partner.hasHat = false;
      const dur = 450 + Math.abs(to - from) * 14;
      const t0 = performance.now();
      let lastStep = 0;
      await new Promise((res) => {
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / dur);
          this.partner.x = lerp(from, to, ease(k));
          this.partner.walkT = k * dur / 1000;
          if (k - lastStep > 0.12) { lastStep = k; if (window.SFX) window.SFX.walk(); }
          if (k < 1) requestAnimationFrame(tick); else { this.partner.walkT = null; res(); }
        };
        tick();
      });
      // new apple + hat drop in
      this.partner.hasTarget = true;
      this.partner.hasHat = true;
      this.partner.targetDrop = -60;
      await new Promise((res) => {
        let v = 0;
        const tick = () => {
          v += 0.6;
          this.partner.targetDrop = Math.min(0, this.partner.targetDrop + v);
          if (this.partner.targetDrop < 0) requestAnimationFrame(tick);
          else { this.partner.targetDrop = 0; this.dust(this.partner.x, this.partner.targetY, 4, '#ffffff'); res(); }
        };
        tick();
      });
      this.nocked = true;
    }

    /** Animated aim + release for the SHOOT button / keyboard. */
    async autoAim() {
      const target = Math.atan2((this.partner.targetY || GROUND - 44) - (GROUND - 24), this.partner.x - ARCHER_X) - 0.06 - this.distance * 0.0025;
      const a0 = this.aim.ang;
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / 380);
          this.aim.ang = lerp(a0, target, ease(k));
          this.aim.pull = ease(k) * 0.85;
          if (k < 1) requestAnimationFrame(tick); else res();
        };
        tick();
      });
      return { angle: this.aim.ang, power: this.aim.pull };
    }

    /** Releases the string (instant). Returns where the arrow leaves the bow. */
    release() {
      if (window.SFX) window.SFX.twang();
      const n = this.nockPos();
      this.nocked = false;
      const pull = this.aim.pull;
      this.aim.pull = 0;
      return { n, pull };
    }

    nockPos() {
      if (!this.scratch) this.scratch = makeCanvas(1, 1)[1];
      return drawArcher(this.scratch, this.skin, ARCHER_X, this.aim.ang, this.aim.pull, false, 0).nock;
    }

    /**
     * Flies the arrow onto the server outcome:
     *   bullseye | hit | hat_trick | near_miss | lethal (saved = helmet)
     */
    async shoot({ outcome, saved, from, power = 0.8 }) {
      const p = this.partner;
      const start = from || this.nockPos();
      const top = p.targetY;
      const T = {
        bullseye: [p.x - 2, top + 0.5],
        hit: [p.x - 2, top + (Math.random() < 0.5 ? -1.5 : 2)],
        hat_trick: [p.x - 3, top - 6],
        near_miss: [p.x - 4, p.headTop + 1],
        lethal: saved ? [p.x - 5, p.headTop - 1] : [p.x - 6, GROUND - 21]
      }[outcome];
      const passes = outcome !== 'lethal';
      const D = T[0] - start[0];
      const aimAng = this.aim.ang;
      const arc = 4 + D * 0.09 * (0.6 + power * 0.5);
      const P0 = start;
      const P1 = [P0[0] + Math.cos(aimAng) * D * 0.33, P0[1] + Math.sin(aimAng) * D * 0.33 - arc];
      const P2 = [T[0] - D * 0.3, T[1] - arc * 0.45];
      const P3 = T;
      const bez = (t) => {
        const u = 1 - t;
        return [
          u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
          u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]
        ];
      };
      const wob = Math.min(5, Math.abs(this.wind) * 0.45) * (this.tier === 'storm' ? 1.3 : 1);
      if (window.SFX) window.SFX.whoosh(0.4 + D * 0.003);
      const flight = { x: P0[0], y: P0[1], ang: aimAng, carry: null };
      this.flying = flight;
      // scared before impact on long / stormy shots
      p.face = 'scared'; p.scared = 1;
      const dur = 260 + D * 3.2;
      await this.animate(dur, (k) => {
        // bullet time on the last stretch
        const t = k < 0.7 ? k / 0.7 * 0.82 : 0.82 + (k - 0.7) / 0.3 * 0.18;
        const [x, y] = bez(t);
        const [x2, y2] = bez(Math.min(1, t + 0.01));
        const perp = Math.sin(t * Math.PI * 3) * wob * t * (1 - t) * 4 * Math.sign(this.wind || 1);
        flight.x = x; flight.y = y + perp;
        flight.ang = Math.atan2(y2 - y, x2 - x);
        this.zoom.k = 1 + Math.max(0, (k - 0.55) / 0.45) * 0.55;
        this.zoom.cx = lerp(W / 2, p.x - 20, Math.max(0, (k - 0.55) / 0.45));
        this.zoom.cy = lerp(H / 2, top + 8, Math.max(0, (k - 0.55) / 0.45));
      });

      // ---------------- impact
      if (outcome === 'lethal' && saved) {
        if (window.SFX) window.SFX.clang();
        this.sparks(flight.x, flight.y, '#ffffff', 14);
        this.sparks(flight.x, flight.y, '#ffd23f', 10);
        this.shake(8);
        // arrow bounces back and falls
        this.flying = null;
        this.props.push({ kind: 'arrow', x: flight.x, y: flight.y, vx: -2.2, vy: -3, ang: flight.ang, spin: -0.35 });
        p.shake = 0; p.face = 'scared';
        await this.wobble(500);
        p.face = 'calm'; p.scared = 0;
        await this.relaxZoom();
        return;
      }
      if (outcome === 'lethal') {
        if (window.SFX) window.SFX.bonk();
        this.shake(10);
        this.flying = null;
        this.stars(flight.x, flight.y);
        // props fall off, ragdoll starts
        if (p.hasTarget) this.props.push({ kind: 'target', x: p.x, y: top, vx: rnd(-1, 1.5), vy: -2.5, ang: 0, spin: 0.2 });
        if (p.hasHat) this.props.push({ kind: 'hat', x: p.x, y: top - 7, vx: rnd(0.5, 2), vy: -3.2, ang: 0, spin: 0.15 });
        p.hasTarget = false; p.hasHat = false;
        this.ragdoll = new Ragdoll(p.x, this.skin, -2.6);
        this.ragdollArrow = true;
        await sleep(250);
        if (window.SFX) window.SFX.lose();
        await sleep(650);
        await this.relaxZoom();
        return;
      }

      // pass-through: the arrow continues into the barn wall carrying what it hit
      if (outcome === 'bullseye') {
        if (window.SFX) { window.SFX.crunch(); setTimeout(() => window.SFX.coin(), 120); }
        p.hasTarget = false;
        this.props.push({ kind: 'half', side: -1, x: p.x - 1, y: top, vx: -1.3, vy: -3.4, ang: 0, spin: -0.2 });
        this.props.push({ kind: 'half', side: 1, x: p.x + 1, y: top, vx: 1.6, vy: -3.0, ang: 0, spin: 0.2 });
        this.coins(p.x, top, 16);
        this.shake(4);
      } else if (outcome === 'hit') {
        if (window.SFX) window.SFX.crunch();
        p.hasTarget = false;
        flight.carry = 'apple';
        this.juice(p.x, top);
      } else if (outcome === 'hat_trick') {
        if (window.SFX) window.SFX.hat();
        p.hasHat = false;
        flight.carry = 'hat';
      } else if (outcome === 'near_miss') {
        if (window.SFX) window.SFX.gasp();
        this.hair(p.x, p.headTop);
        p.shake = 0;
      }
      const ang = flight.ang;
      const sx = flight.x; const sy = flight.y;
      const ex = WALL_X + 3;
      const ey = clamp(sy + Math.tan(ang) * (ex - sx) + 2, 96, GROUND - 6);
      await this.animate(Math.max(80, (ex - sx) * 2.2), (k) => {
        flight.x = lerp(sx, ex, k);
        flight.y = lerp(sy, ey, k);
        this.zoom.k = lerp(this.zoom.k, 1.25, 0.1);
        this.zoom.cx = lerp(this.zoom.cx, (p.x + WALL_X) / 2, 0.08);
      });
      if (window.SFX) window.SFX.thunk();
      this.arrows.push({ x: ex, y: ey, ang: Math.atan2(ey - sy, ex - sx), carry: flight.carry, skin: this.skin });
      this.flying = null;
      this.dust(ex - 1, ey, 5, '#d8b080');
      if (outcome === 'near_miss') await this.wobble(420);
      await sleep(260);
      p.face = 'calm'; p.scared = 0;
      if (window.SFX) window.SFX.step();
      await this.relaxZoom();
    }

    animate(ms, fn) {
      const t0 = performance.now();
      return new Promise((res) => {
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          fn(k);
          if (k < 1) requestAnimationFrame(tick); else res();
        };
        tick();
      });
    }

    async relaxZoom() {
      const k0 = this.zoom.k; const cx0 = this.zoom.cx; const cy0 = this.zoom.cy;
      await this.animate(380, (k) => {
        const e = ease(k);
        this.zoom.k = lerp(k0, 1, e); this.zoom.cx = lerp(cx0, W / 2, e); this.zoom.cy = lerp(cy0, H / 2, e);
      });
    }

    async wobble(ms) {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        this.partner.shake = Math.round(rnd(-1.4, 1.4));
        await sleep(40);
      }
      this.partner.shake = 0;
    }

    shake(n) { this.shakeT = Math.max(this.shakeT, n); }

    // -------------------------------------------------------------- particles
    part(o) { this.parts.push({ g: 0.18, life: 1, size: 1, ...o }); }
    sparks(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2); const s = rnd(1, 3.2); this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, c, decay: rnd(0.03, 0.06), g: 0.1 }); } }
    coins(x, y, n) { for (let i = 0; i < n; i++) this.part({ x, y, vx: rnd(-2.4, 2.4), vy: rnd(-4.6, -2), c: i % 3 ? '#ffd23f' : '#fff3b0', size: 2, decay: 0.012, coin: true, g: 0.16 }); }
    juice(x, y) { for (let i = 0; i < 10; i++) this.part({ x, y, vx: rnd(-1.6, 2.4), vy: rnd(-2.4, 0.4), c: i % 2 ? '#ff5a5a' : '#fff2c0', decay: 0.03 }); }
    hair(x, y) { for (let i = 0; i < 8; i++) this.part({ x: x + rnd(-3, 3), y, vx: rnd(0.2, 1.6), vy: rnd(-1.6, -0.2), c: this.skin.partner.hair, decay: 0.012, g: 0.04 }); }
    dust(x, y, n, c) { for (let i = 0; i < n; i++) this.part({ x, y, vx: rnd(-1, 1), vy: rnd(-1.2, -0.2), c, decay: 0.05, g: 0.05 }); }
    poof(x, y) { for (let i = 0; i < 18; i++) { const a = rnd(0, Math.PI * 2); this.part({ x, y, vx: Math.cos(a) * rnd(0.4, 1.6), vy: Math.sin(a) * rnd(0.4, 1.6), c: '#ffffff', size: 2, decay: 0.04, g: -0.01 }); } }
    stars(x, y) { this.starT = 2.4; this.starAt = [x, y]; }

    // -------------------------------------------------------------- input
    bindInput() {
      const c = this.canvas;
      const pos = (e) => {
        const r = c.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
      };
      let s = null;
      c.addEventListener('pointerdown', (e) => {
        if (!this.aim.enabled || this.flying || !this.nocked) return;
        if (window.SFX) window.SFX.unlock();
        s = pos(e);
        this.aim.active = true;
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.aim.active || !s) return;
        const [x, y] = pos(e);
        const dx = s[0] - x; const dy = s[1] - y; // drag back = aim forward
        const len = Math.hypot(dx, dy);
        const prev = this.aim.pull;
        this.aim.pull = clamp(len / 70, 0, 1);
        if (len > 4) this.aim.ang = clamp(Math.atan2(dy, Math.max(4, dx)), -0.75, 0.35);
        if (window.SFX && Math.floor(this.aim.pull * 6) !== Math.floor(prev * 6)) window.SFX.pull(this.aim.pull);
      });
      const up = () => {
        if (!this.aim.active) return;
        this.aim.active = false;
        s = null;
        if (this.aim.pull < 0.22) { this.aim.pull = 0; return; }
        if (this.onRelease) this.onRelease({ angle: this.aim.ang, power: this.aim.pull });
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', () => { this.aim.active = false; this.aim.pull = 0; s = null; });
    }

    // -------------------------------------------------------------- update / render
    update(dt) {
      this.t += dt;
      const w = this.wind;
      for (const cl of this.clouds) {
        cl.x += (w * 2.2 + 1.2 * Math.sign(w || 1) * 0.3) * dt * cl.s;
        if (cl.x > W + 50) cl.x = -50; if (cl.x < -50) cl.x = W + 50;
      }
      if (this.tier === 'storm') {
        for (const r of this.rain) {
          r.y += r.s * 60 * dt * 2.2; r.x += w * 0.9 * 60 * dt * 0.25;
          if (r.y > GROUND) { r.y = rnd(-20, 0); r.x = rnd(-20, W + 20); }
        }
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = rnd(3, 7);
          this.flash = 1;
          const bx = rnd(120, 360);
          let y = 0; let x = bx; const seg = [];
          while (y < this.hills[Math.round(clamp(x, 0, W - 1))]) { const nx = x + rnd(-8, 8); const ny = y + rnd(8, 16); seg.push([x, y, nx, ny]); x = nx; y = ny; }
          this.bolt = { seg, t: 0.25 };
          if (window.SFX) setTimeout(() => window.SFX.thunder(), 250);
        }
      }
      this.flash = Math.max(0, this.flash - dt * 5);
      if (this.bolt) { this.bolt.t -= dt; if (this.bolt.t <= 0) this.bolt = null; }
      // particles
      for (const q of this.parts) {
        q.vy += q.g; q.x += q.vx; q.y += q.vy; q.life -= q.decay || 0.03;
        if (q.y > GROUND && q.coin) { q.y = GROUND; q.vy *= -0.45; q.vx *= 0.7; }
      }
      this.parts = this.parts.filter((q) => q.life > 0);
      // free props
      for (const pr of this.props) {
        if (pr.rest) continue;
        pr.vy += 0.22; pr.x += pr.vx; pr.y += pr.vy; pr.ang += pr.spin;
        if (pr.y > GROUND - 3) { pr.y = GROUND - 3; pr.vy *= -0.35; pr.vx *= 0.6; pr.spin *= 0.5; if (Math.abs(pr.vy) < 0.5) { pr.rest = true; pr.ang = pr.kind === 'arrow' ? 0 : pr.ang; } }
      }
      if (this.ragdoll && this.ragdoll.rest < 360) this.ragdoll.step();
      if (this.shakeT > 0) this.shakeT -= 1;
      if (this.starT > 0) this.starT -= dt;
      // storm: partner trembles
      if (this.tier === 'storm' && !this.ragdoll && !this.flying && this.partner.walkT == null) this.partner.shake = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      else if (this.tier !== 'storm' && !this.flying) this.partner.shake = this.partner.shake && this.partner.scared ? this.partner.shake : 0;
    }

    render() {
      const g = this.g;
      const P = WEATHER[this.tier] || WEATHER.calm;
      g.drawImage(this.background(this.tier), 0, 0);
      // clouds
      for (const cl of this.clouds) {
        const x = Math.round(cl.x); const y = Math.round(cl.y); const w = Math.round(cl.w);
        rect(g, x, y + 4, w, 5, P.cloud); rect(g, x + 4, y, w - 12, 5, P.cloud); rect(g, x + w * 0.4, y - 3, w * 0.35 | 0, 4, P.cloud);
        rect(g, x, y + 8, w, 1, 'rgba(0,0,0,0.12)');
      }
      if (this.bolt) for (const [a, b, c, d] of this.bolt.seg) pxLine(g, a, b, c, d, '#fffbd0', 2);
      // trees on the hills (sway with wind)
      for (const tr of this.trees) {
        const base = this.hills[tr.x];
        const sway = Math.round(Math.sin(this.t * (1 + Math.abs(this.wind) * 0.4) + tr.x) * Math.min(3, Math.abs(this.wind) * 0.35) + this.wind * 0.18);
        rect(g, tr.x, base - 8, 2, 8, '#5a3a22');
        rect(g, tr.x - 5 + sway, base - tr.h, 12, tr.h - 6, P.hill[1]);
        rect(g, tr.x - 3 + sway, base - tr.h - 3, 8, 3, P.hill[1]);
        rect(g, tr.x - 3 + sway, base - tr.h + 1, 3, 3, 'rgba(255,255,255,0.12)');
      }
      // flag pole (wind sock)
      this.drawFlag(g, 90, GROUND - 52);
      // distance marker under the partner
      if (!this.ragdoll) {
        const mx = partnerX(this.distance);
        rect(g, mx - 1, GROUND + 2, 2, 6, '#f4e8c8');
        text(g, `${this.distance}m`, mx, GROUND + 10, '#fff4d6', 'center');
      }
      // grass tufts
      for (const tf of this.tufts) {
        const sw = Math.round(Math.sin(this.t * 3 + tf.x * 0.3) * Math.min(2, Math.abs(this.wind) * 0.2) + Math.sign(this.wind) * Math.min(1, Math.abs(this.wind) * 0.15));
        rect(g, tf.x + sw, GROUND - tf.h, 1, tf.h, P.ground[0]);
        rect(g, tf.x + 2, GROUND - tf.h + 1, 1, tf.h - 1, P.ground[1]);
      }
      // stuck arrows (behind the partner)
      for (const a of this.arrows) drawArrow(g, a.x, a.y, a.ang, 15, a.carry, a.skin);
      // characters
      drawArcher(g, this.skin, ARCHER_X, this.aim.ang, this.aim.pull, this.nocked, this.t);
      if (this.aim.active && this.aim.pull > 0.1) this.drawAimGuide(g);
      if (this.ragdoll) {
        this.ragdoll.draw(g);
        if (this.ragdollArrow) { const ch = this.ragdoll.chest; drawArrow(g, ch.x - 1, ch.y, 0.15, 14); }
      } else {
        drawPartner(g, this.skin, this.partner, this.t);
      }
      // props
      for (const pr of this.props) {
        if (pr.kind === 'arrow') drawArrow(g, pr.x, pr.y, pr.ang, 14);
        else if (pr.kind === 'target') drawTarget(g, this.skin.partner.target, pr.x, pr.y);
        else if (pr.kind === 'hat') drawHat(g, this.skin.partner.hat, pr.x, pr.y + 3);
        else if (pr.kind === 'half') drawTarget(g, this.skin.partner.target, pr.x, pr.y, pr.side);
      }
      if (this.flying) drawArrow(g, this.flying.x, this.flying.y, this.flying.ang, 15, this.flying.carry, this.skin);
      // particles
      for (const q of this.parts) {
        g.globalAlpha = clamp(q.life * 1.5, 0, 1);
        rect(g, q.x, q.y, q.size, q.size, q.c);
        if (q.coin && q.size > 1) rect(g, q.x, q.y, 1, 1, '#fffbe0');
      }
      g.globalAlpha = 1;
      if (this.starT > 0 && this.ragdoll) {
        const h = this.ragdoll.p.head;
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + (i * Math.PI * 2) / 3;
          const sx = h.x + Math.cos(a) * 7; const sy = h.y - 10 + Math.sin(a) * 2;
          rect(g, sx, sy - 1, 1, 3, '#ffd23f'); rect(g, sx - 1, sy, 3, 1, '#ffd23f');
        }
      }
      // rain
      if (this.tier === 'storm') {
        g.fillStyle = 'rgba(190,200,255,0.55)';
        for (const r of this.rain) { g.fillRect(Math.round(r.x), Math.round(r.y), 1, 3); }
      }
      // HUD: wind vane + multiplier
      this.drawHud(g);
      if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`; g.fillRect(0, 0, W, H); }

      // blit with zoom + shake (nearest neighbour)
      const o = this.out;
      const k = this.zoom.k;
      const sw = W / k; const sh = H / k;
      let sx = clamp(this.zoom.cx - sw / 2, 0, W - sw);
      let sy = clamp(this.zoom.cy - sh / 2, 0, H - sh);
      if (this.shakeT > 0) { sx = clamp(sx + rnd(-2, 2), 0, W - sw); sy = clamp(sy + rnd(-2, 2), 0, H - sh); }
      o.imageSmoothingEnabled = false;
      o.drawImage(this.buf, sx, sy, sw, sh, 0, 0, W, H);
    }

    drawAimGuide(g) {
      const n = this.nockPos();
      const sp = 3 + this.aim.pull * 5;
      let x = n[0]; let y = n[1];
      let vx = Math.cos(this.aim.ang) * sp; let vy = Math.sin(this.aim.ang) * sp;
      for (let i = 0; i < 9; i++) {
        x += vx * 2.2; y += vy * 2.2; vy += 0.16;
        if (i % 2 === 0) rect(g, x, y, 1, 1, '#ffffff');
      }
    }

    drawFlag(g, x, y) {
      rect(g, x, y, 1, GROUND - y, '#d8d8e0');
      rect(g, x - 1, y - 2, 3, 2, '#ffd23f');
      const w = this.wind;
      const s = Math.abs(w);
      const dir = w >= 0 ? 1 : -1;
      const len = 12;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        // calm: hangs down; stronger wind: flies out and flaps
        const droop = Math.max(0, 1 - s / 4) * k * 9;
        const flap = Math.sin(this.t * (4 + s * 1.4) - i * 0.7) * Math.min(2.5, 0.4 + s * 0.25) * k;
        const fx = x + dir * (1 + i * Math.min(1, 0.3 + s / 5));
        const fy = y + droop + flap;
        rect(g, fx, fy, 1, 7 - Math.floor(k * 2), i % 4 < 2 ? '#ff3b3b' : '#ffffff');
      }
    }

    drawHud(g) {
      const w = this.wind;
      const tierColor = { calm: '#3ddc84', breeze: '#46e0ff', crosswind: '#ffd23f', storm: '#ff5a5a' }[this.tier] || '#fff';
      rect(g, 6, 6, 92, 26, 'rgba(7,10,31,0.72)');
      rect(g, 6, 6, 92, 1, tierColor);
      // arrow glyph
      const ax = 12; const ay = 15;
      const dir = w >= 0 ? 1 : -1;
      const L = 14;
      const x0 = dir > 0 ? ax : ax + L; const x1 = dir > 0 ? ax + L : ax;
      pxLine(g, x0, ay, x1, ay, tierColor, 2);
      pxLine(g, x1, ay, x1 - dir * 4, ay - 4, tierColor, 2);
      pxLine(g, x1, ay, x1 - dir * 4, ay + 4, tierColor, 2);
      text(g, `${Math.abs(w).toFixed(1)}m/s`, 32, 11, '#fff4d6');
      const I = window.I18N;
      text(g, this.tier && I && I.has(`wind.short.${this.tier}`) ? I.t(`wind.short.${this.tier}`) : (this.tier || '').toUpperCase(), 12, 23, tierColor);
      if (this.mult) {
        text(g, this.mult, W / 2, 8, '#ffd23f', 'center', 16);
      }
    }
  }

  // skin preview for the skins sheet
  function drawSkinPreview(canvas, id) {
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const [b, bg] = makeCanvas(48, 48);
    const sk = SKINS[id];
    rect(bg, 0, 0, 48, 48, '#0b1030');
    bg.save();
    bg.translate(0, -GROUND + 46);
    drawPartner(bg, sk, { x: 34, shake: 0, face: 'calm', scared: 0, hasTarget: true, hasHat: true, helmet: false, walkT: null }, 0);
    bg.restore();
    bg.save();
    bg.translate(-ARCHER_X + 12, -GROUND + 46);
    drawArcher(bg, sk, ARCHER_X, -0.1, 0.4, true, 0);
    bg.restore();
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(b, 0, 0, canvas.width, canvas.height);
  }

  window.AppleScene = { Scene, SKINS, drawSkinPreview, partnerX };
})();
