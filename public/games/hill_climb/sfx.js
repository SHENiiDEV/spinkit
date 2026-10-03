/* Hill Climb Rush — engine and effects, synthesised with WebAudio (no files). */
(function () {
  let ctx = null;
  let master = null;
  let eng = null;
  let wind = null;
  let muted = false;
  try { muted = localStorage.getItem('hc_muted') === '1'; } catch { /* storage blocked */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);
    // engine: two detuned saws through a low-pass, pitch follows the revs
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 45;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 45.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    eng = { o1, o2, f, g };
    // wind bed for air time
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 600; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0;
    src.connect(wf); wf.connect(wg); wg.connect(master); src.start();
    wind = wg;
    return ctx;
  }

  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.4, freq = 900, delay = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0);
  }

  const SFX = {
    get muted() { return muted; },
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('hc_muted', muted ? '1' : '0'); } catch { /* ignore */ }
      if (master) master.gain.value = muted ? 0 : 0.45;
      return muted;
    },
    /** Called every frame: on = engine running, rev 0…1, throttle held. */
    engine(on, rev, gas) {
      if (!ctx || !eng) return;
      const t = ctx.currentTime;
      const base = 38 + rev * 70 + (gas ? 14 : 0);
      eng.o1.frequency.setTargetAtTime(base, t, 0.05);
      eng.o2.frequency.setTargetAtTime(base * 1.015, t, 0.05);
      eng.f.frequency.setTargetAtTime(gas ? 900 + rev * 900 : 450, t, 0.08);
      eng.g.gain.setTargetAtTime(on ? (gas ? 0.16 : 0.08) : 0, t, 0.08);
    },
    air(level) { if (wind && ctx) wind.gain.setTargetAtTime(Math.min(0.25, level), ctx.currentTime, 0.1); },
    click() { tone(900, 0.05, 'square', 0.12); },
    horn() { tone(392, 0.16, 'square', 0.18); tone(494, 0.2, 'square', 0.16, 0, 0.14); },
    land(power = 1) { noise(0.18, 0.35 * power, 300); tone(90, 0.15, 'sine', 0.3 * power, -40); },
    crash() { noise(0.6, 0.7, 1400); tone(120, 0.5, 'sawtooth', 0.25, -90); tone(1400, 0.08, 'square', 0.12, 0, 0.12); },
    sputter() { for (let i = 0; i < 4; i++) noise(0.07, 0.25, 500, i * 0.16); },
    glug() { for (let i = 0; i < 4; i++) tone(220 + i * 40, 0.09, 'sine', 0.22, 60, i * 0.11); },
    checkpoint() { tone(660, 0.1, 'square', 0.18); tone(880, 0.1, 'square', 0.18, 0, 0.1); tone(1320, 0.22, 'square', 0.16, 0, 0.2); },
    coin() { tone(988, 0.06, 'square', 0.16); tone(1319, 0.14, 'square', 0.16, 0, 0.06); },
    trick() { tone(523, 0.08, 'triangle', 0.25); tone(784, 0.08, 'triangle', 0.25, 0, 0.08); tone(1047, 0.18, 'triangle', 0.25, 0, 0.16); },
    cashout() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.16, 0, i * 0.09)); for (let i = 0; i < 6; i++) tone(1200 + i * 90, 0.05, 'square', 0.08, 0, 0.4 + i * 0.05); },
    lose() { tone(330, 0.2, 'square', 0.18, -120); tone(220, 0.35, 'square', 0.16, -100, 0.18); }
  };
  window.SFX = SFX;
})();
