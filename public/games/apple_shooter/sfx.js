/* Apple Shooter — 8-bit sound effects, synthesised with WebAudio (no files). */
(function () {
  let ctx = null;
  let master = null;
  let windGain = null;
  let rainGain = null;
  let muted = false;
  try { muted = localStorage.getItem('as_muted') === '1'; } catch { /* storage blocked */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // looping noise beds for wind and rain
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const bed = (freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      return g;
    };
    windGain = bed(420, 0.6);
    rainGain = bed(5200, 0.4);
    return ctx;
  }

  function tone({ type = 'square', f0 = 440, f1 = null, dur = 0.12, vol = 0.25, delay = 0 }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.3, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, sweep = null }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const notes = (seq, step = 0.07, type = 'square', vol = 0.18) => seq.forEach((f, i) => f && tone({ type, f0: f, dur: step * 1.6, vol, delay: i * step }));

  const SFX = {
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('as_muted', muted ? '1' : '0'); } catch { /* ignore */ }
      if (ensure()) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    click() { tone({ f0: 880, dur: 0.04, vol: 0.12 }); },
    pull(p) { tone({ type: 'triangle', f0: 180 + p * 260, dur: 0.05, vol: 0.06 }); },
    twang() { tone({ type: 'square', f0: 520, f1: 140, dur: 0.18, vol: 0.22 }); noise({ dur: 0.08, vol: 0.15, freq: 3000 }); },
    whoosh(t = 0.6) { noise({ dur: t, vol: 0.18, freq: 800, sweep: 2600, q: 1.2 }); },
    thunk() { tone({ type: 'square', f0: 140, f1: 60, dur: 0.14, vol: 0.3 }); noise({ dur: 0.06, vol: 0.2, freq: 400 }); },
    crunch() { noise({ dur: 0.22, vol: 0.4, freq: 2400, q: 0.5 }); tone({ f0: 300, f1: 90, dur: 0.12, vol: 0.12 }); },
    coin() { notes([988, 1319, 1568, 2093], 0.06, 'square', 0.16); },
    hat() { tone({ type: 'triangle', f0: 600, f1: 1200, dur: 0.2, vol: 0.2 }); noise({ dur: 0.1, vol: 0.15, freq: 1800 }); },
    gasp() { tone({ type: 'sawtooth', f0: 900, f1: 1400, dur: 0.12, vol: 0.08 }); tone({ type: 'sawtooth', f0: 1400, f1: 700, dur: 0.18, vol: 0.08, delay: 0.12 }); },
    clang() { [1830, 2410, 3120, 4170].forEach((f, i) => tone({ type: 'square', f0: f, f1: f * 0.98, dur: 0.6, vol: 0.06 - i * 0.008 })); noise({ dur: 0.12, vol: 0.2, freq: 5000 }); },
    bonk() { tone({ type: 'square', f0: 220, f1: 70, dur: 0.25, vol: 0.32 }); noise({ dur: 0.15, vol: 0.3, freq: 600 }); },
    lose() { notes([392, 370, 349, 262], 0.22, 'sawtooth', 0.12); },
    step() { notes([523, 659, 784], 0.06, 'square', 0.14); },
    cashout() { notes([523, 659, 784, 1047, 784, 1047, 1319], 0.07, 'square', 0.16); },
    start() { notes([262, 330, 392, 523], 0.05, 'square', 0.14); },
    walk() { tone({ type: 'triangle', f0: 120, dur: 0.04, vol: 0.08 }); },
    thunder() { noise({ dur: 1.4, vol: 0.5, freq: 120, q: 0.3, type: 'lowpass', sweep: 50 }); },
    wind(speed, rain) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.22, Math.abs(speed) * 0.022), t, 0.4);
      rainGain.gain.setTargetAtTime(muted || !rain ? 0 : 0.07, t, 0.4);
    }
  };
  window.SFX = SFX;
})();
