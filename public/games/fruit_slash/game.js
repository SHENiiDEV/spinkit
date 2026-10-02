/*
 * Fruit Slash — game client (SpinKit Exclusive, lane slash).
 * The player sets the cut first; THROW sends it to the server, which only then builds the wave from the
 * fair hash and resolves it. POST /api/v1/rgs/init and /api/v1/rgs/action.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const TOKEN = new URLSearchParams(location.search).get('token');
  const SFX = window.SFX;
  const SIDE_ORDER = ['mega_combo', 'clean_sheet', 'dragon_fruit', 'insurance'];
  const SIDE_HINT = {
    mega_combo: '3 or more fruits in your cut, no bomb',
    clean_sheet: 'Every fruit of the wave in your cut, no bomb',
    dragon_fruit: 'The golden dragon fruit lands in your cut, no bomb',
    insurance: 'A bomb lands in your cut'
  };

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
      throw e;
    }
    return data;
  };

  const fmtMult = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));

  class Game {
    constructor() {
      this.busy = false;
      this.sideSel = {};
      this.shieldSel = false;
      this.history = [];
      this.reached = {};
      this.deadAt = null;
    }

    async boot() {
      this.loader(20, 'SHARPENING BLADES…');
      if (!TOKEN) return this.fatal('No session token. Launch the game from the lobby.');
      let d;
      try { d = await api('init', {}); } catch (e) { return this.fatal(e.message); }
      if (!d.game_config || !d.game_config.crash || d.game_config.crash.kind !== 'lane_slash') return this.fatal('This server does not run Fruit Slash yet — restart it.');
      this.loader(60, 'PICKING FRUIT…');
      this.cfg = d.game_config;
      this.crash = this.cfg.crash;
      this.money = new Money(d.currency || this.cfg.currency);
      this.session = d.session || {};
      this.steps = this.cfg.bet_steps;
      this.betIndex = Math.max(0, this.steps.indexOf(this.cfg.default_bet));
      this.mode = this.crash.default_mode;
      this.sideStake = this.steps[0];
      this.scene = new window.FruitScene.Scene($('scene'));
      this.scene.onCut = (c) => { this.cut = c; if (c) SFX.click(); this.render(); };
      this.apply(d);
      if (d.round) {
        this.mode = d.round.mode;
        this.betIndex = Math.max(0, this.steps.indexOf(d.round.bet));
        for (const s of d.round.shots) if (s.multiplier) this.reached[s.level] = s.multiplier;
        this.toast('Unfinished round restored');
      }
      this.bindUi();
      this.layout();
      window.addEventListener('resize', () => this.layout());
      try { await document.fonts.load('40px Bungee'); } catch { /* optional */ }
      this.loader(100, 'READY');
      this.render();
      setTimeout(() => { $('app').classList.remove('loading'); this.layout(); }, 250);
    }

    loader(p, t) { $('loaderFill').style.width = `${p}%`; $('loaderText').textContent = t; }
    fatal(msg) { this.loader(100, msg); $('loaderText').classList.add('err'); }

    apply(d) {
      if (d.balance != null) this.balance = d.balance;
      if (d.user) this.balance = d.user.balance;
      this.round = d.round || null;
      this.next = d.next || null;
      this.pf = d.provably_fair || this.pf;
      this.stats = d.stats || this.stats;
      this.skin = d.skin && this.crash.skins.some((s) => s.id === d.skin) ? d.skin : 'steel';
      this.unlocked = d.skins_unlocked || this.unlocked || ['steel'];
      if (this.scene) this.scene.setSkin(this.skin);
    }

    layout() {
      const arena = document.querySelector('.arena');
      const stage = $('stage');
      const ladder = $('ladder');
      const steps = $('steps');
      const column = getComputedStyle(document.querySelector('.dojo')).flexDirection === 'column';
      const r = arena.getBoundingClientRect();
      let w;
      if (column) {
        w = r.width;
      } else {
        const ah = document.querySelector('.dojo').getBoundingClientRect().height - steps.getBoundingClientRect().height - 12;
        w = Math.min(r.width, ah * 16 / 9);
      }
      w = Math.max(240, Math.floor(w));
      stage.style.width = `${w}px`;
      stage.style.height = `${Math.round(w * 9 / 16)}px`;
      ladder.style.height = column ? '' : `${Math.round(w * 9 / 16)}px`;
      ladder.style.marginTop = column ? '' : `${steps.getBoundingClientRect().height + 10}px`;
    }

    bindUi() {
      document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
      $('btnMain').onclick = () => (this.round ? this.throwWave() : this.start());
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
      $('sbStake').onclick = () => {
        const opts = this.steps.filter((s) => s <= this.bet);
        const i = opts.indexOf(this.sideStake);
        this.sideStake = opts[(i + 1) % opts.length] || opts[0];
        SFX.click();
        this.render();
      };
      document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { b.closest('.modal').hidden = true; }; });
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
      if (this.sideStake > this.bet) this.sideStake = this.steps.filter((s) => s <= this.bet).pop();
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
        SFX.gong();
        this.reached = {};
        this.deadAt = null;
        this.shieldSel = false;
        this.scene.clearWave();
        this.scene.banner('WAVE 1', 'SWIPE ACROSS THE LANES, THEN THROW', 'good');
        (d.jackpot_wins || []).forEach((j) => this.toast(`JACKPOT ${j.name}: ${this.money.fmt(j.amount)}!`));
      } catch (e) { this.error(e); }
      this.busy = false;
      this.render();
    }

    /** Odds of the current cut width on the coming wave (null until a cut is set). */
    get span() {
      if (!this.round || !this.next || !this.cut) return null;
      const s = this.next.spans[this.cut.to - this.cut.from];
      return s && s.playable ? s : null;
    }

    sideBetsForWave() {
      const out = {};
      const sp = this.span;
      if (!sp) return out;
      for (const id of SIDE_ORDER) if (this.sideSel[id] && sp.side_bets[id]) out[id] = this.sideStake;
      return out;
    }

    waveCost() {
      const sp = this.span;
      const sides = Object.values(this.sideBetsForWave()).reduce((a, b) => a + b, 0);
      return sides + (this.shieldSel && sp && sp.helmet_price ? sp.helmet_price : 0);
    }

    async throwWave() {
      const sp = this.span;
      if (this.busy || !this.round || !this.next) return;
      if (!sp) return this.toast('Swipe across the lanes to set your cut first', true);
      const cost = this.waveCost();
      if (cost > this.balance) return this.toast('Not enough credit for the side bets', true);
      this.busy = true;
      this.render();
      const q = this.next;
      const cut = { ...this.cut };
      const shield = !!(this.shieldSel && sp.helmet_price);
      let d;
      try {
        d = await api('action', { action: 'shoot', cut: { from: cut.from, to: cut.to }, side_bets: this.sideBetsForWave(), helmet: shield, expect_shot: q.shot_index });
      } catch (e) {
        this.busy = false;
        this.error(e);
        if (e.code === 'STALE_SHOT' || e.code === 'NO_ROUND') this.resync();
        return this.render();
      }
      this.balance -= d.shot.cost;
      this.render();
      const shot = d.shot;
      const steps = shot.outcome === 'cut' ? sp.multipliers.slice(0, shot.fruits_cut) : [];
      await this.scene.playLanes({ lanes: shot.lanes, dragon: shot.dragon, cut, steps, saved: shot.saved, outcome: shot.outcome, index: q.level - 1 });
      this.apply(d);
      if (shot.side_win > 0) {
        this.flashSide(shot.side_bets.filter((x) => x.won).map((x) => x.id));
        this.toast(`SIDE BET WIN ${this.money.fmt(shot.side_win)}`);
        SFX.coin();
      }
      if (shot.saved) {
        this.scene.banner('SHIELD!', `ONE STEP BACK · x${this.round.multiplier.toFixed(2)} · SAME WAVE AGAIN`, 'blue');
        this.shieldSel = false;
      } else if (shot.outcome !== 'cut') {
        this.deadAt = shot.level;
        this.scene.banner(shot.outcome === 'bomb' ? 'BOOM!' : 'MISSED!', shot.outcome === 'bomb' ? 'A BOMB WAS IN YOUR CUT' : 'NO FRUIT IN YOUR CUT', 'bad');
        this.history.unshift(this.historyRow(d));
      } else {
        this.reached[shot.level] = shot.multiplier;
        if (d.settled) {
          this.scene.banner(d.settled.end === 'top' ? 'GRAND MASTER!' : 'MAX WIN!', `${this.money.fmt(d.settled.win)} · x${d.settled.multiplier.toFixed(2)}`, 'good');
          SFX.cashout();
          this.scene.coins(480, 300, 60);
          this.history.unshift(this.historyRow(d));
        } else {
          this.scene.banner(`WAVE ${shot.level} CLEARED`, `${shot.fruits_cut} FRUIT${shot.fruits_cut > 1 ? 'S' : ''} · x${shot.multiplier.toFixed(2)} · NEXT: ${this.crash.wave_names[q.level].toUpperCase()}`, 'good');
        }
      }
      if (!this.round) this.scene.setCut(null);
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
        this.scene.coins(480, 300, 40);
        this.scene.banner('CASHED OUT', `${this.money.fmt(s.win)} · x${s.multiplier.toFixed(2)}`, 'good');
        this.scene.setCut(null);
      } catch (e) { this.error(e); }
      this.busy = false;
      this.render();
    }

    async resync() {
      try { const d = await api('init', {}); this.apply(d); } catch { /* ignore */ }
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
      return { settled: s, mode: s.mode, nonce: s.nonce, client_seed: s.client_seed, server_seed_hash: s.server_seed_hash, shots: s.shots };
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

      const main = $('btnMain');
      main.classList.toggle('go', !!r);
      main.disabled = this.busy || (!r && this.bet > this.balance) || (!!r && !this.span);
      if (r) {
        $('btnMainTop').textContent = 'THROW';
        const cost = this.waveCost();
        $('btnMainSub').textContent = !this.span ? 'SET YOUR CUT FIRST' : cost ? `WAGERS ${fmt(cost)}` : 'LOCKS YOUR CUT';
      } else {
        $('btnMainTop').textContent = 'START';
        $('btnMainSub').textContent = `BET ${fmt(this.bet)}`;
      }
      const cash = $('btnCash');
      const canCash = !!r && r.level >= 1 && !this.busy;
      cash.disabled = !canCash;
      cash.classList.toggle('ready', canCash);
      $('cashVal').textContent = r && r.level >= 1 ? fmt(r.cashout_value) : '—';
      const sp = this.span;
      this.scene.setMultiplier(r && r.level >= 1 ? `x${r.multiplier.toFixed(2)}` : '');
      this.scene.setShield(!!(sp && this.shieldSel && sp.helmet_price));
      this.scene.setDrawing(!!r && !this.busy, q ? q.max_width : this.crash.lanes);
      if (r && !this.busy && !sp && this.cut) this.scene.setCut(null);

      const lvl = r && q ? q.level : 1;
      const [n, b] = this.crash.modes[this.mode].waves[lvl - 1];
      $('nsLevel').textContent = `${r ? lvl : 0}/${this.crash.levels}`;
      $('nsWave').textContent = this.crash.wave_names[lvl - 1].toUpperCase();
      $('nsObjects').innerHTML = `<span class="chip f"><b>${n}</b>fruit</span><span class="chip bm"><b>${b}</b>bomb${b === 1 ? '' : 's'}</span><span class="chip e"><b>${this.crash.lanes - n - b}</b>empty</span>`;
      $('hudCut').hidden = !r;
      const step = !r ? 0 : this.busy ? 2 : sp ? 2 : 1;
      document.querySelectorAll('#steps li').forEach((li) => {
        const k = Number(li.dataset.step);
        const cash = r && r.level >= 1 && !this.busy;
        li.classList.toggle('on', k === step || (k === 3 && cash));
        li.classList.toggle('done', !!r && k < step);
      });
      $('nsCut').textContent = sp ? `${this.cut.to - this.cut.from + 1} LANE${this.cut.to > this.cut.from ? 'S' : ''}` : r ? 'SWIPE' : '—';
      if (sp) {
        $('nsChance').textContent = `${(sp.chance * 100).toFixed(1)}%`;
        const m = sp.multipliers;
        $('nsNext').textContent = m.length > 1 ? `x${m[0].toFixed(2)} – x${m.at(-1).toFixed(2)}` : `x${m[0].toFixed(2)}`;
      } else {
        $('nsChance').textContent = '—';
        $('nsNext').textContent = r ? 'SET YOUR CUT' : `${this.crash.levels} WAVES`;
      }
      this.renderSideBets();
      this.renderLadder();
    }

    renderSideBets() {
      const row = $('sbRow');
      const q = this.round ? this.span : null;
      const ICONS = {
        mega_combo: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd23f" stroke-width="2.4" stroke-linecap="round"><path d="M3 17L17 3M7 21L21 7M3 11L11 3"/></svg>',
        clean_sheet: '<svg viewBox="0 0 24 24" fill="#7dff8a"><path d="M12 2l2.2 6.3L21 9l-5.2 4 1.8 7-5.6-3.9L6.4 20l1.8-7L3 9l6.8-.7z"/></svg>',
        dragon_fruit: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="7" ry="8" fill="#ff4fa3"/><path d="M12 3l2 4h-4zM5 9l4 1-2 3zM19 9l-4 1 2 3z" fill="#7dff8a"/></svg>',
        insurance: '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="7" fill="#22222a" stroke="#ff3b3b" stroke-width="1.5"/><path d="M15 8l3-3" stroke="#c8a070" stroke-width="2"/><circle cx="19" cy="4" r="1.6" fill="#ffd23f"/></svg>',
        shield: '<svg viewBox="0 0 24 24" fill="rgba(122,215,255,.25)" stroke="#7ad7ff" stroke-width="2"><path d="M12 2l8 4.6v9.2L12 21l-8-5.2V6.6z"/></svg>'
      };
      const DESC = {
        mega_combo: `Pays if ${this.crash.combo_min} or more fruits land in your cut and no bomb does. Needs a cut of at least ${this.crash.combo_min} lanes.`,
        clean_sheet: 'Pays if every fruit of the wave lands in your cut and no bomb does. Wider cuts make it likelier.',
        dragon_fruit: `A golden dragon fruit turns up in about 1 wave in ${Math.round(1 / this.crash.dragon_chance)}. Pays if it lands in your cut and no bomb does.`,
        insurance: 'Pays if a bomb lands in your cut. Use it to hedge the main bet on a risky wave.',
        shield: `From wave ${this.crash.helmet.from_level}, once per round. If a bomb lands in your cut, the shield takes the blast: your multiplier drops one step and you replay the wave. It does not save a cut with no fruit.`
      };
      if (!row.children.length) {
        for (const id of [...SIDE_ORDER, 'shield']) {
          const b = document.createElement('button');
          b.className = `sb${id === 'shield' ? ' shield' : ''}`;
          b.dataset.id = id;
          const name = id === 'shield' ? (this.crash.helmet.label || 'Shield') : this.crash.side_bets[id].label;
          b.innerHTML = `<span class="ico">${ICONS[id]}</span><span class="sb-n">${name}</span><span class="sb-o">—</span><span class="sb-p"></span><span class="sb-d">${DESC[id]}</span><span class="tick"></span>`;
          b.onclick = () => {
            if (id === 'shield') this.shieldSel = !this.shieldSel; else this.sideSel[id] = !this.sideSel[id];
            SFX.click();
            this.render();
          };
          row.appendChild(b);
        }
      }
      $('sbStakeVal').textContent = this.money.fmt(this.sideStake);
      const rtp = 0.965;
      for (const b of row.children) {
        const id = b.dataset.id;
        const o = b.querySelector('.sb-o');
        const p = b.querySelector('.sb-p');
        if (id === 'shield') {
          const price = q && q.helmet_price;
          b.disabled = this.busy || !price;
          b.classList.toggle('on', !!(this.shieldSel && price));
          o.textContent = price ? this.money.fmt(price) : '—';
          p.textContent = price ? `costs ${this.money.fmt(price)} for this wave` : this.round && this.round.saves ? 'used this round' : this.round && q ? `from wave ${this.crash.helmet.from_level}` : this.round ? 'set your cut to see the price' : 'once per round';
          continue;
        }
        const odds = q ? q.side_bets[id] : null;
        b.disabled = this.busy || (!!q && !odds);
        b.classList.toggle('on', !!this.sideSel[id] && (!q || !!odds));
        o.textContent = odds ? `x${odds.toFixed(2)}` : '—';
        if (odds) p.textContent = `≈ 1 in ${Math.max(1, Math.round(odds / rtp))} with your cut`;
        else if (q) p.textContent = id === 'mega_combo' ? `needs a cut of ${this.crash.combo_min}+ lanes` : id === 'clean_sheet' ? `needs a cut of ${this.next.fruits}+ lanes` : 'not possible with this cut';
        else p.textContent = this.round ? 'set your cut to see the odds' : 'odds appear once you set a cut';
      }
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
      const sp = this.span;
      const waves = this.crash.modes[this.mode].waves;
      [...el.children].forEach((d, i) => {
        const L = i + 1;
        const rm = d.querySelector('.rm');
        const comp = `${waves[i][0]}F·${waves[i][1]}B`;
        d.className = 'rung';
        if (r && L <= r.level) { d.classList.add('done'); rm.textContent = `x${fmtMult(this.reached[L] || 0)}`; return; }
        if (r && L === r.level + 1) { d.classList.add('next'); rm.textContent = sp ? `x${fmtMult(sp.multipliers.at(-1))}` : comp; return; }
        if (!r && this.deadAt && L === this.deadAt) { d.classList.add('dead'); rm.textContent = comp; return; }
        if (!r && this.deadAt && L < this.deadAt && this.reached[L]) { d.classList.add('done'); rm.textContent = `x${fmtMult(this.reached[L])}`; return; }
        rm.textContent = comp;
      });
    }

    flashSide(ids) {
      for (const b of $('sbRow').children) if (ids.includes(b.dataset.id)) { b.classList.remove('won'); void b.offsetWidth; b.classList.add('won'); }
    }

    toast(msg, err = false) {
      const el = $('toast');
      el.textContent = msg;
      el.className = `toast${err ? ' err' : ''}`;
      el.hidden = false;
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => { el.hidden = true; }, 2200);
    }

    error(e) { console.warn(e); this.toast(e.message || 'Something went wrong', true); }

    // -------------------------------------------------------------- sheets
    openRules() {
      const c = this.crash;
      const pct = (v) => `${(v * 100).toFixed(2)}%`;
      const waves = Object.entries(c.modes).map(([id, m]) => `<tr><td>${m.label}</td>${m.waves.map(([f, b]) => `<td>${f}F ${b}B</td>`).join('')}</tr>`).join('');
      const sides = SIDE_ORDER.map((id) => `<tr><td>${c.side_bets[id].label}</td><td>${SIDE_HINT[id]}</td><td class="n">${pct(c.side_bets[id].rtp)}</td></tr>`).join('');
      $('rulesBody').innerHTML = `
        <p>Fruit Slash is a <b>step crash</b> game played over ${c.lanes} lanes. Place a bet, then before every wave <b>swipe across the lanes to set your cut</b>.
          Press THROW: your cut is locked in and only then the wave is thrown — fruit, bombs and empty lanes.</p>
        <ul>
          <li>Every fruit in your cut is sliced and raises the multiplier; more fruit in one cut pays more.</li>
          <li>A bomb in your cut ends the round. A cut with no fruit in it also ends the round.</li>
          <li><b>Cash out</b> after any cleared wave. Clearing wave ${c.levels} cashes out automatically.</li>
          <li>A wider cut catches more fruit and more risk. The chance and the multipliers for your width are shown before you throw.</li>
        </ul>
        <h3>WAVES</h3>
        <div class="tbl-wrap"><table class="tbl"><tr><th>Risk</th>${c.wave_names.map((w, i) => `<th>${i + 1}</th>`).join('')}</tr>${waves}</table></div>
        <p class="muted">F = fruit, B = bombs, the rest of the ${c.lanes} lanes are empty. Which lane holds what is decided by the fair hash after your cut is locked.</p>
        <h3>SIDE BETS (NEXT WAVE ONLY)</h3>
        <p>Pick side bets and a stake (up to your bet) before a wave. Their odds depend on the width of your cut and settle on that wave.</p>
        <table class="tbl"><tr><th>Bet</th><th>Wins when</th><th>RTP</th></tr>${sides}</table>
        <h3>SAMURAI SHIELD</h3>
        <p>From wave ${c.helmet.from_level}, once per round, buy a shield for the next wave. If a bomb is in your cut, the shield absorbs it: the multiplier goes back one step and you play the same wave again. It does not cover a cut with no fruit. Price = chance of a bomb in your cut × the multiplier it keeps (RTP ${pct(c.helmet.rtp)}).</p>
        <h3>RTP &amp; FAIRNESS</h3>
        <p>Theoretical RTP of the main bet: <b>${pct(c.rtp)}</b> for any cut widths and any cash-out point (every wave is priced so its average return is exactly the stake; multipliers are rounded to 0.01). Maximum win ${this.cfg.max_win_x.toLocaleString()}× bet: a width is only offered while its best result stays within it.</p>
        <p>The lanes of every wave come from HMAC-SHA256 of the server seed (its hash is shown before you play), your client seed, the round nonce and the wave number. Your cut is stored before that wave is built, so neither side can change the result. Rotate the seed in <b>FAIR</b> to check every wave you played.</p>
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
        row.innerHTML = `<span>#${h.nonce}</span><span class="dots">${h.shots.map((x) => `<i class="dot ${x.saved ? 'saved' : x.outcome}" title="Wave ${x.level}: ${x.outcome}"></i>`).join('')}</span>
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
      const sh = await sha256(seed);
      lines.push(`sha256(server_seed) = ${sh}  ${sh === h.server_seed_hash ? '✓ matches' : '✗ MISMATCH'}`);
      for (const s of h.shots) {
        const v = await fairShot(seed, h.client_seed, h.nonce, s.i);
        const [n, b] = this.crash.modes[h.mode].waves[s.level - 1];
        const wave = waveFromHash(this.crash, n, b, v.bytes);
        const cut = wave.lanes.slice(s.cut.from, s.cut.to + 1);
        const outcome = cut.includes('B') ? 'bomb' : cut.includes('F') ? 'cut' : 'empty';
        lines.push(`wave ${s.level} (#${s.i}): lanes ${wave.lanes.join('')} · cut ${s.cut.from + 1}-${s.cut.to + 1} → ${outcome} ${wave.lanes.join('') === s.lanes && outcome === s.outcome && v.hex === s.hash ? '✓' : '✗'}`);
      }
      $('vServer').value = seed; $('vClient').value = h.client_seed; $('vNonce').value = h.nonce; $('vShot').value = 0;
      $('vOut').textContent = lines.join('\n');
    }

    async verifyForm() {
      const server = $('vServer').value.trim();
      if (!server) { $('vOut').textContent = 'Enter a revealed server seed.'; return; }
      const v = await fairShot(server, $('vClient').value.trim(), Number($('vNonce').value), Number($('vShot').value));
      const lines = [`sha256(server_seed) = ${await sha256(server)}`, `hmac = ${v.hex}`];
      for (const [id, m] of Object.entries(this.crash.modes)) {
        lines.push(`${m.label}, by wave: ` + m.waves.map(([n, b], i) => `W${i + 1} ${waveFromHash(this.crash, n, b, v.bytes).lanes.join('')}`).join(' · '));
      }
      $('vOut').textContent = lines.join('\n') + '\n(F fruit, B bomb, - empty; lane 1 first)';
    }

    openSkins() {
      const grid = $('skinsGrid');
      grid.innerHTML = '';
      for (const s of this.crash.skins) {
        const ok = this.unlocked.includes(s.id);
        const d = document.createElement('button');
        d.className = `skin${s.id === this.skin ? ' on' : ''}${ok ? '' : ' locked'}`;
        const cv = document.createElement('canvas');
        cv.width = 180; cv.height = 100;
        d.appendChild(cv);
        d.insertAdjacentHTML('beforeend', `<b>${s.name}</b><span class="lock-l">${ok ? (s.id === this.skin ? 'EQUIPPED' : 'TAP TO EQUIP') : `${Math.min(this.stats.shots, s.shots)} / ${s.shots} WAVES`}</span>`);
        window.FruitScene.drawBladePreview(cv, s.id);
        d.disabled = !ok;
        d.onclick = async () => {
          try { const r = await api('action', { action: 'skin', skin: s.id }); this.apply(r); SFX.click(); this.openSkins(); } catch (e) { this.error(e); }
        };
        grid.appendChild(d);
      }
      $('modalSkins').hidden = false;
    }
  }

  // ---------------------------------------------------------------- fairness (WebCrypto)
  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
  async function fairShot(server, client, nonce, shot) {
    const key = await crypto.subtle.importKey('raw', enc.encode(server), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${client}:${nonce}:${shot}`));
    return { hex: hex(sig), bytes: new DataView(sig) };
  }
  /** Same shuffle as the server (src/engine/exclusive/lane-slash.js). */
  function waveFromHash(c, n, b, dv) {
    const lanes = [...'F'.repeat(n), ...'B'.repeat(b), ...'-'.repeat(c.lanes - n - b)];
    for (let i = c.lanes - 1, word = 0; i >= 1; i--, word++) {
      const j = Math.floor((dv.getUint32(word * 4) / 4294967296) * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const dragon = dv.getUint32(28) / 4294967296 < c.dragon_chance ? lanes.indexOf('F') : -1;
    return { lanes, dragon };
  }

  window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); window.game.boot(); });
})();
