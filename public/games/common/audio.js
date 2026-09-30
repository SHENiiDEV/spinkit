/**
 * Procedural Web Audio sound design — no audio files required.
 * All sounds go through a master gain + compressor so they sit together.
 */
class SlotAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.spinNode = null;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopReelSpin();
    return this.muted;
  }

  ok() {
    if (this.muted) return false;
    this.init();
    return !!this.ctx;
  }

  tone(freq, dur = 0.15, { type = 'sine', vol = 0.2, to = null, delay = 0, attack = 0.005 } = {}) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur = 0.1, { freq = 1200, q = 1, vol = 0.2, delay = 0, type = 'bandpass' } = {}) {
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  chord(notes, dur, opts = {}) {
    notes.forEach((n, i) => this.tone(n, dur, { ...opts, delay: (opts.delay || 0) + i * (opts.arp || 0) }));
  }

  // ------------------------------------------------------------ UI
  playSpinClick() {
    if (!this.ok()) return;
    this.tone(900, 0.05, { type: 'triangle', vol: 0.12, to: 500 });
  }

  playCoin() {
    if (!this.ok()) return;
    this.tone(1318, 0.12, { type: 'square', vol: 0.06 });
    this.tone(1760, 0.3, { type: 'square', vol: 0.06, delay: 0.07 });
  }

  playTick() {
    if (!this.ok()) return;
    this.tone(2200 + Math.random() * 400, 0.04, { type: 'square', vol: 0.03 });
  }

  // ------------------------------------------------------------ reels
  startReelSpin() {
    if (!this.ok() || this.spinNode) return;
    const o = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = 70;
    lfo.frequency.value = 18;
    lg.gain.value = 0.03;
    lfo.connect(lg);
    lg.connect(g.gain);
    f.type = 'lowpass';
    f.frequency.value = 500;
    g.gain.value = 0.035;
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start();
    lfo.start();
    this.spinNode = { o, lfo, g };
  }

  stopReelSpin() {
    if (!this.spinNode || !this.ctx) return;
    const { o, lfo, g } = this.spinNode;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.05);
    o.stop(t + 0.3);
    lfo.stop(t + 0.3);
    this.spinNode = null;
  }

  playReelStop(i = 0) {
    if (!this.ok()) return;
    this.tone(180 - i * 8, 0.12, { type: 'triangle', vol: 0.22, to: 60 });
    this.noise(0.05, { freq: 2500, vol: 0.08 });
  }

  playLand(col = 0) {
    if (!this.ok()) return;
    this.tone(260 - col * 12, 0.1, { type: 'sine', vol: 0.16, to: 90 });
    this.noise(0.04, { freq: 1800, vol: 0.05 });
  }

  playAnticipation() {
    if (!this.ok()) return;
    for (let i = 0; i < 8; i++) this.tone(440 + i * 55, 0.14, { type: 'triangle', vol: 0.07, delay: i * 0.12 });
  }

  playScatterLand(n = 1) {
    if (!this.ok()) return;
    const base = [523, 659, 784, 1046, 1318, 1568][Math.min(5, n - 1)] || 523;
    this.tone(base, 0.35, { type: 'triangle', vol: 0.2 });
    this.tone(base * 1.5, 0.35, { type: 'sine', vol: 0.1, delay: 0.05 });
  }

  playScatterAlert() {
    this.playScatterLand(3);
  }

  // ------------------------------------------------------------ wins
  playLineWin(tier = 1) {
    if (!this.ok()) return;
    const scale = [523, 587, 659, 784, 880, 1046];
    for (let i = 0; i < 2 + tier; i++) this.tone(scale[i % scale.length], 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.07 });
  }

  playExplode() {
    if (!this.ok()) return;
    this.noise(0.25, { freq: 900, q: 0.7, vol: 0.25, type: 'lowpass' });
    this.tone(320, 0.2, { type: 'sine', vol: 0.12, to: 80 });
  }

  playMultiplier() {
    if (!this.ok()) return;
    this.tone(880, 0.25, { type: 'sawtooth', vol: 0.08, to: 1760 });
    this.noise(0.2, { freq: 4000, vol: 0.06 });
  }

  playTierUp() {
    if (!this.ok()) return;
    this.chord([523, 659, 784, 1046], 0.5, { type: 'triangle', vol: 0.1, arp: 0.06 });
  }

  playBigWin() {
    if (!this.ok()) return;
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((n, i) => this.tone(n, 0.3, { type: 'square', vol: 0.06, delay: i * 0.11 }));
    this.chord([262, 330, 392], 1.2, { type: 'sawtooth', vol: 0.04, delay: 0.7 });
  }

  playFreeSpinsTrigger() {
    if (!this.ok()) return;
    const seq = [392, 523, 659, 784, 1046, 1318, 1568];
    seq.forEach((n, i) => this.tone(n, 0.25, { type: 'triangle', vol: 0.14, delay: i * 0.08 }));
    this.chord([523, 659, 784, 1046], 1.4, { type: 'sine', vol: 0.08, delay: 0.6 });
  }
}

window.slotAudio = new SlotAudio();
