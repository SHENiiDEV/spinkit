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
  const I18N = window.I18N;
  const t = (k, v) => I18N.t(k, v);
  const outcomeText = (id) => [t(`outcome.${id}`), id === 'lethal' ? 'bad' : 'good'];

  /** Sets text and shrinks the font until it fits its box (long amounts and currency suffixes in some languages). */
  function fitText(el, text, min = 7) {
    if (el.textContent !== text) el.textContent = text;
    el.style.fontSize = '';
    if (!el.clientWidth) return;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth && size > min) { size -= 1; el.style.fontSize = `${size}px`; }
  }

  // ---------------------------------------------------------------- money
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
      await I18N.init('apple_shooter', null);
      I18N.apply();
      this.loader(20, t('load.connecting'));
      if (!TOKEN) return this.fatal(t('load.no_token'));
      let d;
      try { d = await api('init', {}); } catch (e) { return this.fatal(this.errText(e)); }
      if (!d.game_config || !d.game_config.crash) return this.fatal(t('load.old_server'));
      // the operator's language for this session (an explicit ?lang= or the player's own choice still wins)
      const want = I18N.pick(d.session && d.session.lang);
      if (want !== I18N.lang) { await I18N.load(want); I18N.apply(); }
      document.title = t('title');
      this.loader(60, t('load.drawing'));
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
        this.toast(t('toast.restored'));
      } else {
        this.scene.newRound(this.crash.distances[0]);
        this.scene.setWind(0, 'calm');
      }
      this.bindUi();
      this.layout();
      if (document.fonts) document.fonts.ready.then(() => this.render()); // amounts are fitted to their boxes in the final font
      window.addEventListener('resize', () => { this.layout(); this.render(); });
      try { await document.fonts.load('8px "Press Start 2P"'); } catch { /* fonts optional */ }
      this.loader(100, t('load.ready'));
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
      I18N.select($('langSel'), () => this.relocalize());
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
        if (d.round.boost > 1) this.pop(t('pop.revenge'), t('pop.ladder', { x: d.round.boost.toFixed(2) }), 'good');
        (d.jackpot_wins || []).forEach((j) => this.toast(t('toast.jackpot', { name: j.name, amount: this.money.fmt(j.amount) })));
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
      if (cost > this.balance) { this.scene.aim.pull = 0; return this.toast(t('helmet.no_credit'), true); }
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
        this.pop(t('outcome.saved'), t('pop.kept', { keep: Math.round(this.crash.helmet.keep * 100), x: this.round.multiplier.toFixed(2) }), 'good');
        this.helmetSel = false;
        this.scene.setHelmet(false);
        this.scene.nocked = true;
      } else if (shot.outcome === 'lethal') {
        this.deadAt = shot.level;
        this.pop(t('outcome.lethal'), t('pop.lost'), 'bad');
        this.history.unshift(this.historyRow(d));
      } else {
        this.reached[shot.level] = shot.multiplier;
        const [txt, cls] = outcomeText(shot.outcome);
        if (d.settled) {
          this.pop(d.settled.end === 'top' ? t('pop.champion') : t('pop.max_win'), `${this.money.fmt(d.settled.win)} · x${d.settled.multiplier.toFixed(2)}`, 'good');
          SFX.cashout();
          this.scene.coins(200, 60, 40);
          this.history.unshift(this.historyRow(d));
        } else {
          this.pop(txt, `x${shot.multiplier.toFixed(2)}`, cls);
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
        this.pop(t('pop.cashed'), `${this.money.fmt(s.win)} · x${s.multiplier.toFixed(2)}`, 'good');
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
        if (!res.ok) { const e = new Error(d.message || t('toast.refill_failed')); e.code = d.error; throw e; }
        this.balance = d.balance;
        this.toast(t('toast.free', { amount: this.money.fmt(d.added) }));
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
      fitText($('valBalance'), fmt(this.balance));
      fitText($('valBet'), fmt(this.bet));
      $('betDown').disabled = !!r || this.busy || this.betIndex === 0;
      $('betUp').disabled = !!r || this.busy || this.betIndex === this.steps.length - 1;

      // risk segment
      const seg = $('modeSeg');
      if (!seg.children.length) {
        for (const [id, m] of Object.entries(this.crash.modes)) {
          const b = document.createElement('button');
          b.textContent = I18N.has(`mode.${id}`) ? t(`mode.${id}`) : m.label.toUpperCase();
          b.dataset.mode = id;
          b.className = id;
          b.onclick = () => this.setMode(id);
          seg.appendChild(b);
        }
      }
      [...seg.children].forEach((b) => { b.classList.toggle('on', b.dataset.mode === this.mode); b.disabled = !!r || this.busy; fitText(b, b.textContent, 6); });

      // main + cash buttons
      const main = $('btnMain');
      main.classList.toggle('shoot', !!r);
      main.disabled = this.busy || (!r && this.bet > this.balance);
      if (r) {
        $('btnMainTop').textContent = t('btn.shoot');
        const cost = this.shotCost();
        $('btnMainSub').textContent = cost ? t('btn.wagers', { cost: fmt(cost) }) : t('btn.or_drag');
      } else {
        $('btnMainTop').textContent = t('btn.start');
        $('btnMainSub').textContent = t('btn.bet', { bet: fmt(this.bet) });
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
        $('nsDist').textContent = `${q.distance_m} ${t('unit.m')}`;
        const arrow = q.wind > 0.05 ? '→' : q.wind < -0.05 ? '←' : '·';
        $('nsWind').innerHTML = `${arrow}${Math.abs(q.wind).toFixed(1)}<span class="tier ${q.wind_tier}">${I18N.has(`wind.${q.wind_tier}`) ? t(`wind.${q.wind_tier}`) : q.wind_label.toUpperCase()}${q.wind_bonus ? ` +${Math.round(q.wind_bonus * 100)}%` : ''}</span>`;
        $('nsChance').textContent = `${(q.chance * 100).toFixed(1)}%`;
        $('nsNext').textContent = `x${q.multiplier.toFixed(2)} · ${fmt(q.payout)}`;
      } else {
        $('nsLevel').textContent = `0/${this.crash.levels}`;
        $('nsDist').textContent = `${this.crash.distances[0]} ${t('unit.m')}`;
        $('nsWind').innerHTML = `<span class="tier calm">${t('hud.on_start')}</span>`;
        const lad = this.crash.modes[this.mode].ladder;
        $('nsChance').textContent = t('hud.calm_chance', { pct: (this.crash.modes[this.mode].survival[0] * 100).toFixed(0) });
        $('nsNext').textContent = t('hud.up_to', { x: lad[lad.length - 1] });
      }

      this.renderHelmet();
      this.renderLadder();
      this.renderRevenge();
    }

    renderHelmet() {
      const b = $('btnHelmet');
      const h = this.crash.helmet;
      // the operator can switch the helmet off (helmet_max_saves = 0)
      b.hidden = !h;
      document.querySelector('.controls').classList.toggle('no-helmet', !h);
      if (!h) return;
      const q = this.round ? this.next : null;
      const price = q && q.helmet_price;
      const keep = Math.round(h.keep * 100);
      const used = this.round ? this.round.saves || 0 : 0;
      b.disabled = this.busy || !price;
      b.classList.toggle('on', !!(this.helmetSel && price));
      b.title = t('helmet.tip', { keep });
      const limit = h.max_saves ? ` · ${t('helmet.left', { n: Math.max(0, h.max_saves - used) })}` : '';
      $('helmetInfo').textContent = price
        ? (this.helmetSel ? t('helmet.on', { price: this.money.fmt(price), keep }) : t('helmet.offer', { price: this.money.fmt(price), keep })) + (h.max_saves > 1 ? limit : '')
        : h.max_saves && used >= h.max_saves ? t('helmet.used')
          : this.round ? t('helmet.from_level', { level: h.from_level }) : t('helmet.lobby', { level: h.from_level }) + (h.max_saves ? limit : '');
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
      $('revengeText').textContent = t('revenge.text', { boost: this.revenge.boost.toFixed(2), bet: this.money.fmt(this.revenge.bet_max), sec: left });
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

    errText(e) {
      if (e && e.code && I18N.has(`err.${e.code}`)) return t(`err.${e.code}`);
      if (e instanceof TypeError) return t('err.NETWORK');
      return (e && e.message) || t('toast.error');
    }

    error(e) {
      console.warn(e);
      this.toast(this.errText(e), true);
    }

    /** Language switched in the rules sheet: redraw every text. */
    relocalize() {
      I18N.apply();
      document.title = t('title');
      this.money = new Money(this.money.cur);
      $('modeSeg').innerHTML = '';
      this.render();
      this.openRules();
      if (!$('modalFair').hidden) this.renderHistory();
    }

    // -------------------------------------------------------------- sheets
    openRules() {
      const c = this.crash;
      const pct = (v) => `${(v * 100).toFixed(2)}%`;
      const modeName = (id, m) => (I18N.has(`mode.${id}`) ? t(`mode.${id}`) : m.label);
      const ladders = Object.entries(c.modes).map(([id, m]) => `<tr><td>${modeName(id, m)}</td>${m.ladder.map((x, i) => `<td class="n" title="${t('rules.calm_tip', { pct: (m.survival[i] * 100).toFixed(0) })}">x${x}</td>`).join('')}</tr>`).join('');
      const winds = c.wind.map((w, i) => `<tr><td>${I18N.has(`wind.${w.id}`) ? t(`wind.${w.id}`) : w.label}</td><td>${i ? `${c.wind[i - 1].max.toFixed(1)}–${w.max ? w.max.toFixed(1) : '10'}` : `0–${w.max.toFixed(1)}`} m/s</td><td class="n">+${Math.round(w.bonus * 100)}%</td><td>${t('rules.chance_div', { x: (1 + w.bonus).toFixed(2) })}</td></tr>`).join('');
      const h = c.helmet;
      const helmet = h
        ? `<p>${t('rules.helmet_text', { level: h.from_level, keep: Math.round(h.keep * 100), rtp: pct(h.rtp) })}${h.max_saves ? ` ${t('rules.helmet_limit', { n: h.max_saves })}` : ''}</p>`
        : `<p>${t('rules.helmet_off')}</p>`;
      $('rulesBody').innerHTML = `
        <p>${t('rules.intro', { levels: c.levels })}</p>
        <h3>${t('rules.ladder')}</h3>
        <div class="tbl-wrap"><table class="tbl"><tr><th>${t('rules.risk')}</th>${c.distances.map((d, i) => `<th>${i + 1} · ${d}m</th>`).join('')}</tr>${ladders}</table></div>
        <p class="muted">${t('rules.step')}</p>
        <h3>${t('rules.wind')}</h3>
        <p>${t('rules.wind_text')}</p>
        <table class="tbl"><tr><th>${t('rules.weather')}</th><th>${t('rules.speed')}</th><th>${t('rules.step_col')}</th><th></th></tr>${winds}</table>
        <h3>${t('rules.helmet')}</h3>
        ${helmet}
        <h3>${t('rules.revenge')}</h3>
        <p>${t('rules.revenge_text', { level: c.revenge.min_level, sec: c.revenge.window_sec, boost: c.revenge.boost.toFixed(4) })}</p>
        <h3>${t('rules.rtp')}</h3>
        <p>${t('rules.rtp_text', { rtp: pct(c.rtp), max: this.cfg.max_win_x.toLocaleString(I18N.locale) })}</p>
        <p>${t('rules.bets', { min: this.money.fmt(this.steps[0]), max: this.money.fmt(this.steps[this.steps.length - 1]) })}</p>
        <p>${t('rules.cosmetic')}</p>
        <p class="muted">${t('rules.malfunction')}</p>`;
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
        row.innerHTML = `<span>#${h.nonce}</span><span class="dots">${h.shots.map((x) => `<i class="dot ${x.saved ? 'saved' : x.outcome}" title="L${x.level} ${x.outcome}"></i>`).join('')}</span>
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
      lines.push(`sha256(server_seed) = ${await sha256(seed)}  ${(await sha256(seed)) === h.server_seed_hash ? t('fair.matches') : t('fair.mismatch')}`);
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
      if (!server) return ($('vOut').textContent = t('fair.enter_seed'));
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
        d.insertAdjacentHTML('beforeend', `<b>${I18N.has(`skin.${s.id}`) ? t(`skin.${s.id}`) : s.name}</b><span class="lock-l">${ok ? (s.id === this.skin ? t('skins.equipped') : t('skins.equip')) : t('skins.progress', { n: Math.min(this.stats.shots, s.shots), total: s.shots })}</span>`);
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
