/*
 * Hill Climb Rush — game client (SpinKit Exclusive, step crash over 10 hills).
 * Talks to POST /api/v1/rgs/init and POST /api/v1/rgs/action. Holding GAS at a checkpoint sends `shoot`
 * for the next hill; the vehicle starts rolling at once and the scene steers its physics to the result.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const TOKEN = params.get('token');
  const SFX = window.SFX;
  const I18N = window.I18N;
  const t = (k, v) => I18N.t(k, v);
  const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;

  function fitText(el, text, min = 8) {
    if (el.textContent !== text) el.textContent = text;
    el.style.fontSize = '';
    if (!el.clientWidth) return;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && size > min) { size -= 1; el.style.fontSize = `${size}px`; }
  }

  class Money {
    constructor(cur) {
      this.cur = cur || { code: 'USD', symbol: '$', decimals: 2 };
      const d = this.cur.decimals;
      try {
        this.nf = new Intl.NumberFormat(I18N.locale, { style: 'currency', currency: this.cur.code, currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d });
        this.nf.format(1);
      } catch {
        const plain = new Intl.NumberFormat(I18N.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
        this.nf = { format: (v) => `${this.cur.symbol}${plain.format(v)}` };
      }
    }
    fmt(minor) { return this.nf.format(minor / Math.pow(10, this.cur.decimals)); }
  }

  const api = async (path, body) => {
    const res = await fetch(`/api/v1/rgs/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN, ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === 'error') {
      const e = new Error(data.message || `Request failed (${res.status})`);
      e.code = data.error;
      e.data = data;
      throw e;
    }
    return data;
  };

  // trick bet icons (inline SVG, currentColor)
  const ICONS = {
    backflip: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.4 5" stroke="#8fd3ff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M2.5 5.5l2.3 4.1 4-2.3" stroke="#8fd3ff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    air_time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" stroke="#8fd3ff" stroke-width="2.2" fill="none"/><path d="M12 9v4l3 2M9 3h6" stroke="#8fd3ff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
    coin_chest: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="2" fill="#a8692a"/><path d="M3 12h18" stroke="#ffd23a" stroke-width="2"/><rect x="10.5" y="10.5" width="3" height="4" fill="#ffd23a"/><circle cx="8" cy="5.5" r="2.5" fill="#ffd23a"/><circle cx="15.5" cy="5" r="2.2" fill="#ffd23a"/></svg>',
    empty_tank: '<svg viewBox="0 0 24 24"><path d="M3.5 17a8.5 8.5 0 0 1 17 0" stroke="#9aa1ad" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M3.5 17a8.5 8.5 0 0 1 2.4-6" stroke="#e8322b" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 17L6.5 12" stroke="#ffb000" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.8" fill="#f4f1ea"/></svg>',
    rollcage: '<svg viewBox="0 0 24 24"><path d="M4 19V11c0-4 3.5-7 8-7s8 3 8 7v8" stroke="#ffb000" stroke-width="2.4" fill="none"/><path d="M12 4v15M4 12h16" stroke="#ffb000" stroke-width="1.8"/><path d="M2 19h20" stroke="#f4f1ea" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  const VEH_ICON = {
    truck: '<svg viewBox="0 0 34 16"><circle cx="8" cy="11" r="4.6" fill="currentColor"/><circle cx="26" cy="11" r="4.6" fill="currentColor"/><path d="M3 7h28l-2-4H18l-2 2H5z" fill="currentColor"/></svg>',
    jeep: '<svg viewBox="0 0 34 16"><circle cx="8" cy="12.5" r="3.2" fill="currentColor"/><circle cx="26" cy="12.5" r="3.2" fill="currentColor"/><path d="M2 11V7h8l2-4h7l3 4h9v4z" fill="currentColor"/></svg>',
    bike: '<svg viewBox="0 0 34 16"><circle cx="8" cy="12" r="3.6" stroke="currentColor" stroke-width="2.2" fill="none"/><circle cx="26" cy="12" r="3.6" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M8 12l6-6h6l6 6M20 6l2-3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>'
  };
  const TRICKS = ['backflip', 'air_time', 'coin_chest', 'empty_tank', 'rollcage'];

  class Game {
    constructor() {
      this.busy = false;
      this.canSel = false;
      this.tricks = new Set();
      this.stakeIndex = 0;
      this.history = [];
      this.reached = {};
      this.deadAt = null;
      this.held = { gas: false, brake: false };
      this.pending = null; // the shoot response for the hill being driven
      this.lockUntil = 0;
      this.lastResult = null;
    }

    async boot() {
      await I18N.init('hill_climb', null);
      I18N.apply();
      this.loader(20, t('load.connecting'));
      if (!TOKEN) return this.fatal(t('load.no_token'));
      let d;
      try { d = await api('init', {}); } catch (e) { return this.fatal(this.errText(e)); }
      if (!d.game_config || !d.game_config.crash || !d.game_config.crash.crashes) return this.fatal(t('load.old_server'));
      const want = I18N.pick(d.session && d.session.lang);
      if (want !== I18N.lang) { await I18N.load(want); I18N.apply(); }
      document.title = t('title');
      this.loader(60, t('load.track'));
      this.cfg = d.game_config;
      this.crash = this.cfg.crash;
      this.money = new Money(d.currency || this.cfg.currency);
      this.session = d.session || {};
      this.balance = d.user.balance;
      this.steps = this.cfg.bet_steps;
      this.betIndex = Math.max(0, this.steps.indexOf(this.cfg.default_bet));
      this.mode = this.crash.default_mode;
      this.scene = new window.HillScene.Scene($('scene'));
      this.scene.onEvent = (type, data) => this.onScene(type, data);
      this.scene.onFrame = (h) => this.onFrame(h);
      this.apply(d);
      if (d.round) {
        this.mode = d.round.mode;
        this.betIndex = Math.max(0, this.steps.indexOf(d.round.bet));
        this.restoreReached(d.round);
        this.scene.setVehicle(this.mode);
        this.scene.resetTrack(d.round.nonce, d.round.level);
        this.toast(t('toast.restored'));
      } else {
        this.scene.setVehicle(this.mode);
        this.scene.resetTrack(this.pf.nonce, 0);
      }
      this.bindUi();
      this.buildRoute();
      if (document.fonts) document.fonts.ready.then(() => { this.render(); this.buildRoute(); });
      window.addEventListener('resize', () => { this.render(); this.buildRoute(); });
      this.loader(100, t('load.ready'));
      this.render();
      setTimeout(() => $('app').classList.remove('loading'), 250);
    }

    loader(p, text) { $('loaderFill').style.width = `${p}%`; $('loaderText').textContent = text; }
    fatal(msg) { this.loader(100, msg); $('loaderText').style.color = '#ff6a5a'; }

    apply(d) {
      if (d.balance != null) this.balance = d.balance;
      if (d.user) this.balance = d.user.balance;
      this.round = d.round || null;
      this.next = d.next || null;
      this.pf = d.provably_fair || this.pf;
      this.stats = d.stats || this.stats;
      this.skin = d.skin || this.skin || 'classic';
      this.unlocked = d.skins_unlocked || this.unlocked || ['classic'];
      if (this.scene) this.scene.setPaint(this.skin);
    }

    restoreReached(round) {
      this.reached = {};
      for (const s of round.shots) if (s.multiplier) this.reached[s.level] = s.multiplier;
    }

    get bet() { return this.round ? this.round.bet : this.steps[this.betIndex]; }
    get stakeSteps() { const b = this.bet; const s = this.steps.filter((x) => x <= b); return s.length ? s : [this.steps[0]]; }
    get stake() { const s = this.stakeSteps; return s[Math.min(this.stakeIndex, s.length - 1)]; }
    get parked() { return this.scene && this.scene.state === 'parked'; }

    // -------------------------------------------------------------- input
    bindUi() {
      document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
      this.bindPedal($('pedGas'), 'gas');
      this.bindPedal($('pedBrake'), 'brake');
      const keys = { ArrowRight: 'gas', KeyD: 'gas', ArrowUp: 'gas', KeyW: 'gas', ArrowLeft: 'brake', KeyA: 'brake', ArrowDown: 'brake', KeyS: 'brake' };
      const modalOpen = () => ![...document.querySelectorAll('.modal')].every((m) => m.hidden);
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || modalOpen()) return;
        const k = keys[e.code];
        if (k) { e.preventDefault(); if (!e.repeat) this.press(k, true); }
        if (e.code === 'KeyC' && !$('btnCash').disabled) { e.preventDefault(); this.cashout(); }
      });
      window.addEventListener('keyup', (e) => { const k = keys[e.code]; if (k) this.press(k, false); });
      window.addEventListener('blur', () => { this.press('gas', false); this.press('brake', false); });
      $('btnCash').onclick = () => this.cashout();
      $('betDown').onclick = () => this.setBet(this.betIndex - 1);
      $('betUp').onclick = () => this.setBet(this.betIndex + 1);
      $('stDown').onclick = () => this.setStake(this.stakeIndex - 1);
      $('stUp').onclick = () => this.setStake(this.stakeIndex + 1);
      $('btnRefill').onclick = () => this.refill();
      $('btnRefill').hidden = this.session.refill_enabled === false;
      $('btnSound').onclick = () => { const m = SFX.toggle(); $('btnSound').classList.toggle('off', m); };
      $('btnSound').classList.toggle('off', SFX.muted);
      $('btnRules').onclick = () => this.openRules();
      $('trHelp').onclick = () => this.openRules('tricks');
      $('btnFair').onclick = () => this.openFair();
      $('btnPaint').onclick = () => this.openPaint();
      $('btnLobby').onclick = () => {
        const url = this.session.lobby_url;
        if (url) { try { window.top.location.href = url; } catch { location.href = url; } } else if (window.parent !== window) window.parent.postMessage({ type: 'spinkit:close' }, '*');
        else location.href = '/';
      };
      I18N.select($('langSel'), () => this.relocalize());
      $('btnCan').onclick = () => { this.canSel = !this.canSel; SFX.click(); this.render(); };
      document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { b.closest('.modal').hidden = true; }; });
      document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; }));
      $('pfRotate').onclick = () => this.rotateSeed();
      $('vGo').onclick = () => this.verifyForm();
    }

    bindPedal(el, key) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
        this.press(key, true);
      });
      const up = () => this.press(key, false);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    press(key, down) {
      if (this.held[key] === down) return;
      this.held[key] = down;
      $(key === 'gas' ? 'pedGas' : 'pedBrake').classList.toggle('down', down);
      if (down && navigator.vibrate) { try { navigator.vibrate(6); } catch { /* ignore */ } }
      if (key === 'gas' && down) this.onGas();
      this.scene.input.gas = this.held.gas;
      this.scene.input.brake = this.held.brake;
    }

    onGas() {
      SFX.unlock();
      if (!this.parked || this.busy || Date.now() < this.lockUntil) return;
      if (this.round) this.driveHill(); else this.startRound();
    }

    setBet(i) {
      if (this.round || this.busy || !this.parked) return;
      this.betIndex = Math.max(0, Math.min(this.steps.length - 1, i));
      SFX.click();
      this.render();
    }

    setStake(i) {
      if (this.busy || !this.parked) return;
      this.stakeIndex = Math.max(0, Math.min(this.stakeSteps.length - 1, i));
      SFX.click();
      this.render();
    }

    setMode(m) {
      if (this.round || this.busy || !this.parked) return;
      this.mode = m;
      this.scene.setVehicle(m);
      SFX.click();
      this.render();
      this.buildRoute();
    }

    toggleTrick(id) {
      if (this.busy || !this.parked) return;
      if (this.tricks.has(id)) this.tricks.delete(id); else this.tricks.add(id);
      SFX.click();
      this.render();
    }

    // -------------------------------------------------------------- odds
    /** Trick odds for the next hill: from the server quote, or (before a round) computed exactly like the server. */
    oddsNow() {
      if (this.round && this.next) return this.next.side_bets;
      const c = this.crash;
      const chance = c.modes[this.mode].survival[0];
      const probs = { lethal: 1 - chance };
      for (const [id, s] of Object.entries(c.outcomes)) probs[id] = chance * s;
      for (const [id, s] of Object.entries(c.crashes || {})) probs[id] = (1 - chance) * s;
      const out = {};
      for (const [id, sb] of Object.entries(c.side_bets)) {
        const q = sb.wins_on.reduce((a, o) => a + (probs[o] || 0), 0);
        const o = q > 0 ? floor2(sb.rtp / q) : 0;
        out[id] = o >= 1.05 ? o : null;
      }
      return out;
    }

    sideBetsForHill() {
      const odds = this.oddsNow();
      const out = {};
      for (const id of this.tricks) if (odds[id]) out[id] = this.stake;
      return out;
    }

    canPrice() { return this.canSel && this.round && this.next && this.next.helmet_price ? this.next.helmet_price : 0; }

    hillCost() { return Object.values(this.sideBetsForHill()).reduce((a, b) => a + b, 0) + this.canPrice(); }

    // -------------------------------------------------------------- actions
    async startRound() {
      const cost = this.bet + this.hillCost();
      if (cost > this.balance) return this.toast(t('err.INSUFFICIENT_FUNDS'), true);
      // a new round always starts from the start line
      if (this.scene.state !== 'parked' || this.scene.parkLevel !== 0 || this.scene.nonce !== this.pf.nonce) {
        this.scene.resetTrack(this.pf.nonce, 0);
        this.buildRoute();
      }
      this.busy = true;
      this.reached = {};
      this.deadAt = null;
      this.clearTrickMarks();
      this.scene.go();
      SFX.horn();
      this.render();
      try {
        const d = await api('action', { action: 'start', bet: this.bet, mode: this.mode });
        this.apply(d);
        (d.jackpot_wins || []).forEach((j) => this.toast(t('toast.jackpot', { name: j.name, amount: this.money.fmt(j.amount) }), false, true));
      } catch (e) {
        this.busy = false;
        this.scene.placeAt(0);
        this.error(e);
        return this.render();
      }
      await this.requestHill();
    }

    async driveHill() {
      const cost = this.hillCost();
      if (cost > this.balance) return this.toast(t('err.INSUFFICIENT_FUNDS'), true);
      this.busy = true;
      this.clearTrickMarks();
      this.scene.go();
      this.render();
      await this.requestHill();
    }

    async requestHill() {
      const q = this.next;
      const sides = this.sideBetsForHill();
      const helmet = !!this.canPrice();
      let d;
      try {
        d = await api('action', { action: 'shoot', side_bets: sides, helmet, expect_shot: q.shot_index });
      } catch (e) {
        this.busy = false;
        this.scene.placeAt(this.round ? this.round.level : 0);
        this.error(e);
        if (e.code === 'STALE_SHOT' || e.code === 'NO_ROUND') this.resync();
        return this.render();
      }
      this.balance -= d.shot.cost;
      this.pending = d;
      const s = d.shot;
      this.scene.setPlan({ outcome: s.outcome, crash: s.crash || null, saved: s.saved, seed: parseInt(s.hash.slice(8, 16), 16) });
      this.render();
    }

    /** The scene reached a moment of the hill: reveal the server result in step with it. */
    onScene(type, data) {
      const d = this.pending;
      if (type === 'takeoff') { SFX.air(0.15); }
      if (type === 'landed') { SFX.air(0); SFX.land(1); }
      if (type === 'impact') { SFX.air(0); SFX.crash(); if (navigator.vibrate) try { navigator.vibrate([30, 40, 60]); } catch { /* ignore */ } }
      if (type === 'trick') {
        SFX.trick();
        const map = { backflip: 'trick.backflip', big_air: 'trick.air', coin_chest: 'trick.chest' };
        if (data.id === 'coin_chest') SFX.coin();
        this.pop(t(map[data.id]), '', 'trick');
      }
      if (type === 'engine_out') { SFX.sputter(); if (d && d.shot.saved) this.pop(t('can.pour'), '', 'good'); }
      if (type === 'arrived' && d && d.shot.outcome !== 'lethal') this.revealArrival(d);
      if (type === 'crash' && d) this.revealCrash(d, data.kind);
      if (type === 'parked') this.render();
    }

    revealArrival(d) {
      const shot = d.shot;
      this.pending = null;
      this.apply(d);
      this.reached[shot.level] = shot.multiplier;
      this.scene.refuel();
      SFX.checkpoint();
      this.showTrickResults(shot);
      if (shot.outcome === 'fumes') this.pop(t('trick.fumes'), `x${shot.multiplier.toFixed(2)}`, 'trick');
      if (d.settled) {
        this.history.unshift(this.historyRow(d));
        this.pop(d.settled.end === 'top' ? t('pop.summit') : t('pop.max_win'), `${this.money.fmt(d.settled.win)} · x${d.settled.multiplier.toFixed(2)}`, 'win');
        SFX.cashout();
        this.scene.coins(40);
        this.endRound();
      } else if (shot.outcome !== 'fumes') {
        this.pop(t('pop.checkpoint'), `x${shot.multiplier.toFixed(2)} · ${this.money.fmt(this.round.cashout_value)}`, 'good');
      }
      this.canSel = false;
      this.busy = false;
      this.render();
    }

    revealCrash(d, kind) {
      const shot = d.shot;
      this.pending = null;
      this.showTrickResults(shot);
      if (shot.saved) {
        this.apply(d);
        SFX.glug();
        this.pop(t('can.saved'), t('can.kept', { keep: Math.round(this.crash.helmet.keep * 100), x: this.round.multiplier.toFixed(2) }), 'good');
        this.canSel = false;
        setTimeout(() => {
          this.scene.placeAt(this.round ? this.round.level : 0);
          this.busy = false;
          this.render();
        }, 1300);
        return;
      }
      this.apply(d);
      this.deadAt = shot.level;
      SFX.lose();
      this.pop(kind === 'flip' ? t('crash.flip') : t('crash.fuel'), t('pop.lost'), 'bad');
      if (d.settled) this.history.unshift(this.historyRow(d));
      this.endRound();
      this.canSel = false;
      this.busy = false;
      this.render();
    }

    /** The round is over: after the result has sunk in, tow the vehicle back to the start line. */
    endRound() {
      this.lockUntil = Date.now() + 1200;
      this.press('gas', false);
      this.buildRoute();
      clearTimeout(this.towT);
      this.towT = setTimeout(() => {
        if (this.round) return;
        this.scene.resetTrack(this.pf.nonce, 0);
        this.routeSig = '';
        this.render();
      }, 1900);
    }

    showTrickResults(shot) {
      const won = shot.side_bets.filter((b) => b.won);
      shot.side_bets.forEach((b) => {
        const el = document.querySelector(`.chip[data-id="${b.id}"]`);
        if (!el) return;
        el.classList.add(b.won ? 'won' : 'lost');
        const r = el.querySelector('.cr');
        if (r) r.textContent = b.won ? `+${this.money.fmt(b.win)}` : '';
      });
      if (won.length) {
        SFX.coin();
        this.toast(t('tricks.won', { amount: this.money.fmt(shot.side_win) }), false, true);
      }
      clearTimeout(this.markT);
      this.markT = setTimeout(() => this.clearTrickMarks(), 3500);
    }

    clearTrickMarks() {
      document.querySelectorAll('.chip.won, .chip.lost').forEach((c) => { c.classList.remove('won', 'lost'); const r = c.querySelector('.cr'); if (r) r.textContent = ''; });
    }

    async cashout() {
      if (this.busy || !this.round || this.round.level < 1 || !this.parked) return;
      this.busy = true;
      this.render();
      try {
        const d = await api('action', { action: 'cashout' });
        const s = d.settled;
        this.history.unshift(this.historyRow(d));
        this.apply(d);
        SFX.cashout();
        this.scene.coins(30);
        this.pop(t('pop.cashed'), `${this.money.fmt(s.win)} · x${s.multiplier.toFixed(2)}`, 'win');
        this.endRound();
      } catch (e) {
        this.error(e);
      }
      this.busy = false;
      this.render();
    }

    async resync() {
      try {
        const d = await api('init', {});
        this.apply(d);
        if (d.round) { this.restoreReached(d.round); this.scene.resetTrack(d.round.nonce, d.round.level); } else this.scene.resetTrack(this.pf.nonce, 0);
      } catch { /* ignore */ }
      this.render();
    }

    async refill() {
      try {
        const res = await fetch('/api/v1/rgs/refill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
        const d = await res.json();
        if (!res.ok) { const e = new Error(d.message || t('toast.refill_failed')); e.code = d.error; throw e; }
        this.balance = d.balance;
        this.toast(t('toast.free', { amount: this.money.fmt(d.added) }), false, true);
        SFX.coin();
        this.render();
      } catch (e) { this.error(e); }
    }

    historyRow(d) {
      const s = d.settled;
      return { settled: s, nonce: s.nonce, client_seed: s.client_seed, server_seed_hash: s.server_seed_hash, shots: s.shots, mode: s.mode };
    }

    // -------------------------------------------------------------- per-frame HUD
    onFrame(h) {
      const fuel = Math.max(0, Math.min(100, h.fuel));
      $('fuelNeedle').style.transform = `rotate(${-90 + fuel * 1.8}deg)`;
      document.querySelector('.hud-fuel').classList.toggle('low', fuel < 15 && h.state !== 'parked');
      const lvl = this.scene.parkLevel;
      const dist = this.crash.distances;
      const from = lvl ? dist[lvl - 1] : 0;
      const to = dist[Math.min(lvl, dist.length - 1)];
      const driving = h.state !== 'parked';
      $('hOdo').textContent = `${Math.round(driving ? from + (to - from) * h.progress : from)} m`;
      const air = $('hAir');
      if (h.air > 0.15) { air.hidden = false; air.textContent = t('hud.air', { s: h.air.toFixed(1) }); air.classList.toggle('pro', h.air >= 2.5); } else air.hidden = true;
      SFX.engine(h.state !== 'crashed' && h.engine, Math.min(1, h.speed / 18), this.held.gas && driving);
      if (this.routeCar && this.trackLen) {
        const x = Math.max(0, Math.min(1, this.scene.car.x / this.trackLen));
        this.routeCar.setAttribute('transform', `translate(${(x * this.routeW).toFixed(1)},${this.routeY(this.scene.car.x).toFixed(1)})`);
      }
    }

    // -------------------------------------------------------------- route profile (svg)
    buildRoute() {
      const el = $('route');
      const r = el.getBoundingClientRect();
      if (!r.width || !this.scene) return;
      const hills = this.scene.hills;
      const W = r.width;
      const H = r.height;
      this.trackLen = hills[hills.length - 1].x1;
      this.routeW = W;
      const maxY = hills[hills.length - 1].yE + 4;
      const minY = Math.min(...hills.map((h) => h.V2)) - 2;
      const pad = 16;
      const sy = (y) => H - 4 - ((y - minY) / (maxY - minY)) * (H - pad - 6);
      this.routeY = (x) => sy(this.scene.groundY(x)) - 4;
      let path = `M0 ${H} `;
      for (let i = 0; i <= 240; i++) { const x = (i / 240) * this.trackLen; path += `L${((x / this.trackLen) * W).toFixed(1)} ${sy(this.scene.groundY(x)).toFixed(1)} `; }
      path += `L${W} ${H} Z`;
      const labels = this.flagLabels();
      const flags = hills.map((h, i) => {
        const fx = (h.flagX / this.trackLen) * W;
        const fy = sy(h.yE);
        const st = labels[i].state;
        return `<line class="r-pole" x1="${fx}" y1="${fy}" x2="${fx}" y2="${fy - 9}"/><circle class="r-dot ${st}" cx="${fx}" cy="${fy - 9}" r="3"/>` +
          (W > 420 || i % 2 === 1 || st === 'next' ? `<text class="r-flag ${st}" x="${Math.min(W - 16, Math.max(16, fx))}" y="${Math.max(10, fy - 14)}">${labels[i].label}</text>` : '');
      }).join('');
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="r-land" d="${path}"/>${flags}<g id="routeCar"><circle class="r-car" r="5"/></g></svg>`;
      this.routeCar = el.querySelector('#routeCar');
      this.scene.setFlags(labels);
    }

    /** Multiplier label and state of every checkpoint for the arches and the route strip. */
    flagLabels() {
      const n = this.crash.levels;
      const r = this.round;
      const surv = this.crash.modes[this.mode].survival;
      const lad = this.crash.modes[this.mode].ladder;
      let est = r && this.next ? this.next.multiplier : null;
      const out = [];
      for (let L = 1; L <= n; L++) {
        if (r) {
          if (L <= r.level) out.push({ label: `x${(this.reached[L] || 0).toFixed(2)}`, state: 'done' });
          else if (L === r.level + 1) out.push({ label: `x${this.next.multiplier.toFixed(2)}`, state: 'next' });
          else { est /= surv[L - 1]; out.push({ label: `x${fmtMult(est)}`, state: 'future' }); }
        } else if (this.deadAt && L === this.deadAt) out.push({ label: `x${fmtMult(lad[L - 1])}`, state: 'dead' });
        else if (this.deadAt && L < this.deadAt && this.reached[L]) out.push({ label: `x${this.reached[L].toFixed(2)}`, state: 'done' });
        else out.push({ label: `x${fmtMult(lad[L - 1])}`, state: L === 1 ? 'next' : 'future' });
      }
      return out;
    }

    // -------------------------------------------------------------- rendering
    render() {
      const r = this.round;
      const q = this.next;
      const fmt = (v) => this.money.fmt(v);
      const parked = this.parked;
      const idle = !r;
      document.querySelectorAll('.pd-l').forEach((el) => fitText(el, el.textContent, 10));
      fitText($('valBalance'), fmt(this.balance));
      fitText($('valBet'), fmt(this.bet));
      $('betDown').disabled = !!r || this.busy || !parked || this.betIndex === 0;
      $('betUp').disabled = !!r || this.busy || !parked || this.betIndex === this.steps.length - 1;
      if (this.stakeIndex > this.stakeSteps.length - 1) this.stakeIndex = this.stakeSteps.length - 1;
      fitText($('stVal'), fmt(this.stake));
      $('stDown').disabled = this.busy || !parked || this.stakeIndex === 0;
      $('stUp').disabled = this.busy || !parked || this.stakeIndex >= this.stakeSteps.length - 1;

      // garage
      const gar = $('garage');
      if (!gar.children.length) {
        for (const id of Object.keys(this.crash.modes)) {
          const b = document.createElement('button');
          b.dataset.mode = id;
          b.innerHTML = `${VEH_ICON[id] || ''}<span>${t(`vehicle.${id}`)}</span>`;
          b.title = t(`vehicle.${id}_tip`, { x: this.crash.modes[id].ladder.at(-1) });
          b.onclick = () => this.setMode(id);
          gar.appendChild(b);
        }
      }
      [...gar.children].forEach((b) => { b.classList.toggle('on', b.dataset.mode === this.mode); b.disabled = !!r || this.busy || !parked; });

      // hill hud
      const lvl = this.scene.parkLevel;
      const hillNo = Math.min(this.crash.levels, (r ? r.level : lvl) + 1);
      const driving = !parked;
      const shownHill = driving ? Math.min(this.crash.levels, lvl + 1) : hillNo;
      $('hHill').textContent = t('hud.hill', { n: shownHill, total: this.crash.levels });
      $('hName').textContent = this.hillName(shownHill);
      const mult = $('hMult');
      const hm = document.querySelector('.hud-mult');
      if (r && r.level >= 1) {
        mult.textContent = `x${r.multiplier.toFixed(2)}`;
        hm.classList.add('locked');
        $('hNext').textContent = q ? t('hud.next', { x: q.multiplier.toFixed(2), pct: (q.chance * 100).toFixed(0) }) : '';
      } else if (r && q) {
        mult.textContent = fmt(r.bet);
        hm.classList.remove('locked');
        $('hNext').textContent = t('hud.next', { x: q.multiplier.toFixed(2), pct: (q.chance * 100).toFixed(0) });
      } else {
        mult.textContent = fmt(this.bet);
        hm.classList.remove('locked');
        const lad = this.crash.modes[this.mode].ladder;
        $('hNext').textContent = t('hud.up_to', { x: lad[lad.length - 1] });
      }

      // pedals
      const gas = $('pedGas');
      const canGo = parked && !this.busy && (idle ? this.bet + this.hillCost() <= this.balance : true);
      gas.classList.toggle('ready', canGo);
      const tricksCost = this.hillCost();
      const extra = tricksCost ? ` +${fmt(tricksCost)}` : '';
      $('gasSub').textContent = !parked ? '' : idle ? t('pedal.start', { bet: fmt(this.bet) }) + extra : t('pedal.next_hill', { n: Math.min(this.crash.levels, r.level + 1) }) + extra;

      // pull over
      const cash = $('btnCash');
      const canCash = !!r && r.level >= 1 && !this.busy && parked;
      cash.disabled = !canCash;
      cash.classList.toggle('ready', canCash);
      $('cashVal').textContent = r && r.level >= 1 ? `${fmt(r.cashout_value)} · x${r.multiplier.toFixed(2)}` : t('btn.pullover_sub');

      // hint
      const hint = $('hint');
      const firstTime = !this.stats || this.stats.rounds < 2;
      hint.hidden = !(parked && !this.busy) && !(driving && firstTime && lvl === 0);
      hint.textContent = driving ? t('hint.drive') : idle ? t('hint.start') : t('hint.checkpoint', { n: Math.min(this.crash.levels, r.level + 1) });

      this.renderTricks();
      this.renderCan();
      const labels = this.flagLabels();
      this.scene.setFlags(labels);
      if (this.routeSig !== JSON.stringify(labels) + this.scene.nonce) { this.routeSig = JSON.stringify(labels) + this.scene.nonce; this.buildRoute(); }
    }

    hillName(n) { return I18N.has(`hill.${n}`) ? t(`hill.${n}`) : (this.crash.hill_names || [])[n - 1] || ''; }

    renderTricks() {
      const box = $('trChips');
      if (box.children.length !== TRICKS.length) {
        box.innerHTML = '';
        for (const id of TRICKS) {
          const b = document.createElement('button');
          b.className = 'chip';
          b.dataset.id = id;
          b.innerHTML = `<span class="ci">${ICONS[id]}</span><span class="cn">${t(`trick.name.${id}`)}</span><span class="co">—</span><span class="cr"></span>`;
          b.title = t(`trick.tip.${id}`);
          b.onclick = () => this.toggleTrick(id);
          box.appendChild(b);
        }
      }
      const odds = this.oddsNow();
      const lock = this.busy || !this.parked;
      [...box.children].forEach((b) => {
        const o = odds[b.dataset.id];
        b.querySelector('.co').textContent = o ? `x${o.toFixed(2)}` : '—';
        b.classList.toggle('on', this.tricks.has(b.dataset.id) && !!o);
        b.disabled = lock || !o;
      });
      const hillN = Math.min(this.crash.levels, (this.round ? this.round.level : 0) + 1);
      $('trSub').textContent = t('tricks.sub', { n: hillN });
    }

    renderCan() {
      const b = $('btnCan');
      const h = this.crash.helmet;
      b.hidden = !h;
      if (!h) return;
      const price = this.round && this.next ? this.next.helmet_price : null;
      const keep = Math.round(h.keep * 100);
      const used = this.round ? this.round.saves || 0 : 0;
      b.disabled = this.busy || !price || !this.parked;
      b.classList.toggle('on', !!(this.canSel && price));
      b.title = t('can.tip', { keep });
      $('canInfo').textContent = price
        ? (this.canSel ? t('can.on', { price: this.money.fmt(price), keep }) : t('can.offer', { price: this.money.fmt(price), keep }))
        : h.max_saves && used >= h.max_saves ? t('can.used') : t('can.from', { n: h.from_level });
    }

    pop(main, sub, cls) {
      const el = $('pop');
      el.className = `pop ${cls || ''}`;
      el.innerHTML = `<span class="p-main">${main}</span>${sub ? `<span class="p-sub">${sub}</span>` : ''}`;
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(this.popT);
      this.popT = setTimeout(() => { el.hidden = true; }, 1650);
    }

    toast(msg, err = false, win = false) {
      const el = $('toast');
      el.textContent = msg;
      el.className = `toast${err ? ' err' : ''}${win ? ' win' : ''}`;
      el.hidden = false;
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => { el.hidden = true; }, 2300);
    }

    errText(e) {
      if (e && e.code && I18N.has(`err.${e.code}`)) return t(`err.${e.code}`);
      if (e instanceof TypeError) return t('err.NETWORK');
      return (e && e.message) || t('toast.error');
    }

    error(e) { console.warn(e); this.toast(this.errText(e), true); }

    relocalize() {
      I18N.apply();
      document.title = t('title');
      this.money = new Money(this.money.cur);
      $('garage').innerHTML = '';
      $('trChips').innerHTML = '';
      this.routeSig = '';
      this.render();
      this.openRules();
      if (!$('modalFair').hidden) this.renderHistory();
    }

    // -------------------------------------------------------------- sheets
    openRules(focus) {
      const c = this.crash;
      const pct = (v) => `${(v * 100).toFixed(2)}%`;
      const ladders = Object.entries(c.modes).map(([id, m]) => `<tr><td>${t(`vehicle.${id}`)} <span class="muted">· ${t(`vehicle.${id}_vol`)}</span></td>${m.ladder.map((x, i) => `<td class="n" title="${(m.survival[i] * 100).toFixed(0)}%">x${x}</td>`).join('')}</tr>`).join('');
      const chances = Object.entries(c.modes).map(([id, m]) => `<tr><td>${t(`vehicle.${id}`)}</td>${m.survival.map((p) => `<td>${(p * 100).toFixed(0)}%</td>`).join('')}</tr>`).join('');
      const range = (id) => {
        const vals = [];
        for (const m of Object.values(c.modes)) for (const ch of m.survival) {
          const probs = { lethal: 1 - ch };
          for (const [k, s] of Object.entries(c.outcomes)) probs[k] = ch * s;
          for (const [k, s] of Object.entries(c.crashes)) probs[k] = (1 - ch) * s;
          const q = c.side_bets[id].wins_on.reduce((a, o) => a + probs[o], 0);
          vals.push(floor2(c.side_bets[id].rtp / q));
        }
        return `x${Math.min(...vals).toFixed(2)} – x${Math.max(...vals).toFixed(2)}`;
      };
      const tricks = TRICKS.map((id) => `<tr><td><b>${t(`trick.name.${id}`)}</b></td><td style="white-space:normal">${t(`trick.tip.${id}`)}</td><td class="n">${range(id)}</td></tr>`).join('');
      const h = c.helmet;
      const can = h
        ? `<p>${t('rules.can_text', { n: h.from_level, keep: Math.round(h.keep * 100), rtp: pct(h.rtp) })}${h.max_saves ? ` ${t('rules.can_limit', { n: h.max_saves })}` : ''}</p>`
        : `<p>${t('rules.can_off')}</p>`;
      $('rulesBody').innerHTML = `
        <p>${t('rules.intro', { levels: c.levels })}</p>
        <h3>${t('rules.controls')}</h3>
        <p>${t('rules.controls_text')}</p>
        <h3>${t('rules.ladder')}</h3>
        <div class="tbl-wrap"><table class="tbl"><tr><th>${t('ctl.vehicle')}</th>${c.distances.map((d, i) => `<th>${i + 1} · ${d} m</th>`).join('')}</tr>${ladders}</table></div>
        <p class="muted">${t('rules.step')}</p>
        <div class="tbl-wrap"><table class="tbl"><tr><th>${t('rules.chance')}</th>${c.distances.map((d, i) => `<th>${i + 1}</th>`).join('')}</tr>${chances}</table></div>
        <h3>${t('rules.crashes')}</h3>
        <p>${t('rules.crashes_text', { flip: Math.round(c.crashes.flip * 100), fuel: Math.round(c.crashes.fuel * 100) })}</p>
        <h3 id="rulesTricks">${t('rules.tricks')}</h3>
        <p>${t('rules.tricks_text', { rtp: pct(c.side_bets.backflip.rtp) })}</p>
        <div class="tbl-wrap"><table class="tbl"><tr><th>${t('rules.trick')}</th><th>${t('rules.wins_when')}</th><th>${t('rules.odds')}</th></tr>${tricks}</table></div>
        <h3>${t('rules.can')}</h3>
        ${can}
        <h3>${t('rules.rtp')}</h3>
        <p>${t('rules.rtp_text', { rtp: pct(c.rtp), max: this.cfg.max_win_x.toLocaleString(I18N.locale) })}</p>
        <p>${t('rules.bets', { min: this.money.fmt(this.steps[0]), max: this.money.fmt(this.steps[this.steps.length - 1]) })}</p>
        <p>${t('rules.physics')}</p>
        <p class="muted">${t('rules.malfunction')}</p>`;
      $('modalRules').hidden = false;
      if (focus === 'tricks') setTimeout(() => $('rulesTricks').scrollIntoView({ block: 'start' }), 30);
    }

    openFair() {
      $('pfHash').textContent = this.pf.server_seed_hash;
      $('pfClient').value = this.pf.client_seed;
      $('pfClient').disabled = !!this.round;
      $('pfRotate').disabled = !!this.round;
      $('pfNonce').textContent = this.pf.nonce;
      if (!$('vClient').value) $('vClient').value = this.pf.client_seed;
      this.renderHistory();
      $('modalFair').hidden = false;
    }

    async rotateSeed() {
      try {
        const d = await api('action', { action: 'seed', client_seed: $('pfClient').value.trim() || undefined });
        const rv = d.revealed;
        this.revealed = this.revealed || {};
        this.revealed[rv.server_seed_hash] = rv.server_seed;
        this.apply(d);
        if (!this.round) { this.scene.resetTrack(this.pf.nonce, 0); this.routeSig = ''; this.render(); }
        $('pfRevealed').hidden = false;
        $('pfRevealed').innerHTML = `${t('fair.revealed', { hash: rv.server_seed_hash.slice(0, 16), rounds: rv.rounds_played })}<br><code>${rv.server_seed}</code>`;
        $('vServer').value = rv.server_seed;
        $('vClient').value = rv.client_seed;
        SFX.coin();
        this.openFair();
      } catch (e) { this.error(e); }
    }

    renderHistory() {
      const el = $('pfHistory');
      if (!this.history.length) { el.innerHTML = `<p class="muted">${t('fair.no_rounds')}</p>`; return; }
      el.innerHTML = '';
      this.history.slice(0, 30).forEach((h) => {
        const row = document.createElement('div');
        row.className = 'hrow';
        const seed = this.revealed && this.revealed[h.server_seed_hash];
        const s = h.settled || {};
        const won = s.win > 0;
        row.innerHTML = `<span>#${h.nonce}</span><span class="dots">${h.shots.map((x) => `<i class="dot ${x.saved ? 'saved' : x.outcome === 'lethal' ? 'lethal' : ''}" title="${x.level}: ${x.outcome}${x.crash ? ` (${x.crash})` : ''}"></i>`).join('')}</span>
          <span class="res ${won ? 'win' : 'lose'}">${won ? `+${this.money.fmt(s.win)} x${s.multiplier.toFixed(2)}` : t('fair.lost')}</span>`;
        const b = document.createElement('button');
        b.textContent = seed ? t('fair.btn_verify') : t('fair.btn_rotate');
        b.disabled = !seed;
        b.onclick = () => this.verifyRound(h, seed);
        row.appendChild(b);
        el.appendChild(row);
      });
    }

    async verifyRound(h, seed) {
      const lines = [];
      const sh = await sha256(seed);
      lines.push(`sha256(server_seed) = ${sh}  ${sh === h.server_seed_hash ? t('fair.matches') : t('fair.mismatch')}`);
      for (const s of h.shots) {
        const v = await fairShot(seed, h.client_seed, h.nonce, s.i);
        const o = outcomeOf(this.crash, s.chance, v.u);
        const k = crashOf(this.crash, s.chance, v.u);
        const shown = k ? `${o} (${k})` : o;
        const ok = o === s.outcome && (k || null) === (s.crash || null);
        lines.push(`#${s.i} · ${t('fair.hill_short')} ${s.level}: u=${v.u.toFixed(6)} · chance ${(s.chance * 100).toFixed(2)}% → ${shown} ${ok ? '✓' : '✗'}`);
      }
      $('vServer').value = seed; $('vClient').value = h.client_seed; $('vNonce').value = h.nonce; $('vShot').value = 0;
      $('vOut').textContent = lines.join('\n');
    }

    async verifyForm() {
      const server = $('vServer').value.trim();
      if (!server) return ($('vOut').textContent = t('fair.enter_seed'));
      const v = await fairShot(server, $('vClient').value.trim(), Number($('vNonce').value), Number($('vShot').value));
      $('vOut').textContent = `sha256(server_seed) = ${await sha256(server)}\nhmac = ${v.hex}\nu (bytes 0-3) = ${v.u.toFixed(8)}\n` +
        Object.entries(this.crash.modes).map(([id, m]) => `${t(`vehicle.${id}`)}: ${m.survival.map((p, i) => { const o = outcomeOf(this.crash, p, v.u); const k = crashOf(this.crash, p, v.u); return `${i + 1} ${k || o}`; }).join(' · ')}`).join('\n');
    }

    openPaint() {
      const grid = $('paintGrid');
      grid.innerHTML = '';
      const P = window.HillScene.PAINTS;
      for (const s of this.crash.skins) {
        const ok = this.unlocked.includes(s.id);
        const d = document.createElement('button');
        d.className = `paint${s.id === this.skin ? ' on' : ''}${ok ? '' : ' locked'}`;
        const cv = document.createElement('canvas');
        cv.width = 240; cv.height = 144;
        drawPaint(cv, P[s.id]);
        d.appendChild(cv);
        d.insertAdjacentHTML('beforeend', `<b>${I18N.has(`paint.${s.id}`) ? t(`paint.${s.id}`) : s.name}</b><small>${ok ? (s.id === this.skin ? t('paint.on') : t('paint.equip')) : t('paint.progress', { n: Math.min(this.stats.shots, s.shots), total: s.shots })}</small>`);
        d.disabled = !ok;
        d.onclick = async () => {
          try { const r = await api('action', { action: 'skin', skin: s.id }); this.apply(r); SFX.click(); this.openPaint(); } catch (e) { this.error(e); }
        };
        grid.appendChild(d);
      }
      $('modalPaint').hidden = false;
    }
  }

  function drawPaint(cv, c) {
    const x = cv.getContext('2d');
    x.fillStyle = '#2c3038'; x.fillRect(0, 0, cv.width, cv.height);
    x.fillStyle = '#56c23a'; x.fillRect(0, 112, cv.width, 32);
    x.save(); x.translate(120, 92);
    x.fillStyle = c.main; x.strokeStyle = '#141414'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(-80, 10); x.lineTo(84, 10); x.lineTo(86, -14); x.lineTo(40, -22); x.lineTo(24, -46); x.lineTo(-6, -46); x.lineTo(-14, -22); x.lineTo(-80, -22); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = c.dark; x.fillRect(-80, 2, 164, 8);
    x.fillStyle = c.trim; x.fillRect(-72, -14, 50, 5);
    x.fillStyle = 'rgba(170,220,255,0.85)'; x.beginPath(); x.moveTo(2, -24); x.lineTo(34, -24); x.lineTo(22, -42); x.lineTo(2, -42); x.closePath(); x.fill();
    for (const wx of [-52, 56]) { x.fillStyle = '#1d1d1f'; x.beginPath(); x.arc(wx, 14, 20, 0, Math.PI * 2); x.fill(); x.fillStyle = '#c9ced4'; x.beginPath(); x.arc(wx, 14, 9, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }

  function fmtMult(x) { return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2); }

  // ---------------------------------------------------------------- fairness (WebCrypto)
  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
  async function fairShot(server, client, nonce, shot) {
    const key = await crypto.subtle.importKey('raw', enc.encode(server), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${client}:${nonce}:${shot}`));
    return { hex: hex(sig), u: new DataView(sig).getUint32(0) / 4294967296 };
  }
  function outcomeOf(c, chance, u) {
    if (u >= chance) return 'lethal';
    const x = u / chance;
    let acc = 0;
    const e = Object.entries(c.outcomes);
    for (const [id, share] of e) { acc += share; if (x < acc) return id; }
    return e[e.length - 1][0];
  }
  function crashOf(c, chance, u) {
    if (!c.crashes || u < chance) return null;
    const x = (u - chance) / (1 - chance);
    let acc = 0;
    const e = Object.entries(c.crashes);
    for (const [id, share] of e) { acc += share; if (x < acc) return id; }
    return e[e.length - 1][0];
  }

  window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); window.game.boot(); });
})();
