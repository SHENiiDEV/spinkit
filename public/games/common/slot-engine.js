/**
 * SpinKit slot client — the UI shell shared by every game.
 * Talks to the RGS (/api/v1/rgs/init, /api/v1/rgs/spin) and drives a Pragmatic-Play-style UI:
 * CREDIT / BET meters, bet settings, autoplay, quick spin, feature buy,
 * free-spins intro/outro, big/mega/epic win celebrations.
 *
 * Everything mechanic-specific (view, spin presentation, rules text, plates) lives in
 * mechanics/<id>.js and is looked up with SlotKit.get(cfg.mechanic) — see kit.js.
 */
(function () {
  const { $, sleep, audio } = SlotKit.util;

  // ------------------------------------------------------------------ money
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
    fmt(minor) {
      return this.nf.format(minor / Math.pow(10, this.cur.decimals));
    }
  }

  const WIN_TIERS = [
    { x: 100, label: 'EPIC WIN' },
    { x: 50, label: 'SUPER MEGA WIN' },
    { x: 25, label: 'MEGA WIN' },
    { x: 10, label: 'BIG WIN' }
  ];

  class SlotGame {
    constructor() {
      this.token = new URLSearchParams(location.search).get('token') || '';
      this.busy = false;
      this.quick = false;
      this.auto = { left: 0, stopOnWin: false, stopOnFeature: true, limitX: 0 };
      this.fs = { active: false, left: 0, total: 0, totalMult: 0 };
      this.betIndex = 0;
      this.skipRequested = false;
      this.lineCycleId = 0;
    }

    // ================================================================ boot
    async boot() {
      this.bindUi();
      this.setLoader(10, 'CONNECTING...');
      if (!this.token) return this.fatal('Missing session token. Launch the game from the lobby.');
      let data;
      try {
        const res = await fetch('/api/v1/rgs/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: this.token }) });
        data = await res.json();
        if (!res.ok) return this.fatal(data.message || 'Session expired. Please relaunch the game from the lobby.');
      } catch (e) {
        return this.fatal('Server is not reachable.');
      }
      this.cfg = data.game_config;
      if (!this.cfg || !this.cfg.mechanic) {
        return this.fatal('Server is running an outdated version. Restart it: stop the old process (Ctrl+C) and run "node src/server.js" again.');
      }
      this.mech = SlotKit.get(this.cfg.mechanic);
      if (!this.cfg.bet_multiplier) this.cfg.bet_multiplier = 20;
      if (!this.cfg.coin_values) this.cfg.coin_values = this.cfg.bet_steps.map((b) => b / this.cfg.bet_multiplier);
      this.user = data.user;
      this.balance = data.user.balance;
      this.sessionInfo = data.session || { refill_enabled: true };
      this.jackpots = data.jackpots || [];
      this.money = new Money(this.cfg.currency);
      this.applyTheme();
      this.setLoader(40, 'LOADING GRAPHICS...');

      this.art = new window.SymbolArt(this.cfg);
      await this.art.load();
      this.setLoader(85, 'PREPARING REELS...');

      const steps = this.cfg.bet_steps;
      const st = data.active_state;
      this.betIndex = Math.max(0, steps.indexOf(st.has_free_spins && st.current_bet ? st.current_bet : this.cfg.default_bet));
      this.createView();
      this.buildInfo();
      this.buildBetChips();
      this.buildAutoChips();
      this.refreshMeters();
      this.applySession();
      this.renderJackpots();
      this.updateMultPlate();
      this.setLoader(100, 'READY');
      await sleep(250);
      $('app').classList.remove('loading');
      window.addEventListener('resize', () => this.onResize());

      if (st.has_free_spins) {
        this.fs = { active: true, left: st.free_spins_left, total: st.free_spins_total_win || 0, totalMult: st.total_multiplier || 0 };
        this.enterFreeSpinsUi();
        if (this.view.setSticky && st.sticky) this.view.setSticky(st.sticky);
        if (this.view.setSpots && st.spots) this.view.setSpots(st.spots);
        if (st.win_multiplier) { this.fs.totalMult = st.win_multiplier; this.updateMultPlate(); }
        await this.featureScreen({ kicker: 'WELCOME BACK!', line1: 'YOU HAVE', big: String(st.free_spins_left), line2: 'FREE SPINS REMAINING', btn: 'CONTINUE' });
        this.runFreeSpins();
      }
    }

    fatal(msg) {
      this.setLoader(100, msg.toUpperCase());
      $('loaderText').classList.add('error');
    }

    setLoader(pct, text) {
      $('loaderFill').style.width = pct + '%';
      $('loaderText').textContent = text;
    }

    applyTheme() {
      const t = this.cfg.theme || {};
      const app = $('app');
      const root = document.documentElement.style;
      root.setProperty('--accent', t.accent || '#ffd76a');
      root.setProperty('--bg1', t.bg1 || '#222');
      root.setProperty('--bg2', t.bg2 || '#000');
      root.setProperty('--reel1', (t.reelBg && t.reelBg[0]) || 'rgba(0,0,0,.5)');
      root.setProperty('--reel2', (t.reelBg && t.reelBg[1]) || 'rgba(0,0,0,.7)');
      root.setProperty('--title-font', `"${t.font || 'Cinzel'}"`);
      root.setProperty('--cols', this.cfg.reels);
      root.setProperty('--rows', this.cfg.rows);
      app.classList.add(`frame-${t.frame || 'gold'}`, `scene-${this.cfg.id}`, `mech-${this.cfg.mechanic}`);
      if (t.scene) app.classList.add(`scene-p-${t.scene}`);
      const rim = (window.SlotRims || {})[t.frame];
      if (rim) rim.forEach((c, i) => root.setProperty(`--rim${i + 1}`, c));
      if (t.lightReels) app.classList.add('light-reels');
      document.title = `${this.cfg.name}`;
      const [l1, l2] = t.title || [this.cfg.name, ''];
      if (t.logo) {
        $('logo').classList.add('has-custom-logo');
        $('logo').style.backgroundImage = `url("${t.logo}")`;
        $('logo1').textContent = '';
        $('logo2').textContent = '';
      } else {
        $('logo1').textContent = l1;
        $('logo2').textContent = l2;
      }
      if (t.background) {
        const bgBase = document.querySelector('.bg-base');
        if (bgBase) bgBase.style.backgroundImage = `url("${t.background}")`;
      }
      if (t.stage) this.setupStage(t.stage);
      $('loaderLogo').textContent = this.cfg.name.toUpperCase();
      $('maxWinText').textContent = `${Number(this.cfg.max_win_x).toLocaleString()}x`;
      const plate = this.mech.plate(this.cfg);
      $('waysText').textContent = plate.value;
      $('waysLabel').textContent = plate.label;
      $('betMultValue').textContent = `${this.cfg.bet_multiplier}x`;
      $('betMultLabel').textContent = this.mech.betLabel;
      if (this.cfg.free_spins && this.cfg.free_spins.buy_cost) $('btnBuy').hidden = false;
      if (this.mech.buyTitle) $('btnBuy').querySelector('.buy-title').innerHTML = this.mech.buyTitle;
      this.bgfx = new window.BackgroundFX($('bgFx'), t.particles, t.accent);
      this.coins = new window.CoinShower($('coinCanvas'));
    }

    /**
     * "Stage" layout: the whole cabinet (frame, logo, decorations) is one picture and the
     * reels are placed exactly inside its panel. theme.stage = { image, width, height,
     * reels: { x, y, w, h }, pad } in the picture's pixels.
     */
    setupStage(st) {
      const app = $('app');
      const frame = $('reelFrame');
      app.classList.add('has-stage');
      const wrap = document.createElement('div');
      wrap.className = 'stage-art';
      wrap.id = 'stageArt';
      wrap.style.backgroundImage = `url("${st.image}")`;
      frame.parentNode.insertBefore(wrap, frame);
      wrap.appendChild(frame);
      const W = st.width;
      const H = st.height;
      const R = st.reels;
      const pad = st.pad || 0;
      const cols = this.cfg.reels;
      const rows = this.cfg.rows;
      // fill the panel; cells may be a bit wider than tall (symbols stay square, see GridView.resize)
      const maxStretch = st.max_cell_aspect || 1.6;
      let gridW = R.w - pad * 2;
      let gridH = R.h - pad * 2;
      // painted cabinets with their own reel windows (reel_rects) keep the exact box; the view places each reel
      if (!st.reel_rects && gridW / cols / (gridH / rows) > maxStretch) gridW = (gridH / rows) * maxStretch * cols;
      if (!st.reel_rects && gridH / rows / (gridW / cols) > maxStretch) gridH = (gridW / cols) * maxStretch * rows;
      const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
      frame.style.left = pct(R.x + (R.w - gridW) / 2, W);
      frame.style.top = pct(R.y + (R.h - gridH) / 2, H);
      frame.style.width = pct(gridW, W);
      frame.style.height = pct(gridH, H);
      document.documentElement.style.setProperty('--stage-ar', String(W / H));
      const bgBase = document.querySelector('.bg-base');
      if (bgBase) bgBase.style.backgroundImage = `url("${st.image}")`;
    }

    multRangeText() {
      const v = (this.cfg.free_spins && this.cfg.free_spins.sticky_multipliers) || [];
      if (!v.length) return '';
      return v.length > 2 ? `x${v[0]} – x${v[v.length - 1]}` : v.map((x) => `x${x}`).join(' / ');
    }

    shake(strong = false) {
      const el = $('stageArt') || $('reelFrame');
      el.classList.remove('shake', 'shake-strong');
      void el.offsetWidth;
      el.classList.add(strong ? 'shake-strong' : 'shake');
    }

    createView() {
      this.view = this.mech.createView(this, $('slotCanvas'));
    }

    /** Compact money for coins: $12, $1.5K, $2M */
    fmtShort(minor) {
      const cur = this.money.cur;
      const v = minor / Math.pow(10, cur.decimals);
      const sym = cur.symbol || '';
      if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
      if (v >= 1e4) return `${sym}${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K`;
      if (v >= 100) return `${sym}${Math.round(v)}`;
      return `${sym}${v.toFixed(v % 1 ? 2 : 0)}`;
    }

    demoMatrix() {
      const giants = this.cfg.giants || {};
      const ids = Object.keys(this.cfg.symbols).filter((s) => !['MULT', 'SCATTER', 'WILD'].includes(s) && !giants[s]);
      return Array.from({ length: this.cfg.rows }, (_, r) => Array.from({ length: this.cfg.reels }, (_, c) => ids[(r * 3 + c * 2) % ids.length]));
    }

    onResize() {
      clearTimeout(this.resizeT);
      this.resizeT = setTimeout(() => this.view && this.view.resize(), 80);
    }

    // ================================================================ UI
    bindUi() {
      $('btnSpin').addEventListener('click', () => this.onSpinPressed());
      $('btnBetMinus').addEventListener('click', () => this.changeBet(-1));
      $('btnBetPlus').addEventListener('click', () => this.changeBet(1));
      $('betMeter').addEventListener('click', () => this.openModal('modalBet'));
      $('btnTurbo').addEventListener('click', () => this.setQuick(!this.quick));
      $('btnAuto').addEventListener('click', () => (this.auto.left > 0 ? this.stopAuto() : this.openModal('modalAuto')));
      $('btnSound').addEventListener('click', () => this.toggleSound());
      $('btnInfo').addEventListener('click', () => this.openModal('modalInfo'));
      $('btnMenu').addEventListener('click', () => this.openModal('modalMenu'));
      $('btnRefill').addEventListener('click', () => this.refill());
      $('btnBuy').addEventListener('click', () => this.openBuy());
      $('btnBuyConfirm').addEventListener('click', () => {
        this.closeModals();
        this.spin({ buy: true });
      });
      $('btnMaxBet').addEventListener('click', () => {
        this.setBetIndex(this.cfg.bet_steps.length - 1);
        this.closeModals();
      });
      $('btnStartAuto').addEventListener('click', () => this.startAuto());
      $('menuLobby').addEventListener('click', () => {
        const url = this.sessionInfo && this.sessionInfo.lobby_url;
        if (url) {
          try { window.top.location.href = url; } catch { location.href = url; }
        } else if (window.parent !== window) window.parent.postMessage({ type: 'spinkit:close' }, '*');
        else location.href = '/';
      });
      $('menuInfo').addEventListener('click', () => { this.closeModals(); this.openModal('modalInfo'); });
      $('menuSound').addEventListener('click', () => this.toggleSound());
      $('menuRefill').addEventListener('click', () => { this.closeModals(); this.refill(); });
      document.querySelectorAll('[data-bet]').forEach((b) => b.addEventListener('click', () => this.changeBet(Number(b.dataset.bet))));
      document.querySelectorAll('.modal').forEach((m) => {
        m.addEventListener('click', (e) => { if (e.target === m || e.target.hasAttribute('data-close')) this.closeModals(); });
      });
      $('bigWin').addEventListener('click', () => { this.skipRequested = true; });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (document.querySelector('.modal.open')) return;
          if ($('featureScreen').classList.contains('open')) return $('featureBtn').click();
          this.skipRequested = true;
          this.onSpinPressed();
        }
      });
    }

    openModal(id) {
      if (id === 'modalInfo') this.buildInfo();
      if (id === 'modalBet') this.buildBetChips();
      if (id === 'modalBet' && (this.busy || this.fs.active)) return this.toast('BET CANNOT BE CHANGED NOW');
      $(id).classList.add('open');
    }

    closeModals() {
      document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
    }

    toast(text, ms = 1600) {
      const t = $('toast');
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(this.toastT);
      this.toastT = setTimeout(() => t.classList.remove('show'), ms);
    }

    setMessage(text, cls = '') {
      const m = $('message');
      m.innerHTML = text;
      m.className = 'message ' + cls;
    }

    get bet() {
      return this.cfg.bet_steps[this.betIndex];
    }

    changeBet(d) {
      if (this.busy || this.fs.active) return;
      this.setBetIndex(this.betIndex + d);
      audio().playSpinClick();
    }

    setBetIndex(i) {
      this.betIndex = Math.max(0, Math.min(this.cfg.bet_steps.length - 1, i));
      this.refreshMeters();
      if (this.jackpots && this.jackpots.length) this.renderJackpots();
      this.buildBetChips();
    }

    refreshMeters() {
      $('valBalance').textContent = this.money.fmt(this.balance);
      $('valBet').textContent = this.money.fmt(this.fs.active ? (this.fsBet || this.bet) : this.bet);
      $('coinValue').textContent = this.money.fmt(this.cfg.coin_values[this.betIndex] ?? this.bet / this.cfg.bet_multiplier);
      $('totalBetValue').textContent = this.money.fmt(this.bet);
      if (this.cfg.free_spins && this.cfg.free_spins.buy_cost) {
        $('buyPrice').textContent = this.money.fmt(this.bet * this.cfg.free_spins.buy_cost);
      }
      $('btnBetMinus').disabled = this.betIndex === 0 || this.fs.active;
      $('btnBetPlus').disabled = this.betIndex === this.cfg.bet_steps.length - 1 || this.fs.active;
    }

    buildBetChips() {
      if (!this.cfg) return;
      const wrap = $('betChips');
      wrap.innerHTML = '';
      this.cfg.bet_steps.forEach((b, i) => {
        const el = document.createElement('button');
        el.className = 'chip' + (i === this.betIndex ? ' active' : '');
        el.textContent = this.money.fmt(b);
        el.onclick = () => this.setBetIndex(i);
        wrap.appendChild(el);
      });
    }

    buildAutoChips() {
      const counts = [10, 20, 50, 75, 100, 500, 1000];
      this.autoCount = 10;
      const wrap = $('autoChips');
      wrap.innerHTML = '';
      counts.forEach((n) => {
        const el = document.createElement('button');
        el.className = 'chip' + (n === this.autoCount ? ' active' : '');
        el.textContent = n;
        el.onclick = () => {
          this.autoCount = n;
          wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === el));
          $('btnStartAuto').textContent = `START AUTOPLAY (${n})`;
        };
        wrap.appendChild(el);
      });
      const limits = [0, 10, 50, 100, 500];
      this.autoLimit = 0;
      const lw = $('autoLimitChips');
      lw.innerHTML = '';
      limits.forEach((x) => {
        const el = document.createElement('button');
        el.className = 'chip' + (x === 0 ? ' active' : '');
        el.textContent = x ? `${x}x BET` : 'OFF';
        el.onclick = () => {
          this.autoLimit = x;
          lw.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === el));
        };
        lw.appendChild(el);
      });
    }

    setQuick(on) {
      this.quick = on;
      $('btnTurbo').classList.toggle('on', on);
      this.toast(on ? 'QUICK SPIN ON' : 'QUICK SPIN OFF', 900);
    }

    toggleSound() {
      const muted = audio().toggleMute();
      $('btnSound').classList.toggle('off', muted);
      $('menuSound').textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
    }

    async refill() {
      try {
        const res = await fetch('/api/v1/rgs/refill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: this.token }) });
        const data = await res.json();
        if (data.status === 'success') {
          this.balance = data.balance;
          this.refreshMeters();
          this.toast(`+${this.money.fmt(data.added)} FREE CREDITS`);
          audio().playCoin();
        }
      } catch (e) {
        console.error(e);
      }
    }

    applySession() {
      const si = this.sessionInfo || {};
      if (si.refill_enabled === false) {
        $('btnRefill').hidden = true;
        $('menuRefill').hidden = true;
      }
      if (si.test_mode) {
        $('testBadge').hidden = false;
        $('testBadge').textContent = `TEST MODE · RTP ${this.cfg.rtp}${si.force_feature ? ' · FEATURE FORCED' : ''}`;
      }
    }

    renderJackpots() {
      const bar = $('jpBar');
      const list = this.jackpots || [];
      bar.hidden = !list.length;
      document.documentElement.style.setProperty('--jp-h', list.length ? `${(bar.offsetHeight || 42) + 26}px` : '0px');
      if (!list.length) return;
      if (bar.children.length !== list.length) {
        bar.innerHTML = list.map((j) => `<div class="jp jp-${j.tier}" data-tier="${j.tier}"><span class="jp-name">${j.name}</span><span class="jp-amount"></span></div>`).join('');
        this.jpShown = {};
      }
      for (const j of list) {
        const el = bar.querySelector(`[data-tier="${j.tier}"] .jp-amount`);
        const from = this.jpShown[j.tier] == null ? j.amount : this.jpShown[j.tier];
        this.jpShown[j.tier] = j.amount;
        const t0 = performance.now();
        const tick = (t) => {
          const k = Math.min(1, (t - t0) / 900);
          el.textContent = this.money.fmt(Math.round(from + (j.amount - from) * k));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        el.parentElement.classList.toggle('locked', this.bet < (j.min_bet || 0) && !this.fs.active);
      }
    }

    async jackpotWin(w) {
      this.skipRequested = false;
      const el = $('bigWin');
      el.classList.add('open', 'jackpot');
      $('bigWinTitle').textContent = `${w.name} JACKPOT`;
      $('bigWinTitle').classList.remove('bump');
      void $('bigWinTitle').offsetWidth;
      $('bigWinTitle').classList.add('bump');
      this.coins.start(120);
      this.coins.burst(80);
      audio().playFreeSpinsTrigger();
      audio().playBigWin();
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = (t) => {
          const k = this.skipRequested ? 1 : Math.min(1, (t - t0) / 3500);
          $('bigWinAmount').textContent = this.money.fmt(Math.floor(w.amount * k));
          if (k < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await sleep(this.skipRequested ? 300 : 2200);
      this.coins.stop();
      el.classList.remove('open', 'jackpot');
      this.skipRequested = false;
    }

    openBuy() {
      if (this.busy || this.fs.active) return;
      const fs = this.cfg.free_spins;
      $('buyQuestion').textContent = this.mech.buyQuestion(this.cfg);
      $('buyCost').textContent = this.money.fmt(this.bet * fs.buy_cost);
      this.openModal('modalBuy');
    }

    // ================================================================ autoplay
    startAuto() {
      this.auto = {
        left: this.autoCount || 10,
        stopOnWin: $('autoStopWin').checked,
        stopOnFeature: $('autoStopFeature').checked,
        limitX: this.autoLimit || 0,
        startBalance: this.balance
      };
      if ($('autoQuick').checked) this.setQuick(true);
      this.closeModals();
      $('btnAuto').classList.add('on');
      this.updateAutoBadge();
      if (!this.busy) this.spin();
    }

    stopAuto() {
      this.auto.left = 0;
      $('btnAuto').classList.remove('on');
      this.updateAutoBadge();
    }

    updateAutoBadge() {
      const n = this.fs.active ? this.fs.left : this.auto.left;
      $('spinCount').textContent = n > 0 ? n : '';
      $('btnSpin').classList.toggle('counting', n > 0);
    }

    // ================================================================ spin
    onSpinPressed() {
      audio().init();
      if (this.busy) {
        this.skipRequested = true; // slam stop / skip presentation
        return;
      }
      if (this.auto.left > 0) return this.stopAuto();
      if (this.fs.active) return;
      this.spin();
    }

    async spin({ buy = false } = {}) {
      if (this.busy) return;
      const inFs = this.fs.active;
      const cost = inFs ? 0 : (buy ? this.bet * this.cfg.free_spins.buy_cost : this.bet);
      if (!inFs && this.balance < cost) {
        this.stopAuto();
        this.toast('NOT ENOUGH CREDIT — TAP + TO ADD FREE CREDITS', 2600);
        return;
      }
      this.busy = true;
      this.skipRequested = false;
      this.lineCycleId++;
      document.body.classList.add('spinning');
      this.view.clearWin();
      this.hideWinBanner();
      audio().playSpinClick();

      if (!inFs) {
        this.balance -= cost;
        this.refreshMeters();
        this.setMessage('GOOD LUCK!');
      } else {
        this.fs.left -= 1;
        this.updateFsCounter();
        this.setMessage(`FREE SPIN <b>${this.fs.used + 1}</b> OF <b>${this.fs.used + 1 + this.fs.left}</b>`);
        this.fs.used += 1;
      }

      const request = fetch('/api/v1/rgs/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token, bet_amount: this.bet, buy_feature: buy })
      }).then(async (r) => ({ ok: r.ok, data: await r.json() }));

      let res;
      try {
        this.mech.beforeSpin(this, { inFs, buy });
        if (this.cascading) {
          const [resp] = await Promise.all([request, this.view.dropOut(this.quick)]);
          res = resp;
        } else {
            this.view.startSpin(this.quick);
          audio().startReelSpin();
          res = await request;
        }
      } catch (e) {
        res = { ok: false, data: { message: 'Connection error' } };
      }

      if (!res.ok) {
        audio().stopReelSpin();
        this.toast((res.data.message || 'Spin failed').toUpperCase(), 2600);
        if (!inFs) this.balance += cost;
        if (!this.cascading) {
          const cols = this.view.reels.map((_, c) => this.view.visible(c));
          await this.landReels(Array.from({ length: this.cfg.rows }, (_, rr) => cols.map((col) => col[rr])), null);
        }
        else await this.view.dropIn(this.mech.demoScreen(this), true);
        this.refreshMeters();
        this.busy = false;
        document.body.classList.remove('spinning');
        this.stopAuto();
        return;
      }

      const r = res.data;
      this.lastBet = r.bet;
      await this.mech.present(this, r);

      await this.afterSpin(r, { buy, inFs });
    }

    // ------------------------------------------------------------ reels (lines / ways)
    async landReels(finalMatrix, result, onLand = null) {
      const cols = this.cfg.reels;
      const trigger = this.cfg.free_spins ? this.cfg.free_spins.trigger : 99;
      const baseDelay = this.quick ? 120 : 380;
      const stagger = this.quick ? 60 : 170;
      await sleep(baseDelay);
      let scatters = 0;
      for (let c = 0; c < cols; c++) {
        const col = finalMatrix.map((row) => row[c]);
        const slam = this.skipRequested;
        const anticipate = !slam && result && scatters >= trigger - 1 && c < cols;
        if (anticipate) {
          this.view.anticipation.add(c);
          audio().playAnticipation();
          await sleep(this.quick ? 500 : 1100);
        } else if (c > 0 && !slam) {
          await sleep(stagger);
        }
        await this.view.stopReel(c, col);
        this.view.anticipation.delete(c);
        if (onLand) onLand(c);
        const hasScatter = col.includes('SCATTER');
        if (hasScatter) {
          scatters++;
          col.forEach((s, r) => { if (s === 'SCATTER') this.view.pops[`${r},${c}`] = this.view.time; });
          audio().playScatterLand(scatters);
        } else {
          audio().playReelStop(c);
        }
      }
      audio().stopReelSpin();
    }

    /** Default presentation for reel games (lines, ways): land, badges, highlight, count. */
    async presentReels(r) {
      await this.landReels(r.matrix, r);
      if (r.wild_multipliers) {
        for (const [k, m] of Object.entries(r.wild_multipliers)) this.view.badges[k] = `x${m}`;
      }
      this.highlightWins(r);
      await this.countSmallWin(r);
    }

    /** Highlights every winning position (and triggering scatters). Returns true if anything won. */
    highlightWins(r) {
      if (!(r.total_win > 0 || (r.scatter_win && r.scatter_win.count >= 3))) return false;
      const all = [];
      r.winning_lines.forEach((w) => all.push(...w.positions));
      if (r.scatter_win) all.push(...r.scatter_win.positions);
      this.view.setHighlight(all);
      return true;
    }

    /** Counts up wins below the big-win threshold (big wins get their own celebration). */
    async countSmallWin(r) {
      if (!(r.total_win > 0)) return;
      const x = r.total_win / r.bet;
      if (x >= 10) return;
      audio().playLineWin(Math.min(5, r.winning_lines.length));
      await this.countWin(r.total_win, x >= 3 ? 1100 : 500);
    }

    hideWinBannerLater(ms = 1400) {
      setTimeout(() => { if (!this.busy) this.hideWinBanner(); }, ms);
    }

    /**
     * Shared cascade loop (tumble, clusters, megaways, match lines): highlight a step's wins,
     * show the running win, explode, collapse into the next screen. Hooks customise each step:
     *   screens        'grid' (rows x cols) or 'reels' (columns, megaways) — which field holds a screen
     *   beforeHighlight(step) / onHighlight(step) / beforeExplode(step)
     *   floater(win) -> text        suffix(step) -> extra message text
     *   pause(step) -> ms           settle -> ms after a collapse
     *   afterExplode(step) (async)  afterCollapse(step, nextScreen) (async)
     * Returns the total cascade win.
     */
    async runCascades(r, hooks = {}) {
      const field = hooks.screens === 'reels' ? 'reels' : 'grid';
      const last = field === 'reels' ? r.final_reels : r.final_matrix;
      const steps = r.cascades || [];
      let running = 0;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step.wins.length) break;
        if (hooks.beforeHighlight) hooks.beforeHighlight(step);
        const pos = step.wins.flatMap((w) => w.positions);
        this.view.setHighlight(pos);
        if (hooks.onHighlight) hooks.onHighlight(step);
        audio().playLineWin(Math.min(5, step.wins.length));
        running += step.win;
        step.wins.forEach((w) => this.view.addFloater(w.positions, hooks.floater ? hooks.floater(w) : this.money.fmt(w.payout)));
        this.setMessage(`WIN <b>${this.money.fmt(running + (this.fs.active ? this.fs.total : 0))}</b>${hooks.suffix ? hooks.suffix(step) : ''}`, 'win');
        await sleep(this.skipRequested ? 150 : (this.quick ? 380 : (hooks.pause ? hooks.pause(step) : 700)));
        if (hooks.beforeExplode) hooks.beforeExplode(step);
        const color = (this.cfg.symbols[step.wins[0].symbol] || {}).color;
        audio().playExplode();
        await this.view.explode(pos, color);
        if (hooks.afterExplode) await hooks.afterExplode(step);
        const next = steps[i + 1] ? steps[i + 1][field] : last;
        await this.view.collapse(next, pos);
        if (hooks.afterCollapse) await hooks.afterCollapse(step, next);
        await sleep(this.quick ? 60 : (hooks.settle || 160));
      }
      return running;
    }

    /** End of a cascade spin: scatter sound + highlight, small-win count-up. */
    async finishCascades(r, finalScreen, defaultTrigger) {
      const sc = SlotKit.util.scatterCount(finalScreen);
      if (sc >= 3) audio().playScatterLand(sc);
      const trigger = this.cfg.free_spins ? this.cfg.free_spins.trigger : defaultTrigger;
      if (r.scatter_win && r.scatter_win.count >= trigger) this.view.setHighlight(r.scatter_win.positions);
      if (r.total_win > 0 && r.total_win / r.bet < 10) await this.countWin(r.total_win, 400);
      this.hideWinBannerLater();
    }

    startLineCycle(r) {
      const id = ++this.lineCycleId;
      const wins = r.winning_lines.slice();
      if (r.scatter_win && r.scatter_win.payout > 0) wins.push({ ...r.scatter_win, scatter: true });
      if (wins.length < 1 || this.cascading) return;
      let i = 0;
      const total = r.free_spins.is_free_spin ? r.free_spins.total_accumulated_win : r.total_win;
      const step = () => {
        if (id !== this.lineCycleId || this.busy) return;
        if (i > 0 && i % wins.length === 0) {
          this.setMessage(`WIN <b>${this.money.fmt(total)}</b>`, 'win');
          this.view.setHighlight(wins.flatMap((w) => w.positions));
          this.view.lineOverlay = null;
          i++;
          setTimeout(step, 1300);
          return;
        }
        this.hideWinBanner();
        const w = wins[i % wins.length];
        this.view.setHighlight(w.positions);
        if (w.giant_multipliers && w.giant_multipliers.length && this.view.pulseMultipliers) this.view.pulseMultipliers(w.giant_multipliers);
        const label = this.money.fmt(w.payout);
        this.view.lineOverlay = w.line_index
          ? { path: this.cfg.paylines[w.line_index - 1].map((row, c) => [row, c]), color: this.cfg.theme.accent, label, count: w.count }
          : { positions: w.positions, label };
        const name = (this.cfg.symbols[w.symbol] || {}).name || w.symbol;
        let text;
        if (w.scatter) text = `${w.count} × ${name} PAYS <b>${label}</b>`;
        else if (w.line_index) text = `LINE ${w.line_index} · ${w.count} × ${name} <b>${label}</b>`;
        else {
          const gm = (w.giant_multipliers || []).reduce((a, m) => a * m.multiplier, 1);
          text = `${w.count} × ${name} · ${w.ways} ${w.ways === 1 ? 'WAY' : 'WAYS'}${gm > 1 ? ` (x${gm} GIANTS)` : ''} <b>${label}</b>`;
        }
        if (wins.length > 1 || i === 0) this.setMessage(text, 'win small');
        i++;
        setTimeout(step, 1400);
      };
      setTimeout(step, 1100);
    }

    get cascading() {
      return this.mech.cascading;
    }

    // ------------------------------------------------------------ after spin
    async afterSpin(r, { buy, inFs }) {
      if (r.jackpots) {
        this.jackpots = r.jackpots;
        this.renderJackpots();
      }
      for (const w of r.jackpot_wins || []) await this.jackpotWin(w);
      const x = r.total_win / r.bet;
      if (x >= 10) {
        await this.bigWin(r.total_win, r.bet);
        this.showWinBanner(r.total_win);
      }
      if (r.total_win > 0) {
        this.setMessage(`WIN <b>${this.money.fmt(inFs ? r.free_spins.total_accumulated_win : r.total_win)}</b>`, 'win');
        this.startLineCycle(r);
      } else if (!inFs) {
        this.setMessage('PLACE YOUR BETS!');
      }
      if (r.max_win_reached) this.toast(`MAX WIN ${this.cfg.max_win_x}x REACHED!`, 3000);

      this.balance = r.balance;
      this.refreshMeters();

      const fsInfo = r.free_spins;
      if (inFs) {
        this.fs.total = fsInfo.total_accumulated_win;
        this.fs.left = fsInfo.remaining;
        if (fsInfo.awarded > 0) {
          audio().playFreeSpinsTrigger();
          this.toast(`+${fsInfo.awarded} FREE SPINS`, 2200);
          await sleep(900);
        }
        this.updateFsCounter();
      }

      this.busy = false;
      document.body.classList.remove('spinning');

      // Free spins triggered in the base game
      if (!inFs && fsInfo.remaining > 0) {
        this.stopAutoIf('feature');
        await sleep(this.quick ? 300 : 700);
        audio().playFreeSpinsTrigger();
        this.fs = { active: true, left: fsInfo.remaining, total: fsInfo.total_accumulated_win, totalMult: 0, used: 0 };
        this.fsBet = r.bet;
        if (this.view.setSpots) this.view.setSpots({}); // free spins start with a clean grid
        if (this.cfg.free_spins.persistent_multiplier) this.fs.totalMult = this.cfg.win_multiplier_rules ? this.cfg.win_multiplier_rules.fs.start : 1;
        const sticky = this.cfg.free_spins && this.cfg.free_spins.sticky_giants;
        await this.featureScreen({ kicker: 'CONGRATULATIONS!', line1: 'YOU HAVE WON', big: String(fsInfo.remaining), line2: sticky ? `FREE SPINS · STICKY GIANTS ${this.multRangeText()}` : 'FREE SPINS', btn: 'PRESS TO START', auto: this.auto.left > 0 });
        this.enterFreeSpinsUi();
        return this.runFreeSpins();
      }

      // Free spins finished
      if (inFs && fsInfo.remaining === 0) {
        await sleep(600);
        const total = this.fs.total;
        this.exitFreeSpinsUi();
        if (this.view.clearSticky) this.view.clearSticky();
        if (this.view.setSpots) this.view.setSpots({});
        await this.featureScreen({ kicker: 'CONGRATULATIONS!', line1: 'YOU HAVE WON', big: this.money.fmt(total), line2: `IN ${this.fs.used} FREE SPINS`, btn: 'CONTINUE', auto: true, money: true });
        this.fs = { active: false, left: 0, total: 0, totalMult: 0 };
        this.baseMult = null;
        this.updateMultPlate();
        this.setMessage(total > 0 ? `WIN <b>${this.money.fmt(total)}</b>` : 'PLACE YOUR BETS!', total > 0 ? 'win' : '');
        this.refreshMeters();
        return this.continueAuto(r);
      }

      if (inFs) return this.runFreeSpins();
      return this.continueAuto(r);
    }

    stopAutoIf(reason) {
      if (reason === 'feature' && this.auto.stopOnFeature) this.stopAuto();
    }

    async continueAuto(r) {
      if (this.auto.left <= 0) return;
      this.auto.left -= 1;
      this.updateAutoBadge();
      if (this.auto.stopOnWin && r.total_win > 0) return this.stopAuto();
      if (this.auto.limitX && r.total_win >= this.auto.limitX * r.bet) return this.stopAuto();
      if (this.auto.left <= 0) return this.stopAuto();
      await sleep(this.quick ? 250 : (r.total_win > 0 ? 1100 : 450));
      if (this.auto.left > 0 && !this.busy) this.spin();
    }

    async runFreeSpins() {
      if (!this.fs.active || this.fs.left <= 0) return;
      await sleep(this.quick ? 250 : 550);
      if (!this.busy) this.spin();
    }

    enterFreeSpinsUi() {
      if (this.fs.used === undefined) this.fs.used = 0;
      $('app').classList.add('fs-mode');
      this.updateFsCounter();
      this.updateMultPlate();
      this.refreshMeters();
      this.bgfx.boost = 1;
    }

    exitFreeSpinsUi() {
      $('app').classList.remove('fs-mode');
      $('multPlate').hidden = true;
      $('fsCounter').classList.remove('show');
      this.updateAutoBadge();
    }

    updateFsCounter() {
      $('fsCounterValue').textContent = this.fs.left;
      $('fsCounter').classList.toggle('show', this.fs.active);
      this.updateAutoBadge();
    }

    updateMultPlate() {
      const persistent = this.cfg.free_spins && this.cfg.free_spins.persistent_multiplier;
      const always = this.mech.alwaysShowMultiplier;
      const show = always || (this.fs.active && ((this.cfg.multipliers && this.cfg.multipliers.mode === 'accumulate') || persistent));
      $('multPlate').hidden = !show;
      const lbl = $('multPlate').querySelector('.info-small');
      if (lbl) lbl.textContent = persistent || always ? 'WIN MULTIPLIER' : 'TOTAL MULTIPLIER';
      if (always && !this.fs.active) {
        const rules = this.cfg.win_multiplier_rules || { base: { start: 1 } };
        $('multPlateValue').textContent = `x${this.baseMult || rules.base.start}`;
        return;
      }
      if (show) $('multPlateValue').textContent = this.fs.totalMult ? `x${this.fs.totalMult}` : '—';
    }

    // ================================================================ presentation
    showWinBanner(amount, sub = '', label = 'WIN') {
      $('winBannerLabel').textContent = label;
      $('winBannerAmount').textContent = this.money.fmt(amount);
      $('winBannerSub').textContent = sub;
      $('winBanner').classList.add('show');
    }

    hideWinBanner() {
      $('winBanner').classList.remove('show');
    }

    countWin(amount, ms) {
      return new Promise((resolve) => {
        const start = performance.now();
        const el = $('winBannerAmount');
        $('winBannerLabel').textContent = 'WIN';
        $('winBanner').classList.add('show');
        const tick = (t) => {
          const k = this.skipRequested ? 1 : Math.min(1, (t - start) / ms);
          el.textContent = this.money.fmt(Math.floor(amount * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }

    async bigWin(amount, bet) {
      this.skipRequested = false;
      const el = $('bigWin');
      const title = $('bigWinTitle');
      const amt = $('bigWinAmount');
      el.classList.add('open');
      this.coins.start(40);
      audio().playBigWin();
      const x = amount / bet;
      const duration = Math.min(9000, 2500 + Math.log10(x) * 2500);
      const start = performance.now();
      let tier = null;
      await new Promise((resolve) => {
        const tick = (t) => {
          const k = this.skipRequested ? 1 : Math.min(1, (t - start) / duration);
          const cur = amount * k;
          const curTier = WIN_TIERS.find((w) => cur / bet >= w.x) || WIN_TIERS[WIN_TIERS.length - 1];
          if (curTier !== tier) {
            tier = curTier;
            title.textContent = tier.label;
            title.classList.remove('bump');
            void title.offsetWidth;
            title.classList.add('bump');
            this.coins.burst(40);
            this.coins.rate = 40 + (4 - WIN_TIERS.indexOf(tier)) * 25;
            if (cur > 0) audio().playTierUp();
          }
          amt.textContent = this.money.fmt(Math.floor(cur));
          if (Math.random() < 0.3) audio().playTick();
          if (k < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      amt.textContent = this.money.fmt(amount);
      this.skipRequested = false;
      let iv;
      await Promise.race([
        sleep(this.auto.left > 0 || this.fs.active ? 1500 : 2600),
        new Promise((r) => { iv = setInterval(() => { if (this.skipRequested) r(); }, 50); })
      ]);
      clearInterval(iv);
      this.coins.stop();
      el.classList.remove('open');
      this.skipRequested = false;
    }

    featureScreen({ kicker, line1, big, line2, btn, auto = false }) {
      return new Promise((resolve) => {
        $('featureKicker').textContent = kicker;
        $('featureLine1').textContent = line1;
        $('featureBig').textContent = big;
        $('featureLine2').textContent = line2;
        $('featureBtn').textContent = btn;
        const scr = $('featureScreen');
        this.hideWinBanner();
        scr.classList.add('open');
        this.coins.start(20);
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          scr.classList.remove('open');
          this.coins.stop();
          audio().playSpinClick();
          resolve();
        };
        $('featureBtn').onclick = finish;
        if (auto) setTimeout(finish, 3500);
      });
    }

    // ================================================================ info / paytable
    buildInfo() {
      if (!this.cfg) return;
      const cfg = this.cfg;
      const bet = this.fs.active ? (this.fsBet || this.bet) : this.bet;
      const m = this.money;
      const mech = this.mech;
      const unit = mech.payUnit(cfg, bet);
      const body = $('infoBody');
      $('infoTitle').textContent = cfg.name.toUpperCase();
      const rows = [];
      const order = Object.keys(cfg.symbols);
      for (const id of order) {
        const sym = cfg.symbols[id];
        if (id === 'MULT') continue;
        const pays = cfg.paytable[id];
        if (!pays && !sym.isWild) continue;
        const iconSrc = sym.icon_file ? `/games/assets/icons/${sym.icon_file}` : null;
        const pic = this.art ? this.art.get(id).toDataURL() : iconSrc;
        const payLines = pays
          ? mech.payRows(cfg, id, pays).map(([label, v]) => `<div class="pay-row"><span>${label}</span><b>${m.fmt(Math.floor((id === 'SCATTER' ? bet : unit) * v))}</b></div>`).join('')
          : '<div class="pay-row"><span>SUBSTITUTES</span></div>';
        rows.push(`<div class="pay-card ${sym.isWild ? 'special' : ''} ${sym.isScatter ? 'special' : ''}"><img src="${pic}" alt=""><div class="pay-list"><div class="pay-name">${sym.name}</div>${payLines}</div></div>`);
      }

      const fs = cfg.free_spins;
      const feat = [];
      feat.push(...mech.rules(cfg, { bet, fmt: (v) => m.fmt(v) }));
      if (cfg.symbols.WILD && mech.wildRule) feat.push(mech.wildRule);
      if (fs && fs.trigger) {
        const spins = typeof fs.spins === 'object' ? Object.entries(fs.spins).map(([k, v]) => `${k} scatters = ${v} spins`).join(', ') : `${fs.spins} free spins`;
        feat.push(`<p><b>FREE SPINS:</b> ${fs.trigger} or more SCATTERS anywhere trigger the feature (${spins}). ${fs.retrigger_spins ? `${fs.retrigger_min}+ scatters during the feature award +${fs.retrigger_spins} spins.` : ''} ${fs.win_multiplier > 1 ? `All free spins wins are multiplied by <b>x${fs.win_multiplier}</b>.` : ''} ${fs.wild_multipliers ? `During free spins every WILD carries a random <b>x${fs.wild_multipliers.join(' / x')}</b> multiplier; multipliers of wilds in one way are multiplied together.` : ''}</p>`);
        if (fs.sticky_giants) {
          const by = fs.sticky_multipliers_by_symbol || {};
          const list = (vals) => (vals.length > 3 ? `from <b>x${vals[0]}</b> to <b>x${vals[vals.length - 1]}</b> (${vals.map((v) => `x${v}`).join(', ')})` : vals.map((v) => `<b>x${v}</b>`).join(' or '));
          const per = Object.keys(by).length
            ? Object.entries(by).map(([id, vals]) => `${(cfg.symbols[id] || {}).name || id}: ${list(vals)}`).join('; ')
            : list(fs.sticky_multipliers || []);
          feat.push(`<p><b>STICKY GIANTS:</b> during free spins every giant symbol that lands <b>fully visible</b> (its whole height on the screen) becomes <b>sticky</b> until the end of the feature and gets a random multiplier — ${per}. Giants that land only partly on the screen pay normally but do not stick. Every way that goes through a multiplier giant is multiplied by it; several giant multipliers in one way multiply together.</p>`);
        }
        if (fs.buy_cost && mech.genericBuyRule) feat.push(`<p><b>BUY FREE SPINS:</b> the feature can be bought instantly for ${fs.buy_cost}x total bet (${this.money.fmt(bet * fs.buy_cost)}).</p>`);
      }
      if (cfg.multipliers) {
        const mm = cfg.multipliers;
        feat.push(`<p><b>MULTIPLIERS:</b> multiplier symbols (x${mm.values[0]} – x${mm.values[mm.values.length - 1]}) ${mm.in_base_game ? 'can land on any spin' : 'land only during free spins'}. When a tumble sequence ends with a win, all multipliers on screen are added together and the total win of the sequence is multiplied by that value.${mm.mode === 'accumulate' ? ' In FREE SPINS every multiplier that hits is added to a <b>TOTAL MULTIPLIER</b> that applies to all later wins of the feature.' : ''}</p>`);
      }
      feat.push(`<p>Maximum win is capped at <b>${Number(cfg.max_win_x).toLocaleString()}x</b> the bet. If reached, the round ends immediately.</p>`);
      feat.push(`<p class="muted">Theoretical RTP: <b>${cfg.rtp}</b> · Volatility: ${String(cfg.volatility || '').toUpperCase()}. Malfunction voids all pays and plays. Social casino game — credits have no cash value.</p>`);

      let linesHtml = '';
      if (cfg.paylines) {
        linesHtml = `<h3>PAYLINES</h3><div class="lines-grid">${cfg.paylines.map((pat, i) => `<div class="line-mini" style="--cols:${cfg.reels};--rows:${cfg.rows}">${Array.from({ length: cfg.rows * cfg.reels }, (_, k) => {
          const r = Math.floor(k / cfg.reels);
          const c = k % cfg.reels;
          return `<i class="${pat[c] === r ? 'on' : ''}"></i>`;
        }).join('')}<span>${i + 1}</span></div>`).join('')}</div>`;
      }

      body.innerHTML = `<p class="muted center">Values shown for the current bet of <b>${m.fmt(bet)}</b></p><div class="pay-grid">${rows.join('')}</div><h3>GAME RULES</h3>${feat.join('')}${linesHtml}<p class="muted center small">Symbol graphics: Twemoji © Twitter/X & contributors, CC-BY 4.0</p>`;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new SlotGame();
    window.slotGame = game;
    game.boot();
  });
})();
