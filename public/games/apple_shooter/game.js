/*
 * Apple Shooter — game client (SpinKit Exclusive, step crash).
 * Talks to POST /api/v1/rgs/init and POST /api/v1/rgs/action; the canvas scene only animates
 * what the server decided.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const TOKEN = params.get('token');
  const SFX = window.SFX;
  const OUTCOME_TEXT = {
    bullseye: ['BULLSEYE!', 'good'],
    hit: ['HIT!', 'good'],
    hat_trick: ['HAT TRICK!', 'good'],
    near_miss: ['NEAR-MISS!', 'good'],
    lethal: ['OUCH!', 'bad'],
    saved: ['CLANG! SAVED', 'good']
  };

  // ---------------------------------------------------------------- money
  class Money {
    constructor(cur) {
      this.cur = cur || { code: 'USD', symbol: '$', decimals: 2 };
      const d = this.cur.decimals;
      try {
        this.nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: this.cur.code, minimumFractionDigits: d, maximumFractionDigits: d });
        this.nf.format(1);
      } catch {
        const plain = new Intl.NumberFormat(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
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

  // ---------------------------------------------------------------- game
  class Game {
    constructor() {
      this.busy = false;
      this.helmetSel = false;
      this.history = [];
      this.reached = {};
      this.deadAt = null;
    }

    async boot() {
      this.loader(20, 'CONNECTING…');
      if (!TOKEN) return this.fatal('No session token. Launch the game from the lobby.');
      let d;
      try { d = await api('init', {}); } catch (e) { return this.fatal(e.message); }
      if (!d.game_config || !d.game_config.crash) return this.fatal('This server does not run Apple Shooter yet — restart it.');
      this.loader(60, 'DRAWING PIXELS…');
      this.cfg = d.game_config;
      this.crash = this.cfg.crash;
      this.money = new Money(d.currency || this.cfg.currency);
      this.session = d.session || {};
      this.balance = d.user.balance;
      this.steps = this.cfg.bet_steps;
      this.betIndex = Math.max(0, this.steps.indexOf(this.cfg.default_bet));
      this.mode = this.crash.default_mode;
      this.scene = new window.AppleScene.Scene($('scene'));
      this.scene.onRelease = (aim) => this.shoot(aim);
      this.apply(d);
      if (d.round) {
        this.mode = d.round.mode;
        this.betIndex = Math.max(0, this.steps.indexOf(d.round.bet));
        this.restoreReached(d.round);
        this.scene.newRound(d.next.distance_m);
        this.scene.setWind(d.next.wind, d.next.wind_tier);
        this.toast('Unfinished round restored');
      } else {
        this.scene.newRound(this.crash.distances[0]);
        this.scene.setWind(0, 'calm');
      }
      this.bindUi();
      this.layout();
      window.addEventListener('resize', () => this.layout());
      try { await document.fonts.load('8px "Press Start 2P"'); } catch { /* fonts optional */ }
      this.loader(100, 'READY');
      this.render();
      setTimeout(() => { $('app').classList.remove('loading'); this.layout(); }, 250);
      setInterval(() => this.renderRevenge(), 1000);
    }

    loader(p, t) { $('loaderFill').style.width = `${p}%`; $('loaderText').textContent = t; }
    fatal(msg) { this.loader(100, msg); $('loaderText').style.color = '#ff5a5a'; }

    /** Applies a server snapshot (init or action response). */
    apply(d) {
      if (d.balance != null) this.balance = d.balance;
      if (d.user) this.balance = d.user.balance;
      this.round = d.round || null;
      this.next = d.next || null;
      this.pf = d.provably_fair || this.pf;
      this.stats = d.stats || this.stats;
      this.skin = d.skin || this.skin || 'classic';
      this.unlocked = d.skins_unlocked || this.unlocked || ['classic'];
      this.revenge = d.revenge || null;
      this.revengeAt = this.revenge ? Date.now() + this.revenge.seconds_left * 1000 : 0;
      if (this.scene) this.scene.setSkin(this.skin);
    }

    restoreReached(round) {
      this.reached = {};
      for (const s of round.shots) if (s.multiplier) this.reached[s.level] = s.multiplier;
    }

    // -------------------------------------------------------------- layout
    layout() {
      const wrap = document.querySelector('.arcade');
      const ladder = $('ladder');
      const stage = $('stage');
      const board = $('nextStrip');
      const vertical = getComputedStyle(wrap).flexDirection === 'column';
      const r = wrap.getBoundingClientRect();
      const lw = vertical ? 0 : ladder.getBoundingClientRect().width + 16;
      const bh = board.getBoundingClientRect().height + 12;
      const lh = vertical ? ladder.getBoundingClientRect().height + 10 : 0;
      const aw = r.width - lw - 16;
      const ah = r.height - bh - lh - 12;
      let w = vertical && innerWidth <= 640 ? aw : Math.min(aw, ah * 16 / 9);
      w = Math.max(240, Math.floor(w));
      stage.style.width = `${w}px`;
      stage.style.height = `${Math.round(w * 9 / 16)}px`;
      board.style.width = vertical && innerWidth <= 640 ? '' : `${w}px`;
      if (!vertical) ladder.style.height = `${Math.round(w * 9 / 16) + bh}px`;
    }

    // -------------------------------------------------------------- ui bindings
    bindUi() {
      const unlock = () => SFX.unlock();
      document.addEventListener('pointerdown', unlock, { once: true });
      $('btnMain').onclick = () => (this.round ? this.shootButton() : this.start());
      $('btnCash').onclick = () => this.cashout();
      $('betDown').onclick = () => this.setBet(this.betIndex - 1);
      $('betUp').onclick = () => this.setBet(this.betIndex + 1);
      $('btnRefill').onclick = () => this.refill();
      $('btnRefill').hidden = this.session.refill_enabled === false;
      $('btnSound').onclick = () => { const m = SFX.toggle(); $('btnSound').classList.toggle('off', m); };
      $('btnSound').classList.toggle('off', SFX.muted);
      $('btnRules').onclick = () => this.openRules();
      $('btnFair').onclick = () => this.openFair();
      $('btnSkins').onclick = () => this.openSkins();
      $('btnLobby').onclick = () => {
        const url = this.session.lobby_url;
        if (url) { try { window.top.location.href = url; } catch { location.href = url; } } else if (window.parent !== window) window.parent.postMessage({ type: 'spinkit:close' }, '*');
        else location.href = '/';
      };
      $('btnHelmet').onclick = () => { this.helmetSel = !this.helmetSel; SFX.click(); this.scene.setHelmet(this.helmetSel && this.next && this.next.helmet_price); this.render(); };
      document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => b.closest('.modal').hidden = true; });
      document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; }));
      $('pfRotate').onclick = () => this.rotateSeed();
      $('vGo').onclick = () => this.verifyForm();
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || ![...document.querySelectorAll('.modal')].every((m) => m.hidden)) return;
        if (e.code === 'Space') { e.preventDefault(); $('btnMain').click(); }
        if (e.code === 'Enter' && !$('btnCash').disabled) { e.preventDefault(); this.cashout(); }
      });
    }

    get bet() { return this.round ? this.round.bet : this.steps[this.betIndex]; }

    setBet(i) {
      if (this.round || this.busy) return;
      this.betIndex = Math.max(0, Math.min(this.steps.length - 1, i));
      SFX.click();
      this.render();
    }

    setMode(m) {
      if (this.round || this.busy) return;
      this.mode = m;
      SFX.click();
      this.render();
    }

    // -------------------------------------------------------------- actions
    async start() {
      if (this.busy || this.round) return;
      this.busy = true;
      this.render();
      try {
        const d = await api('action', { action: 'start', bet: this.bet, mode: this.mode });
        this.apply(d);
        SFX.start();
        this.reached = {};
        this.deadAt = null;
        this.scene.newRound(this.next.distance_m);
        this.scene.setWind(this.next.wind, this.next.wind_tier);
        this.scene.setHelmet(false);
        if (d.round.boost > 1) this.pop('REVENGE!', `LADDER x${d.round.boost.toFixed(2)}`, 'good');
        (d.jackpot_wins || []).forEach((j) => this.toast(`JACKPOT ${j.name}: ${this.money.fmt(j.amount)}!`));
      } catch (e) {
        this.error(e);
      }
      this.busy = false;
      this.render();
    }

    async shootButton() {
      if (this.busy || !this.round || !this.scene.nocked) return;
      this.busy = true;
      this.render();
      const aim = await this.scene.autoAim();
      this.busy = false;
      await this.shoot(aim);
    }

    shotCost() {
      return this.helmetSel && this.next && this.next.helmet_price ? this.next.helmet_price : 0;
    }

    async shoot(aim) {
      if (this.busy || !this.round || !this.next) return;
      const cost = this.shotCost();
      if (cost > this.balance) { this.scene.aim.pull = 0; return this.toast('Not enough credit for the helmet', true); }
      this.busy = true;
      this.render();
      const q = this.next;
      const helmet = !!(this.helmetSel && q.helmet_price);
      this.scene.setHelmet(helmet);
      const { n } = this.scene.release();
      let d;
      try {
        d = await api('action', { action: 'shoot', helmet, expect_shot: q.shot_index, aim: { angle: aim.angle, power: aim.power } });
      } catch (e) {
        this.scene.nocked = true;
        this.busy = false;
        this.error(e);
        if (e.code === 'STALE_SHOT' || e.code === 'NO_ROUND') this.resync();
        return this.render();
      }
      // show the cost of the wagers right away, wins after the animation
      this.balance -= d.shot.cost;
      this.render();
      const shot = d.shot;
      await this.scene.shoot({ outcome: shot.outcome, saved: shot.saved, from: n, power: aim.power });
      this.apply(d);
      if (shot.saved) {
        this.pop(OUTCOME_TEXT.saved[0], `MULTIPLIER HALVED · x${this.round.multiplier.toFixed(2)}`, 'good');
        this.helmetSel = false;
        this.scene.setHelmet(false);
        this.scene.nocked = true;
      } else if (shot.outcome === 'lethal') {
        this.deadAt = shot.level;
        this.pop(OUTCOME_TEXT.lethal[0], 'ROUND LOST', 'bad');
        this.history.unshift(this.historyRow(d));
      } else {
        this.reached[shot.level] = shot.multiplier;
        const [t, cls] = OUTCOME_TEXT[shot.outcome];
        if (d.settled) {
          this.pop(d.settled.end === 'top' ? 'CHAMPION!' : 'MAX WIN!', `${this.money.fmt(d.settled.win)} · x${d.settled.multiplier.toFixed(2)}`, 'good');
          SFX.cashout();
          this.scene.coins(200, 60, 40);
          this.history.unshift(this.historyRow(d));
        } else {
          this.pop(t, `x${shot.multiplier.toFixed(2)}`, cls);
          this.helmetSel = false;
          this.scene.setHelmet(false);
          await this.scene.walkTo(this.next.distance_m);
        }
      }
      if (this.next) this.scene.setWind(this.next.wind, this.next.wind_tier);
      this.busy = false;
      this.render();
    }

    async cashout() {
      if (this.busy || !this.round || this.round.level < 1) return;
      this.busy = true;
      this.render();
      try {
        const d = await api('action', { action: 'cashout' });
        const s = d.settled;
        this.history.unshift(this.historyRow(d));
        this.apply(d);
        SFX.cashout();
        this.scene.coins(this.scene.partner.x, 120, 26);
        this.pop('CASHED OUT', `${this.money.fmt(s.win)} · x${s.multiplier.toFixed(2)}`, 'good');
      } catch (e) {
        this.error(e);
      }
      this.busy = false;
      this.render();
    }

    async resync() {
      try { const d = await api('init', {}); this.apply(d); if (d.round) this.restoreReached(d.round); } catch { /* ignore */ }
      this.render();
    }

    async refill() {
      try {
        const res = await fetch('/api/v1/rgs/refill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message || 'Refill failed');
        this.balance = d.balance;
        this.toast(`+${this.money.fmt(d.added)} FREE CREDITS`);
        SFX.coin();
        this.render();
      } catch (e) { this.error(e); }
    }

    historyRow(d) {
      const s = d.settled;
      return { settled: s, nonce: s.nonce, client_seed: s.client_seed, server_seed_hash: s.server_seed_hash, shots: s.shots };
    }

    // -------------------------------------------------------------- rendering
    render() {
      const r = this.round;
      const q = this.next;
      const fmt = (v) => this.money.fmt(v);
      $('valBalance').textContent = fmt(this.balance);
      $('valBet').textContent = fmt(this.bet);
      $('betDown').disabled = !!r || this.busy || this.betIndex === 0;
      $('betUp').disabled = !!r || this.busy || this.betIndex === this.steps.length - 1;

      // risk segment
      const seg = $('modeSeg');
      if (!seg.children.length) {
        for (const [id, m] of Object.entries(this.crash.modes)) {
          const b = document.createElement('button');
          b.textContent = m.label.toUpperCase();
          b.dataset.mode = id;
          b.className = id;
          b.onclick = () => this.setMode(id);
          seg.appendChild(b);
        }
      }
      [...seg.children].forEach((b) => { b.classList.toggle('on', b.dataset.mode === this.mode); b.disabled = !!r || this.busy; });

      // main + cash buttons
      const main = $('btnMain');
      main.classList.toggle('shoot', !!r);
      main.disabled = this.busy || (!r && this.bet > this.balance);
      if (r) {
        $('btnMainTop').textContent = 'SHOOT';
        const cost = this.shotCost();
        $('btnMainSub').textContent = cost ? `WAGERS ${fmt(cost)}` : 'OR DRAG ON THE FIELD';
      } else {
        $('btnMainTop').textContent = 'START';
        $('btnMainSub').textContent = `BET ${fmt(this.bet)}`;
      }
      const cash = $('btnCash');
      const canCash = !!r && r.level >= 1 && !this.busy;
      cash.disabled = !canCash;
      cash.classList.toggle('ready', canCash);
      $('cashVal').textContent = r && r.level >= 1 ? fmt(r.cashout_value) : '—';
      this.scene.enableAim(!!r && !this.busy);
      this.scene.setMultiplier(r && r.level >= 1 ? `x${r.multiplier.toFixed(2)}` : '');
      $('hint').hidden = !(r && !this.busy && r.shots.length === 0);

      // next-shot strip
      if (r && q) {
        $('nsLevel').textContent = `${q.level}/${this.crash.levels}`;
        $('nsDist').textContent = `${q.distance_m} M`;
        const arrow = q.wind > 0.05 ? '→' : q.wind < -0.05 ? '←' : '·';
        $('nsWind').innerHTML = `${arrow}${Math.abs(q.wind).toFixed(1)}<span class="tier ${q.wind_tier}">${q.wind_label.toUpperCase()}${q.wind_bonus ? ` +${Math.round(q.wind_bonus * 100)}%` : ''}</span>`;
        $('nsChance').textContent = `${(q.chance * 100).toFixed(1)}%`;
        $('nsNext').textContent = `x${q.multiplier.toFixed(2)} · ${fmt(q.payout)}`;
      } else {
        $('nsLevel').textContent = `0/${this.crash.levels}`;
        $('nsDist').textContent = `${this.crash.distances[0]} M`;
        $('nsWind').innerHTML = '<span class="tier calm">ON START</span>';
        const lad = this.crash.modes[this.mode].ladder;
        $('nsChance').textContent = `${(this.crash.modes[this.mode].survival[0] * 100).toFixed(0)}% CALM`;
        $('nsNext').textContent = `UP TO x${lad[lad.length - 1]}+`;
      }

      this.renderHelmet();
      this.renderLadder();
      this.renderRevenge();
    }

    renderHelmet() {
      const b = $('btnHelmet');
      const q = this.round ? this.next : null;
      const price = q && q.helmet_price;
      const keep = Math.round(this.crash.helmet.keep * 100);
      b.disabled = this.busy || !price;
      b.classList.toggle('on', !!(this.helmetSel && price));
      b.title = `Steel Helmet: if the next shot is lethal, the arrow bounces off. You keep ${keep}% of your multiplier and shoot the same level again.`;
      $('helmetInfo').textContent = price
        ? (this.helmetSel ? `ON · ${this.money.fmt(price)} · saves ${keep}% if lethal` : `${this.money.fmt(price)} · keep ${keep}% if the shot is lethal`)
        : this.round ? `available from level ${this.crash.helmet.from_level}` : `one-shot insurance from level ${this.crash.helmet.from_level}`;
    }

    renderLadder() {
      const el = $('ladder');
      const n = this.crash.levels;
      if (el.children.length !== n) {
        el.innerHTML = '';
        for (let i = 1; i <= n; i++) {
          const d = document.createElement('div');
          d.className = 'rung';
          d.innerHTML = `<span class="rn">${i}</span><span class="rm"></span>`;
          el.appendChild(d);
        }
      }
      const r = this.round;
      const surv = this.crash.modes[this.mode].survival;
      const boost = !r && this.revenge && this.bet <= this.revenge.bet_max ? this.revenge.boost : 1;
      let est = r && this.next ? this.next.multiplier : null;
      [...el.children].forEach((d, i) => {
        const L = i + 1;
        const rm = d.querySelector('.rm');
        d.className = 'rung';
        if (r) {
          if (L <= r.level) { d.classList.add('done'); rm.textContent = `x${(this.reached[L] || 0).toFixed(2)}`; } else if (L === r.level + 1) { d.classList.add('next'); rm.textContent = `x${this.next.multiplier.toFixed(2)}`; } else {
            est = est / surv[L - 1];
            d.classList.add('est');
            rm.textContent = `x${fmtMult(est)}`;
          }
        } else {
          const lad = this.crash.modes[this.mode].ladder;
          rm.textContent = `x${fmtMult(lad[i] * boost)}`;
          if (this.deadAt && L === this.deadAt) d.classList.add('dead');
          else if (this.deadAt && L < this.deadAt && this.reached[L]) { d.classList.add('done'); rm.textContent = `x${this.reached[L].toFixed(2)}`; }
        }
      });
    }

    renderRevenge() {
      const el = $('revenge');
      const left = this.revenge ? Math.ceil((this.revengeAt - Date.now()) / 1000) : 0;
      if (this.round || left <= 0) { el.hidden = true; if (this.revenge && left <= 0) { this.revenge = null; this.renderLadder(); } return; }
      el.hidden = false;
      $('revengeText').textContent = `LADDER x${this.revenge.boost.toFixed(2)} · BET ≤ ${this.money.fmt(this.revenge.bet_max)} · ${left}s`;
    }


    pop(main, sub, cls) {
      const el = $('resultPop');
      el.className = `result-pop ${cls || ''}`;
      el.innerHTML = `<span class="rp-main">${main}</span>${sub ? `<span class="rp-sub">${sub}</span>` : ''}`;
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(this.popT);
      this.popT = setTimeout(() => { el.hidden = true; }, 1500);
    }

    toast(msg, err = false) {
      const el = $('toast');
      el.textContent = msg;
      el.className = `toast${err ? ' err' : ''}`;
      el.hidden = false;
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => { el.hidden = true; }, 2200);
    }

    error(e) {
      console.warn(e);
      this.toast(e.message || 'Something went wrong', true);
    }

    // -------------------------------------------------------------- sheets
    openRules() {
      const c = this.crash;
      const pct = (v) => `${(v * 100).toFixed(2)}%`;
      const ladders = Object.entries(c.modes).map(([id, m]) => `<tr><td>${m.label}</td>${m.ladder.map((x, i) => `<td class="n" title="${(m.survival[i] * 100).toFixed(0)}% calm">x${x}</td>`).join('')}</tr>`).join('');
      const winds = c.wind.map((t, i) => `<tr><td>${t.label}</td><td>${i ? `${c.wind[i - 1].max.toFixed(1)}–${t.max ? t.max.toFixed(1) : '10'}` : `0–${t.max.toFixed(1)}`} m/s</td><td class="n">+${Math.round(t.bonus * 100)}%</td><td>chance ÷ ${(1 + t.bonus).toFixed(2)}</td></tr>`).join('');
      $('rulesBody').innerHTML = `
        <p>Apple Shooter is a <b>step crash</b> game. Place a bet, then shoot arrows at the apple on your partner's head.
          Every cleared shot moves him further away and raises the multiplier. <b>Cash out</b> after any cleared shot —
          or keep shooting. A lethal shot ends the round and the bet is lost. Clear all ${c.levels} shots to win the top multiplier automatically.</p>
        <h3>LADDER (CALM WEATHER)</h3>
        <div class="tbl-wrap"><table class="tbl"><tr><th>Risk</th>${c.distances.map((d, i) => `<th>${i + 1} · ${d}m</th>`).join('')}</tr>${ladders}</table></div>
        <p class="muted">Each shot: multiplier = previous × 1 / chance. Before the shot you see its exact chance and the multiplier you will reach.</p>
        <h3>WIND</h3>
        <p>The wind of every shot is part of its fair hash and is shown before you shoot. Stronger wind makes the shot harder and raises the step by the same factor, so the return does not change.</p>
        <table class="tbl"><tr><th>Weather</th><th>Speed</th><th>Step</th><th></th></tr>${winds}</table>
        <h3>STEEL HELMET</h3>
        <p>From level ${c.helmet.from_level} you can buy a helmet for the next shot. If that shot is lethal, the arrow bounces off: you keep ${Math.round(c.helmet.keep * 100)}% of your multiplier and shoot the same level again. Price = chance of a lethal shot × the value it saves (RTP ${pct(c.helmet.rtp)}).</p>
        <h3>REVENGE</h3>
        <p>Lost on level ${c.revenge.min_level} or higher? Start a new round within ${c.revenge.window_sec} seconds with a bet no bigger than the lost one and the whole ladder is multiplied by ×${c.revenge.boost.toFixed(4)}.</p>
        <h3>RTP &amp; FAIRNESS</h3>
        <p>Theoretical RTP of the main bet: <b>${pct(c.rtp)}</b> for any cash-out strategy (multipliers are rounded to 0.01). Maximum win ${this.cfg.max_win_x.toLocaleString()}× bet.
          Every shot is decided by HMAC-SHA256 of the server seed (its hash is shown before you play), your client seed, the round nonce and the shot number — see <b>FAIR</b>.</p>
        <p><b>Aiming is cosmetic.</b> The pull and angle only change the animation; the outcome of each shot is fixed by the fair hash before you shoot.</p>
        <p class="muted">Malfunction voids all pays and plays. An unfinished round is kept and restored the next time you open the game.</p>`;
      $('modalRules').hidden = false;
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
        $('pfRevealed').hidden = false;
        $('pfRevealed').innerHTML = `Revealed server seed (hash <code>${rv.server_seed_hash.slice(0, 16)}…</code>, ${rv.rounds_played} rounds):<br><code>${rv.server_seed}</code>`;
        $('vServer').value = rv.server_seed;
        $('vClient').value = rv.client_seed;
        SFX.coin();
        this.openFair();
      } catch (e) { this.error(e); }
    }

    renderHistory() {
      const el = $('pfHistory');
      if (!this.history.length) { el.innerHTML = '<p class="muted">No rounds yet.</p>'; return; }
      el.innerHTML = '';
      this.history.slice(0, 30).forEach((h) => {
        const row = document.createElement('div');
        row.className = 'hrow';
        const seed = this.revealed && this.revealed[h.server_seed_hash];
        const s = h.settled || {};
        const won = s.win > 0;
        row.innerHTML = `<span>#${h.nonce}</span><span class="dots">${h.shots.map((x) => `<i class="dot ${x.saved ? 'saved' : x.outcome}" title="L${x.level} ${x.outcome}"></i>`).join('')}</span>
          <span class="res ${won ? 'win' : 'lose'}">${won ? `+${this.money.fmt(s.win)} x${s.multiplier.toFixed(2)}` : 'LOST'}</span>`;
        const b = document.createElement('button');
        b.textContent = seed ? 'verify' : 'rotate seed to verify';
        b.disabled = !seed;
        b.onclick = () => this.verifyRound(h, seed);
        row.appendChild(b);
        el.appendChild(row);
      });
    }

    async verifyRound(h, seed) {
      const lines = [];
      lines.push(`sha256(server_seed) = ${await sha256(seed)}  ${(await sha256(seed)) === h.server_seed_hash ? '✓ matches' : '✗ MISMATCH'}`);
      for (const s of h.shots) {
        const v = await fairShot(seed, h.client_seed, h.nonce, s.i);
        const outcome = outcomeOf(this.crash, s.chance, v.u);
        lines.push(`shot ${s.i} · L${s.level}: wind ${v.wind} m/s ${v.wind === s.wind ? '✓' : '✗'} · u=${v.u.toFixed(6)} vs chance ${s.chance.toFixed(6)} → ${outcome} ${outcome === s.outcome ? '✓' : '✗'}`);
      }
      $('vServer').value = seed; $('vClient').value = h.client_seed; $('vNonce').value = h.nonce; $('vShot').value = 0;
      $('vOut').textContent = lines.join('\n');
    }

    async verifyForm() {
      const server = $('vServer').value.trim();
      if (!server) return ($('vOut').textContent = 'Enter a revealed server seed.');
      const v = await fairShot(server, $('vClient').value.trim(), Number($('vNonce').value), Number($('vShot').value));
      const tier = this.crash.wind.find((t) => t.max == null || Math.abs(v.wind) <= t.max);
      $('vOut').textContent = `sha256(server_seed) = ${await sha256(server)}\nhmac = ${v.hex}\nu (bytes 0-3) = ${v.u.toFixed(8)}\nwind (bytes 4-5) = ${v.wind} m/s · ${tier.label} (+${Math.round(tier.bonus * 100)}%)\n` +
        Object.entries(this.crash.modes).map(([id, m]) => `${m.label}: ${m.survival.map((p, i) => `L${i + 1} ${outcomeOf(this.crash, p / (1 + tier.bonus), v.u)}`).join(' · ')}`).join('\n');
    }

    openSkins() {
      const grid = $('skinsGrid');
      grid.innerHTML = '';
      for (const s of this.crash.skins) {
        const ok = this.unlocked.includes(s.id);
        const d = document.createElement('button');
        d.className = `skin${s.id === this.skin ? ' on' : ''}${ok ? '' : ' locked'}`;
        const cv = document.createElement('canvas');
        cv.width = 96; cv.height = 96;
        d.appendChild(cv);
        d.insertAdjacentHTML('beforeend', `<b>${s.name}</b><span class="lock-l">${ok ? (s.id === this.skin ? 'EQUIPPED' : 'TAP TO EQUIP') : `${Math.min(this.stats.shots, s.shots)} / ${s.shots} SHOTS`}</span>`);
        window.AppleScene.drawSkinPreview(cv, s.id);
        d.disabled = !ok;
        d.onclick = async () => {
          try { const r = await api('action', { action: 'skin', skin: s.id }); this.apply(r); SFX.click(); this.openSkins(); } catch (e) { this.error(e); }
        };
        grid.appendChild(d);
      }
      $('modalSkins').hidden = false;
    }
  }

  function fmtMult(x) { return x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2); }

  // ---------------------------------------------------------------- fairness (WebCrypto)
  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
  async function fairShot(server, client, nonce, shot) {
    const key = await crypto.subtle.importKey('raw', enc.encode(server), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${client}:${nonce}:${shot}`));
    const v = new DataView(sig);
    const u = v.getUint32(0) / 4294967296;
    const wind = Math.round((v.getUint16(4) / 65535 * 20 - 10) * 10) / 10 + 0;
    return { hex: hex(sig), u, wind };
  }
  function outcomeOf(c, chance, u) {
    if (u >= chance) return 'lethal';
    const x = u / chance;
    let acc = 0;
    for (const [id, share] of Object.entries(c.outcomes)) { acc += share; if (x < acc) return id; }
    return 'hit';
  }

  window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); window.game.boot(); });
})();
