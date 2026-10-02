/*
 * Fruit Slash — game client (SpinKit Exclusive, step crash).
 * POST /api/v1/rgs/init and /api/v1/rgs/action; the canvas scene animates what the server decided.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const TOKEN = new URLSearchParams(location.search).get('token');
  const SFX = window.SFX;
  const SIDE_ORDER = ['mega_combo', 'bomb_deflect', 'dragon_fruit', 'clean_sheet', 'insurance'];
  const SIDE_HINT = {
    mega_combo: '4 or more fruits cut in one swipe',
    bomb_deflect: 'The blade knocks a bomb away without a blast',
    dragon_fruit: 'A golden dragon fruit appears and is cut',
    clean_sheet: 'Every fruit of the wave is cut',
    insurance: 'Pays if the wave ends in a bomb blast'
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
      if (!d.game_config || !d.game_config.crash || !d.game_config.crash.waves) return this.fatal('This server does not run Fruit Slash yet — restart it.');
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
      this.apply(d);
      if (d.round) {
        this.mode = d.round.mode;
        this.betIndex = Math.max(0, this.steps.indexOf(d.round.bet));
        for (const s of d.round.shots) if (s.multiplier) this.reached[s.level] = s.multiplier;
        this.scene.setIdle(false);
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
      const wrap = document.querySelector('.stage-wrap');
      const ladder = $('ladder');
      const stage = $('stage');
      const vertical = getComputedStyle(wrap).flexDirection === 'column';
      const r = wrap.getBoundingClientRect();
      const lw = vertical ? 0 : ladder.getBoundingClientRect().width + 14;
      const lh = vertical ? ladder.getBoundingClientRect().height + 10 : 0;
      const aw = r.width - lw - 8;
      const ah = r.height - lh - 8;
      let w = vertical && innerWidth <= 640 ? aw : Math.min(aw, ah * 16 / 9);
      w = Math.max(240, Math.floor(w));
      stage.style.width = `${w}px`;
      stage.style.height = `${Math.round(w * 9 / 16)}px`;
      if (!vertical) ladder.style.height = `${Math.round(w * 9 / 16)}px`;
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
        this.scene.setIdle(false);
        this.scene.banner('WAVE 1', this.crash.waves[0].name.toUpperCase(), 'good');
        (d.jackpot_wins || []).forEach((j) => this.toast(`JACKPOT ${j.name}: ${this.money.fmt(j.amount)}!`));
      } catch (e) { this.error(e); }
      this.busy = false;
      this.render();
    }

    sideBetsForWave() {
      const out = {};
      if (!this.next) return out;
      for (const id of SIDE_ORDER) if (this.sideSel[id] && this.next.side_bets[id]) out[id] = this.sideStake;
      return out;
    }

    waveCost() {
      const sides = Object.values(this.sideBetsForWave()).reduce((a, b) => a + b, 0);
      return sides + (this.shieldSel && this.next && this.next.helmet_price ? this.next.helmet_price : 0);
    }

    async throwWave() {
      if (this.busy || !this.round || !this.next) return;
      const cost = this.waveCost();
      if (cost > this.balance) return this.toast('Not enough credit for the side bets', true);
      this.busy = true;
      this.render();
      const q = this.next;
      const shield = !!(this.shieldSel && q.helmet_price);
      let d;
      try {
        d = await api('action', { action: 'shoot', side_bets: this.sideBetsForWave(), helmet: shield, expect_shot: q.shot_index });
      } catch (e) {
        this.busy = false;
        this.error(e);
        if (e.code === 'STALE_SHOT' || e.code === 'NO_ROUND') this.resync();
        return this.render();
      }
      this.balance -= d.shot.cost;
      this.render();
      const shot = d.shot;
      const idx = q.level - 1;
      await this.scene.playWave({ wave: this.crash.waves[idx], index: idx, outcome: shot.outcome, saved: shot.saved, boost: (this.crash.bonus && this.crash.bonus.boost) || 1.5 });
      this.apply(d);
      if (shot.side_win > 0) {
        this.flashSide(shot.side_bets.filter((s) => s.won).map((s) => s.id));
        this.toast(`SIDE BET WIN ${this.money.fmt(shot.side_win)}`);
        SFX.coin();
      }
      if (shot.saved) {
        this.scene.banner('SHIELD!', `ONE STEP BACK · x${this.round.multiplier.toFixed(2)}`, 'blue');
        this.shieldSel = false;
      } else if (shot.outcome === 'lethal') {
        this.deadAt = shot.level;
        this.scene.banner('BOOM!', 'ROUND LOST', 'bad');
        this.history.unshift(this.historyRow(d));
        this.scene.setIdle(true);
      } else {
        this.reached[shot.level] = shot.multiplier;
        if (d.settled) {
          this.scene.banner(d.settled.end === 'top' ? 'GRAND MASTER!' : 'MAX WIN!', `${this.money.fmt(d.settled.win)} · x${d.settled.multiplier.toFixed(2)}`, 'good');
          SFX.cashout();
          this.scene.coins(480, 300, 60);
          this.history.unshift(this.historyRow(d));
          this.scene.setIdle(true);
        } else {
          const bonus = shot.bonus ? `FRENZY ×${shot.bonus} · ` : shot.outcome === 'miss' ? 'ONE GOT AWAY · ' : '';
          this.scene.banner(`WAVE ${shot.level} CLEARED`, `${bonus}NEXT: ${this.crash.waves[q.level].name.toUpperCase()}`, shot.bonus ? 'blue' : 'good');
        }
      }
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
        this.scene.setIdle(true);
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
      main.disabled = this.busy || (!r && this.bet > this.balance);
      if (r) {
        $('btnMainTop').textContent = 'THROW WAVE';
        const cost = this.waveCost();
        $('btnMainSub').textContent = cost ? `WAGERS ${fmt(cost)}` : 'THEN SWIPE TO SLICE';
      } else {
        $('btnMainTop').textContent = 'START';
        $('btnMainSub').textContent = `BET ${fmt(this.bet)}`;
      }
      const cash = $('btnCash');
      const canCash = !!r && r.level >= 1 && !this.busy;
      cash.disabled = !canCash;
      cash.classList.toggle('ready', canCash);
      $('cashVal').textContent = r && r.level >= 1 ? fmt(r.cashout_value) : '—';
      this.scene.setMultiplier(r && r.level >= 1 ? `x${r.multiplier.toFixed(2)}` : '');
      this.scene.setShield(!!(r && this.shieldSel && q && q.helmet_price));

      const lvl = r && q ? q.level : 1;
      const wave = this.crash.waves[lvl - 1];
      $('nsLevel').textContent = `${r ? lvl : 0}/${this.crash.levels}`;
      $('nsWave').textContent = wave.name.toUpperCase();
      $('nsObjects').innerHTML = `<span class="fr">${wave.fruits}</span> FRUIT · <span class="bm">${wave.bombs}</span> BOMB${wave.bombs === 1 ? '' : 'S'}`;
      if (r && q) {
        $('nsChance').textContent = `${(q.chance * 100).toFixed(1)}%`;
        $('nsNext').textContent = `x${q.multiplier.toFixed(2)} · ${fmt(q.payout)}`;
      } else {
        const lad = this.crash.modes[this.mode].ladder;
        $('nsChance').textContent = `${(this.crash.modes[this.mode].survival[0] * 100).toFixed(0)}%`;
        $('nsNext').textContent = `UP TO x${fmtMult(lad.at(-1))}`;
      }
      this.renderSideBets();
      this.renderLadder();
    }

    renderSideBets() {
      const row = $('sbRow');
      const q = this.round ? this.next : null;
      if (!row.children.length) {
        for (const id of SIDE_ORDER) {
          const b = document.createElement('button');
          b.className = `sb sb-${id}`;
          b.dataset.id = id;
          b.title = SIDE_HINT[id];
          b.innerHTML = `<span class="sb-n">${this.crash.side_bets[id].label}</span><span class="sb-o">—</span>`;
          b.onclick = () => { this.sideSel[id] = !this.sideSel[id]; SFX.click(); this.render(); };
          row.appendChild(b);
        }
        const h = document.createElement('button');
        h.className = 'sb shield';
        h.dataset.id = 'shield';
        h.title = 'Samurai Shield: absorbs one bomb per round; the multiplier goes one step back and you throw the same wave again';
        h.innerHTML = `<span class="sb-n">${this.crash.helmet.label || 'Shield'}</span><span class="sb-o">—</span>`;
        h.onclick = () => { this.shieldSel = !this.shieldSel; SFX.click(); this.render(); };
        row.appendChild(h);
      }
      $('sbStakeVal').textContent = this.money.fmt(this.sideStake);
      for (const b of row.children) {
        const id = b.dataset.id;
        const o = b.querySelector('.sb-o');
        if (id === 'shield') {
          const price = q && q.helmet_price;
          b.disabled = this.busy || !price;
          b.classList.toggle('on', !!(this.shieldSel && price));
          o.textContent = price ? this.money.fmt(price) : q && this.round.saves ? 'USED' : q ? `FROM WAVE ${this.crash.helmet.from_level}` : '1 PER ROUND';
          continue;
        }
        const odds = q ? q.side_bets[id] : null;
        b.disabled = this.busy || (q && !odds);
        b.classList.toggle('on', !!this.sideSel[id] && (!q || !!odds));
        o.textContent = odds ? `x${odds.toFixed(2)}` : q ? '—' : 'ODDS ON START';
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
      const surv = this.crash.modes[this.mode].survival;
      const D = this.crash.bonus ? 1 + this.crash.outcomes[this.crash.bonus.outcome] * (this.crash.bonus.boost - 1) : 1;
      let est = r && this.next ? this.next.multiplier : null;
      [...el.children].forEach((d, i) => {
        const L = i + 1;
        const rm = d.querySelector('.rm');
        d.className = 'rung';
        if (r) {
          if (L <= r.level) { d.classList.add('done'); rm.textContent = `x${fmtMult(this.reached[L] || 0)}`; } else if (L === r.level + 1) { d.classList.add('next'); rm.textContent = `x${fmtMult(this.next.multiplier)}`; } else {
            est = est / (surv[L - 1] * D);
            d.classList.add('est');
            rm.textContent = `x${fmtMult(est)}`;
          }
        } else {
          rm.textContent = `x${fmtMult(this.crash.modes[this.mode].ladder[i])}`;
          if (this.deadAt && L === this.deadAt) d.classList.add('dead');
          else if (this.deadAt && L < this.deadAt && this.reached[L]) { d.classList.add('done'); rm.textContent = `x${fmtMult(this.reached[L])}`; }
        }
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
      const ladders = Object.entries(c.modes).map(([id, m]) => `<tr><td>${m.label}</td>${m.ladder.map((x, i) => `<td class="n" title="${Math.round(m.survival[i] * 100)}% chance">x${fmtMult(x)}</td>`).join('')}</tr>`).join('');
      const chances = Object.entries(c.modes).map(([id, m]) => `<tr><td>${m.label}</td>${m.survival.map((p) => `<td>${Math.round(p * 100)}%</td>`).join('')}</tr>`).join('');
      const sides = SIDE_ORDER.map((id) => `<tr><td>${c.side_bets[id].label}</td><td>${SIDE_HINT[id]}</td><td class="n">${pct(c.side_bets[id].rtp)}</td></tr>`).join('');
      $('rulesBody').innerHTML = `
        <p>Fruit Slash is a <b>step crash</b> game. Place a bet and throw up to ${c.levels} waves of fruit. Slice through them with your blade:
          every cleared wave raises the multiplier. <b>Cash out</b> after any cleared wave, or throw the next one. A bomb blast ends the round
          and the bet is lost. Clearing wave ${c.levels} cashes out automatically.</p>
        <h3>LADDER</h3>
        <div class="tbl-wrap"><table class="tbl"><tr><th>Wave</th>${c.waves.map((w, i) => `<th>${i + 1}</th>`).join('')}</tr>${chances}${ladders}</table></div>
        <p class="muted">Upper rows: chance to clear the wave. Lower rows: multiplier after it. Before each wave you see its exact chance and the multiplier you will reach.</p>
        <h3>FRENZY BANANA</h3>
        <p>A blue banana can appear in a cleared wave (${pct(c.outcomes.frenzy)} of them). Slice it: time slows, bombs vanish and that wave pays ×${c.bonus.boost} on top of its step. The ladder already accounts for it, so the return stays the same.</p>
        <h3>SIDE BETS (NEXT WAVE ONLY)</h3>
        <p>Pick side bets and a stake (up to your bet) before a wave. They settle on that wave at the odds shown, whatever happens to the main bet.</p>
        <table class="tbl"><tr><th>Bet</th><th>Wins when</th><th>RTP</th></tr>${sides}</table>
        <h3>SAMURAI SHIELD</h3>
        <p>From wave ${c.helmet.from_level} you can buy a shield for the next wave, once per round. If that wave ends in a blast, the shield absorbs it: the multiplier goes back one step and you throw the same wave again. Price = chance of a blast × the multiplier it keeps (RTP ${pct(c.helmet.rtp)}).</p>
        <h3>RTP &amp; FAIRNESS</h3>
        <p>Theoretical RTP of the main bet: <b>${pct(c.rtp)}</b> for any cash-out strategy (multipliers rounded to 0.01). Maximum win ${this.cfg.max_win_x.toLocaleString()}× bet.
          Every wave is decided by HMAC-SHA256 of the server seed (its hash is shown before you play), your client seed, the round nonce and the wave number — see <b>FAIR</b>.</p>
        <p><b>Swiping is cosmetic.</b> The result of each wave is fixed by the fair hash before it is thrown; the blade only plays it out. If you do not swipe, the wave is cut for you.</p>
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
        const outcome = outcomeOf(this.crash, s.chance, v.u);
        lines.push(`wave ${s.level} (#${s.i}): u=${v.u.toFixed(6)} vs chance ${s.chance.toFixed(6)} → ${outcome} ${outcome === s.outcome && v.hex === s.hash ? '✓' : '✗'}`);
      }
      $('vServer').value = seed; $('vClient').value = h.client_seed; $('vNonce').value = h.nonce; $('vShot').value = 0;
      $('vOut').textContent = lines.join('\n');
    }

    async verifyForm() {
      const server = $('vServer').value.trim();
      if (!server) { $('vOut').textContent = 'Enter a revealed server seed.'; return; }
      const v = await fairShot(server, $('vClient').value.trim(), Number($('vNonce').value), Number($('vShot').value));
      $('vOut').textContent = `sha256(server_seed) = ${await sha256(server)}\nhmac = ${v.hex}\nu (bytes 0-3) = ${v.u.toFixed(8)}\n` +
        Object.entries(this.crash.modes).map(([id, m]) => `${m.label}: ${m.survival.map((p, i) => `W${i + 1} ${outcomeOf(this.crash, p, v.u)}`).join(' · ')}`).join('\n');
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
    return { hex: hex(sig), u: new DataView(sig).getUint32(0) / 4294967296 };
  }
  function outcomeOf(c, chance, u) {
    if (u >= chance) return 'lethal';
    const x = u / chance;
    let acc = 0;
    const entries = Object.entries(c.outcomes);
    for (const [id, share] of entries) { acc += share; if (x < acc) return id; }
    return entries.at(-1)[0];
  }

  window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); window.game.boot(); });
})();
