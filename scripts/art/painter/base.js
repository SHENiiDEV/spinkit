/**
 * Browser-side helpers shared by every art painter (injected into the page as source text):
 * seeded random, colour maths, Twemoji image loading.
 */
module.exports = String.raw`
const TAU = Math.PI * 2;
let seed = 5;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hex(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
const imgs = {};
async function loadImages(map) { await Promise.all(Object.entries(map).map(([k, src]) => new Promise((res) => { const i = new Image(); i.onload = () => { imgs[k] = i; res(); }; i.onerror = res; i.src = src; }))); }
`;
