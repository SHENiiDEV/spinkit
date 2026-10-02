/* Fruit Slash — sound effects synthesised with WebAudio (no files). */
(function () {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('fs_muted') === '1'; } catch { /* storage blocked */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.12, vol = 0.2, delay = 0 }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, sweep = null, attack = 0.004 }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const notes = (seq, step = 0.07, type = 'triangle', vol = 0.16) => seq.forEach((f, i) => f && tone({ type, f0: f, dur: step * 2, vol, delay: i * step }));

  window.SFX = {
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('fs_muted', muted ? '1' : '0'); } catch { /* ignore */ }
      if (ensure()) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    click() { tone({ type: 'triangle', f0: 900, dur: 0.05, vol: 0.1 }); },
    swish(speed = 1) { noise({ dur: 0.16, vol: 0.12 * Math.min(1.5, speed), freq: 2200, sweep: 5200, q: 0.7 }); },
    throw() { noise({ dur: 0.35, vol: 0.14, freq: 300, sweep: 900, q: 0.6, type: 'lowpass', attack: 0.05 }); },
    slice() { noise({ dur: 0.18, vol: 0.35, freq: 1800, q: 0.9 }); noise({ dur: 0.22, vol: 0.18, freq: 500, type: 'lowpass', delay: 0.02 }); tone({ f0: 320, f1: 160, dur: 0.12, vol: 0.06 }); },
    combo(n) { notes([523, 659, 784, 1047, 1319].slice(0, Math.max(3, n)), 0.06, 'square', 0.1); },
    clang() { [2100, 2780, 3510].forEach((f) => tone({ type: 'square', f0: f, f1: f * 0.97, dur: 0.45, vol: 0.05 })); noise({ dur: 0.1, vol: 0.2, freq: 5200 }); },
    fuse() { noise({ dur: 0.5, vol: 0.05, freq: 6000, q: 2 }); },
    boom() { noise({ dur: 1.4, vol: 0.9, freq: 900, sweep: 60, q: 0.4, type: 'lowpass' }); tone({ type: 'sine', f0: 90, f1: 32, dur: 0.9, vol: 0.5 }); },
    shield() { notes([392, 523, 784, 1047], 0.05, 'sine', 0.18); noise({ dur: 0.4, vol: 0.1, freq: 3000, q: 3 }); },
    coin() { notes([1319, 1568, 2093, 2637], 0.05, 'square', 0.09); },
    frenzy() { notes([523, 784, 1047, 1568, 2093, 1568, 2093], 0.07, 'triangle', 0.14); },
    cashout() { notes([523, 659, 784, 1047, 1319, 1568], 0.07, 'triangle', 0.16); },
    start() { notes([392, 523, 659], 0.06, 'triangle', 0.12); },
    lose() { notes([330, 311, 294, 220], 0.2, 'sawtooth', 0.08); },
    gong() { tone({ type: 'sine', f0: 196, f1: 180, dur: 1.4, vol: 0.25 }); tone({ type: 'sine', f0: 392, f1: 370, dur: 1.0, vol: 0.08 }); }
  };
})();
