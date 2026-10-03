/* SpinKit Back Office — vanilla JS single page app (hash routing). */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  };

  const state = { meta: null, admin: null, scope: store.get('sk_scope', '') };

  // ------------------------------------------------------------------ api
  async function api(method, url, body) {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (res.status === 401 && !url.endsWith('/login') && !url.endsWith('/password')) {
      showLogin();
      throw new Error('Please log in');
    }
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }
  const GET = (u) => api('GET', u);
  const POST = (u, b = {}) => api('POST', u, b);
  const PATCH = (u, b) => api('PATCH', u, b);
  const DEL = (u) => api('DELETE', u);

  // ------------------------------------------------------------------ helpers
  function curInfo(merchantId) {
    const m = state.meta && state.meta.merchants.find((x) => String(x.id) === String(merchantId));
    return m ? m.currency_info : { code: 'USD', symbol: '$', decimals: 2 };
  }
  function money(minor, info) {
    if (minor == null) return '—';
    const i = info || { symbol: '$', decimals: 2 };
    const v = Number(minor) / Math.pow(10, i.decimals);
    return `${v < 0 ? '−' : ''}${i.symbol}${Math.abs(v).toLocaleString('en', { minimumFractionDigits: i.decimals, maximumFractionDigits: i.decimals })}`;
  }
  const toMinor = (major, info) => Math.round(Number(major) * Math.pow(10, (info || { decimals: 2 }).decimals));
  const toMajor = (minor, info) => (minor == null ? '' : Number(minor) / Math.pow(10, (info || { decimals: 2 }).decimals));
  const pct = (v, d = 2) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
  const n = (v) => Number(v || 0).toLocaleString('en');
  const date = (s) => (s ? String(s).replace('T', ' ').slice(0, 19) : '—');
  const scopeQ = () => (state.scope ? `merchant_id=${state.scope}` : '');

  function toast(msg, error = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show${error ? ' error' : ''}`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.className = 'toast'; }, 3200);
  }

  function modal(html, { wide = false } = {}) {
    const card = $('#modalCard');
    card.className = `modal-card${wide ? ' wide' : ''}`;
    card.innerHTML = html;
    $('#modal').classList.add('open');
    $$('[data-close]', card).forEach((b) => b.addEventListener('click', closeModal));
    return card;
  }
  function closeModal() { $('#modal').classList.remove('open'); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  const guard = (fn) => async (...a) => {
    try { await fn(...a); } catch (e) { toast(e.message, true); }
  };

  function copyBtn(text) {
    return `<button class="btn small" data-copy="${esc(text)}">Copy</button>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (b) {
      navigator.clipboard.writeText(b.dataset.copy).then(() => toast('Copied'), () => toast('Copy failed', true));
    }
  });

  function table(cols, rows, { empty = 'Nothing here yet', rowAttr = () => '' } = {}) {
    if (!rows.length) return `<div class="card empty">${empty}</div>`;
    return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${c.h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr ${rowAttr(r)}>${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.v(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function statusBadge(s) {
    return s === 'active' ? '<span class="badge green">active</span>' : `<span class="badge red">${esc(s)}</span>`;
  }

  // ------------------------------------------------------------------ chart
  function chart(daily, info) {
    if (!daily.length) return '<div class="empty">No rounds in this period</div>';
    const W = 900;
    const H = 220;
    const P = 28;
    const max = Math.max(1, ...daily.map((d) => Math.max(d.bets || 0, d.wins || 0)));
    const minG = Math.min(0, ...daily.map((d) => d.ggr || 0));
    const bw = (W - P * 2) / daily.length;
    const y = (v) => H - P - ((v - Math.min(0, minG)) / (max - Math.min(0, minG))) * (H - P * 2);
    let bars = '';
    daily.forEach((d, i) => {
      const x = P + i * bw;
      const w = Math.max(3, bw * 0.34);
      bars += `<rect x="${x + bw * 0.12}" y="${y(d.bets)}" width="${w}" height="${Math.max(1, y(0) - y(d.bets))}" rx="2" fill="#3d9bff"><title>${d.day} bets ${money(d.bets, info)}</title></rect>`;
      bars += `<rect x="${x + bw * 0.12 + w + 2}" y="${y(d.wins)}" width="${w}" height="${Math.max(1, y(0) - y(d.wins))}" rx="2" fill="#7c5cff"><title>${d.day} wins ${money(d.wins, info)}</title></rect>`;
      if (daily.length <= 16 || i % Math.ceil(daily.length / 12) === 0) bars += `<text x="${x + bw / 2}" y="${H - 8}" fill="#8a94a8" font-size="10" text-anchor="middle">${d.day.slice(5)}</text>`;
    });
    const pts = daily.map((d, i) => `${P + i * bw + bw / 2},${y(d.ggr)}`).join(' ');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" stroke="#232b3d"/>${bars}
      <polyline points="${pts}" fill="none" stroke="#f5b83d" stroke-width="2.5"/>
      ${daily.map((d, i) => `<circle cx="${P + i * bw + bw / 2}" cy="${y(d.ggr)}" r="3" fill="#f5b83d"><title>${d.day} GGR ${money(d.ggr, info)}</title></circle>`).join('')}
    </svg><div class="legend"><span><i style="background:#3d9bff"></i>Bets</span><span><i style="background:#7c5cff"></i>Wins</span><span><i style="background:#f5b83d"></i>GGR</span></div></div>`;
  }

  // ================================================================== pages
  const pages = {};

  // ------------------------------------------------------------------ dashboard
  pages.dashboard = async (el) => {
    const days = Number(store.get('sk_days', 14));
    const d = await GET(`/api/admin/dashboard?days=${days}&${scopeQ()}`);
    const merchantsInScope = state.scope ? state.meta.merchants.filter((m) => String(m.id) === state.scope) : state.meta.merchants;
    const currencies = [...new Set(merchantsInScope.map((m) => m.currency))];
    const mixed = currencies.length > 1;
    const info = state.scope ? curInfo(state.scope) : (mixed ? { symbol: '', decimals: 2 } : merchantsInScope[0] && merchantsInScope[0].currency_info);
    const t = d.totals;
    el.innerHTML = `
      <div class="row between"><div class="pill-select" id="days">${[1, 7, 14, 30, 90].map((x) => `<button data-d="${x}" class="${x === days ? 'on' : ''}">${x === 1 ? '24h' : x + 'd'}</button>`).join('')}</div>
        ${mixed ? '<span class="muted small">Several currencies — totals are in raw units. Pick a merchant at the top for exact money.</span>' : ''}</div>
      <div class="grid kpis section">
        ${kpi('Bets', money(t.bets, info), `${n(t.rounds)} rounds`)}
        ${kpi('Wins', money(t.wins, info), `incl. jackpots ${money(t.jackpot_wins, info)}`)}
        ${kpi('GGR', `<span class="${t.ggr >= 0 ? 'pos' : 'neg'}">${money(t.ggr, info)}</span>`, 'bets − wins')}
        ${kpi('Actual RTP', pct(t.rtp_actual), 'wins / bets')}
        ${kpi('Players', n(t.players), `${n(t.feature_buys)} feature buys`)}
        ${kpi('Online now', n(d.live.players_online), `${n(d.live.active_sessions)} active sessions`)}
      </div>
      <div class="grid cols-2 section">
        <div class="card"><h3>Daily bets / wins / GGR</h3>${chart(d.daily, info)}</div>
        <div class="card"><h3>Top games</h3>${table([
          { h: 'Game', v: (r) => esc(r.name) },
          { h: 'Rounds', num: 1, v: (r) => n(r.rounds) },
          { h: 'Bets', num: 1, v: (r) => money(r.bets, info) },
          { h: 'GGR', num: 1, v: (r) => `<span class="${r.ggr >= 0 ? 'pos' : 'neg'}">${money(r.ggr, info)}</span>` },
          { h: 'RTP', num: 1, v: (r) => pct(r.rtp_actual, 1) }
        ], d.top_games, { empty: 'No rounds yet' })}</div>
      </div>
      ${d.merchants ? `<div class="section"><h3>Merchants</h3>${table([
        { h: 'Merchant', v: (r) => `<a href="#/merchants/${r.id}">${esc(r.name)}</a> <span class="muted small">${esc(r.code)}</span>` },
        { h: 'Status', v: (r) => statusBadge(r.status) },
        { h: 'Rounds', num: 1, v: (r) => n(r.rounds) },
        { h: 'Players', num: 1, v: (r) => n(r.players) },
        { h: 'Bets', num: 1, v: (r) => money(r.bets, curInfo(r.id)) },
        { h: 'Wins', num: 1, v: (r) => money(r.wins, curInfo(r.id)) },
        { h: 'GGR', num: 1, v: (r) => `<span class="${r.ggr >= 0 ? 'pos' : 'neg'}">${money(r.ggr, curInfo(r.id))}</span>` },
        { h: 'Float', num: 1, v: (r) => (r.float_unlimited ? '∞' : money(r.float_balance, curInfo(r.id))) }
      ], d.merchants)}</div>` : ''}
      <div class="section"><h3>Latest jackpot wins</h3>${table([
        { h: 'Time', v: (r) => date(r.created_at) },
        { h: 'Merchant', v: (r) => esc(r.merchant_code) },
        { h: 'Tier', v: (r) => `<span class="badge gold">${esc(r.tier.toUpperCase())}</span>` },
        { h: 'Player', v: (r) => esc(r.external_id) },
        { h: 'Game', v: (r) => esc(r.game_id) },
        { h: 'Amount', num: 1, v: (r) => money(r.amount, curInfo(r.merchant_id)) }
      ], d.jackpot_wins, { empty: 'No jackpot has dropped yet' })}</div>`;
    $$('#days button', el).forEach((b) => b.addEventListener('click', () => { store.set('sk_days', b.dataset.d); route(); }));
  };
  const kpi = (label, value, sub) => `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub || ''}</div></div>`;

  // ------------------------------------------------------------------ merchants list
  pages.merchants = async (el, args) => {
    if (args[0]) return merchantDetail(el, Number(args[0]), args[1] || 'general');
    const { merchants } = await GET('/api/admin/merchants');
    el.innerHTML = `
      <div class="row between"><p class="muted">Each merchant (casino) has its own API tokens, currency, float balance, players, limits, RTP and jackpots.</p>
        <button class="btn primary" id="newMerchant">+ New merchant</button></div>
      <div class="section">${table([
        { h: 'ID', v: (r) => r.id },
        { h: 'Merchant', v: (r) => `<b>${esc(r.name)}</b><div class="muted small">${esc(r.code)}</div>` },
        { h: 'Status', v: (r) => statusBadge(r.status) },
        { h: 'Currency', v: (r) => esc(r.currency) },
        { h: 'Float', num: 1, v: (r) => (r.float_unlimited ? '<span class="badge purple">unlimited</span>' : money(r.float_balance, curInfo(r.id))) },
        { h: 'RTP', v: (r) => `${r.rtp_profile}%` },
        { h: 'Bet limits', v: (r) => (r.min_bet || r.max_bet ? `${r.min_bet ? money(r.min_bet, curInfo(r.id)) : '—'} … ${r.max_bet ? money(r.max_bet, curInfo(r.id)) : '—'}` : '<span class="muted">default</span>') },
        { h: 'Jackpots', v: (r) => (r.jackpot_enabled ? '<span class="badge gold">on</span>' : '<span class="badge">off</span>') },
        { h: 'IP whitelist', v: (r) => (r.ip_whitelist.length ? `${r.ip_whitelist.length} rules` : '<span class="badge red">any IP</span>') },
        { h: 'Players', num: 1, v: (r) => n(r.players) },
        { h: 'Tokens', num: 1, v: (r) => n(r.tokens) }
      ], merchants, { rowAttr: (r) => `class="click" data-go="#/merchants/${r.id}"` })}</div>`;
    $$('[data-go]', el).forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.go; }));
    $('#newMerchant').addEventListener('click', newMerchantModal);
  };

  function newMerchantModal() {
    const card = modal(`
      <div class="modal-head"><h2>New merchant</h2><button class="btn ghost" data-close>✕</button></div>
      <form id="nm" class="form-grid">
        <label>Code (slug)<input name="code" placeholder="lucky-casino" required pattern="[a-z0-9_-]{2,32}"></label>
        <label>Name<input name="name" placeholder="Lucky Casino" required></label>
        <label>Currency<input name="currency" value="USD" minlength="2" maxlength="8" placeholder="e.g. EU, US, RU, USD, GC" required></label>
        <label>RTP profile<select name="rtp_profile">${state.meta.rtp_profiles.map((p) => `<option ${p === 96 ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label>Starting float (major units)<input name="float" type="number" min="0" step="0.01" value="10000"></label>
        <label class="check" style="align-self:end"><input type="checkbox" name="float_unlimited">Unlimited float (social / demo)</label>
        <label class="check" style="align-self:end"><input type="checkbox" name="jackpot_enabled" checked>Jackpots enabled</label>
      </form>
      <div class="row section"><span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="nmSave">Create merchant</button></div>`);
    $('#nmSave', card).addEventListener('click', guard(async () => {
      const f = Object.fromEntries(new FormData($('#nm', card)));
      const cur = f.currency.toUpperCase();
      const r = await POST('/api/admin/merchants', {
        code: f.code, name: f.name, currency: cur, rtp_profile: Number(f.rtp_profile),
        float_unlimited: !!f.float_unlimited, jackpot_enabled: !!f.jackpot_enabled, float_balance: Math.round(Number(f.float || 0) * 100)
      });
      await loadMeta();
      showSecret('Merchant created — API token', r.token.token, `Merchant #${r.merchant.id} ${r.merchant.code}. This is the only time the token is shown.`, `#/merchants/${r.merchant.id}/integration`);
    }));
  }

  function showSecret(title, secret, note, goto) {
    const card = modal(`
      <div class="modal-head"><h2>${esc(title)}</h2></div>
      <p class="muted">${esc(note)}</p>
      <div class="secret"><code>${esc(secret)}</code>${copyBtn(secret)}</div>
      <div class="row section"><span class="spacer"></span><button class="btn primary" id="done">I saved it</button></div>`);
    $('#done', card).addEventListener('click', () => { closeModal(); if (goto) location.hash = goto; else route(); });
  }

  // ------------------------------------------------------------------ merchant detail
  const MTABS = [['general', 'General'], ['limits', 'Limits & RTP'], ['games', 'Games'], ['jackpots', 'Jackpots'], ['security', 'Security & IP'], ['tokens', 'API tokens'], ['float', 'Float'], ['integration', 'Integration']];

  async function merchantDetail(el, id, tab) {
    const d = await GET(`/api/admin/merchants/${id}`);
    const m = d.merchant;
    const info = m.currency_info;
    $('#pageTitle').textContent = `${m.name}`;
    el.innerHTML = `
      <div class="row between"><div class="row"><a href="#/merchants" class="btn ghost small">← Merchants</a>${statusBadge(m.status)}<span class="muted">#${m.id} · ${esc(m.code)} · ${esc(m.currency)}</span></div>
        <div class="row muted small">30d: bets <b>${money(d.stats.bets, info)}</b> · GGR <b class="${d.stats.ggr >= 0 ? 'pos' : 'neg'}">${money(d.stats.ggr, info)}</b> · ${n(d.stats.rounds)} rounds</div></div>
      <div class="tabs section">${MTABS.map(([k, v]) => `<a href="#/merchants/${id}/${k}" class="${k === tab ? 'active' : ''}">${v}</a>`).join('')}</div>
      <div id="tab"></div>`;
    const t = $('#tab', el);
    const save = (patch, msg = 'Saved') => guard(async () => { await PATCH(`/api/admin/merchants/${id}`, patch()); await loadMeta(); toast(msg); route(); });

    if (tab === 'general') {
      t.innerHTML = `<div class="card"><div class="form-grid">
          <label>Name<input id="f_name" value="${esc(m.name)}"></label>
          <label>Status<select id="f_status"><option ${m.status === 'active' ? 'selected' : ''}>active</option><option ${m.status === 'suspended' ? 'selected' : ''}>suspended</option></select></label>
          <label>Currency<input id="f_currency" value="${esc(m.currency)}" minlength="2" maxlength="8" placeholder="e.g. EU, US, RU, USD, GC"></label>
          <label>Lobby URL (in-game "back to lobby")<input id="f_lobby" value="${esc(m.lobby_url || '')}" placeholder="https://casino.example/lobby"></label>
          <label>Game language<select id="f_lang"><option value="">Player's browser language</option>${(state.meta.langs || []).map((l) => `<option value="${l}" ${m.default_lang === l ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}</select></label>
        </div>
        <div class="form-grid section">
          <label class="check"><input type="checkbox" id="f_demo" ${m.demo_refill ? 'checked' : ''}>Free credits button in games (social / demo casinos)</label>
        </div>
        <label class="section">Notes<textarea id="f_notes">${esc(m.notes || '')}</textarea></label>
        <div class="row section"><span class="spacer"></span><button class="btn primary" id="saveGen">Save</button></div></div>
        ${m.status === 'suspended' ? '<div class="hint danger-box section">Suspended merchants cannot call the API and their players cannot play.</div>' : ''}`;
      $('#saveGen').addEventListener('click', save(() => ({ name: $('#f_name').value, status: $('#f_status').value, currency: $('#f_currency').value, lobby_url: $('#f_lobby').value, default_lang: $('#f_lang').value || null, demo_refill: $('#f_demo').checked, notes: $('#f_notes').value })));
    }

    if (tab === 'limits') {
      t.innerHTML = `<div class="card"><div class="form-grid">
          <label>Default RTP profile<select id="f_rtp">${state.meta.rtp_profiles.map((p) => `<option value="${p}" ${p === m.rtp_profile ? 'selected' : ''}>${p}%${p === 96 ? ' (certified)' : ''}</option>`).join('')}</select></label>
          <label>Min bet (${esc(info.symbol)})<input id="f_min" type="number" step="0.01" min="0" value="${toMajor(m.min_bet, info)}" placeholder="no limit"></label>
          <label>Max bet (${esc(info.symbol)})<input id="f_max" type="number" step="0.01" min="0" value="${toMajor(m.max_bet, info)}" placeholder="no limit"></label>
          <label>Max win cap (x bet)<input id="f_maxwin" type="number" min="10" value="${m.max_win_x || ''}" placeholder="game default"></label>
        </div>
        <div class="hint section">RTP profiles scale every pay of the certified paytable, the reels stay identical. The selected RTP is shown to players in the game rules. Per-game overrides are on the <a href="#/merchants/${id}/games">Games</a> tab. Bets outside the limits are removed from the game's bet ladder.</div>
        <div class="row section"><span class="spacer"></span><button class="btn primary" id="saveLim">Save</button></div></div>`;
      $('#saveLim').addEventListener('click', save(() => ({
        rtp_profile: Number($('#f_rtp').value),
        min_bet: $('#f_min').value ? toMinor($('#f_min').value, info) : null,
        max_bet: $('#f_max').value ? toMinor($('#f_max').value, info) : null,
        max_win_x: $('#f_maxwin').value ? Number($('#f_maxwin').value) : null
      })));
    }

    if (tab === 'games') {
      const { games } = await GET(`/api/admin/merchants/${id}/games`);
      const cols = state.meta.collections || [{ id: 'artwork', name: 'With artwork' }, { id: 'basic', name: 'Basic (no artwork)' }];
      const colName = Object.fromEntries(cols.map((c) => [c.id, c.name]));
      const f = { q: store.get('sk_gq', ''), col: store.get('sk_gcol', ''), mech: store.get('sk_gmech', ''), cat: store.get('sk_gcat', '') };
      const uniq = (k) => [...new Set(games.map((g) => g[k]))].sort();
      t.innerHTML = `
        <div class="grid cols-2" id="gcols"></div>
        <div class="row section">
          <div class="seg" id="gseg">${[['', 'All'], ...cols.map((c) => [c.id, c.name])].map(([v, l]) => `<button class="btn small ${f.col === v ? 'primary' : ''}" data-col="${v}">${esc(l)}</button>`).join('')}</div>
          <select id="gmech"><option value="">All mechanics</option>${uniq('mechanic').map((v) => `<option ${v === f.mech ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
          <select id="gcat"><option value="">All themes</option>${uniq('category').map((v) => `<option ${v === f.cat ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
          <input id="gq" placeholder="Search games…" value="${esc(f.q)}" style="min-width:200px">
          <span class="spacer"></span>
          <span class="muted small" id="gcount"></span>
          <button class="btn small" id="shownOn">Enable shown</button><button class="btn small" id="shownOff">Disable shown</button>
          <select id="shownRtp"><option value="">Set RTP for shown…</option><option value="null">Merchant default</option>${state.meta.rtp_profiles.map((p) => `<option>${p}</option>`).join('')}</select>
        </div>
        <div class="section" id="gt"></div>`;
      const bulk = (patch) => guard(async () => {
        const r = await PATCH(`/api/admin/merchants/${id}/games/*`, patch);
        toast(`Updated ${r.game.updated} game(s)`);
        route();
      });
      // one card per collection: counts + enable / disable the whole collection
      $('#gcols').innerHTML = cols.map((c) => {
        const list = games.filter((g) => g.collection === c.id);
        const on = list.filter((g) => g.enabled).length;
        return `<div class="card"><h3>${esc(c.name)}</h3>
          <div class="muted small">${esc(c.hint || '')}</div>
          <div class="row section"><span class="badge ${on ? 'green' : ''}">${on} / ${list.length} enabled</span><span class="spacer"></span>
            <button class="btn small" data-colon="${c.id}">Enable all</button><button class="btn small" data-coloff="${c.id}">Disable all</button></div></div>`;
      }).join('');
      $$('[data-colon]').forEach((b) => b.addEventListener('click', bulk({ enabled: true, filter: { collection: b.dataset.colon } })));
      $$('[data-coloff]').forEach((b) => b.addEventListener('click', bulk({ enabled: false, filter: { collection: b.dataset.coloff } })));

      let shown = [];
      const render = () => {
        f.q = $('#gq').value.toLowerCase();
        f.mech = $('#gmech').value;
        f.cat = $('#gcat').value;
        store.set('sk_gq', f.q); store.set('sk_gcol', f.col); store.set('sk_gmech', f.mech); store.set('sk_gcat', f.cat);
        shown = games.filter((g) => (!f.col || g.collection === f.col) && (!f.mech || g.mechanic === f.mech) && (!f.cat || g.category === f.cat) &&
          (!f.q || g.name.toLowerCase().includes(f.q) || g.game_id.includes(f.q)));
        $('#gcount').textContent = `${shown.length} shown · ${shown.filter((g) => g.enabled).length} enabled`;
        const columns = [
          { h: 'On', v: (g) => `<input type="checkbox" data-en="${g.game_id}" ${g.enabled ? 'checked' : ''}>` },
          { h: 'Game', v: (g) => `<b>${esc(g.name)}</b><div class="muted small">${esc(g.game_id)}${g.skin_of ? ` · skin of ${esc(g.skin_of)}` : ''}</div>` },
          { h: 'Mechanic', v: (g) => esc(g.mechanic) },
          { h: 'Theme', v: (g) => esc(g.category) },
          { h: 'RTP', v: (g) => `<select data-rtp="${g.game_id}"><option value="">default (${m.rtp_profile}%)</option>${state.meta.rtp_profiles.map((p) => `<option ${g.rtp_profile === p ? 'selected' : ''}>${p}</option>`).join('')}</select>` },
          { h: 'Effective RTP', v: (g) => `<span class="badge ${g.effective.rtp_profile < 96 ? 'gold' : 'green'}">${esc(g.effective.rtp)}</span>` },
          { h: `Min bet ${esc(info.symbol)}`, v: (g) => `<input data-min="${g.game_id}" type="number" step="0.01" style="width:90px" value="${toMajor(g.min_bet, info)}" placeholder="—">` },
          { h: `Max bet ${esc(info.symbol)}`, v: (g) => `<input data-max="${g.game_id}" type="number" step="0.01" style="width:90px" value="${toMajor(g.max_bet, info)}" placeholder="—">` },
          { h: 'Bet range', v: (g) => `${money(g.effective.min_bet, info)} – ${money(g.effective.max_bet, info)}${g.bet_ladder && g.bet_ladder.limit > g.effective.max_bet ? `<div class="muted small">ladder up to ${money(g.bet_ladder.limit, info)}</div>` : ''}` },
          { h: 'Options', v: (g) => Object.entries(g.option_schema || {}).map(([k, d]) => `<label class="small" title="${esc(d.hint || '')}">${esc(d.label)}<input data-opt="${g.game_id}" data-key="${k}" type="number" min="${d.min}" max="${d.max}" step="1" style="width:70px;margin-left:6px" value="${g.options && g.options[k] != null ? g.options[k] : ''}" placeholder="${d.default == null ? '∞' : d.default}"><div class="muted small">${esc(d.hint || '')}</div></label>`).join('') || '<span class="muted">—</span>' }
        ];
        // grouped by collection (games with artwork first)
        $('#gt').innerHTML = cols.map((c) => {
          const rows = shown.filter((g) => g.collection === c.id);
          if (!rows.length) return '';
          return `<h3 class="section">${esc(colName[c.id])} <span class="muted small">${rows.length}</span></h3>${table(columns, rows)}`;
        }).join('') || '<div class="muted">No games match the filter</div>';
        const upd = (gid, patch) => guard(async () => {
          const r = await PATCH(`/api/admin/merchants/${id}/games/${gid}`, patch);
          Object.assign(games.find((g) => g.game_id === gid), r.game);
          toast('Saved');
          render();
        })();
        $$('[data-en]').forEach((c) => c.addEventListener('change', () => upd(c.dataset.en, { enabled: c.checked })));
        $$('[data-rtp]').forEach((c) => c.addEventListener('change', () => upd(c.dataset.rtp, { rtp_profile: c.value ? Number(c.value) : null })));
        $$('[data-min]').forEach((c) => c.addEventListener('change', () => upd(c.dataset.min, { min_bet: c.value ? toMinor(c.value, info) : null })));
        $$('[data-max]').forEach((c) => c.addEventListener('change', () => upd(c.dataset.max, { max_bet: c.value ? toMinor(c.value, info) : null })));
        $$('[data-opt]').forEach((c) => c.addEventListener('change', () => upd(c.dataset.opt, { options: { [c.dataset.key]: c.value === '' ? null : Number(c.value) } })));
      };
      render();
      $$('[data-col]').forEach((b) => b.addEventListener('click', () => {
        f.col = b.dataset.col;
        $$('[data-col]').forEach((x) => x.classList.toggle('primary', x === b));
        render();
      }));
      $('#gq').addEventListener('input', render);
      $('#gmech').addEventListener('change', render);
      $('#gcat').addEventListener('change', render);
      const ids = () => shown.map((g) => g.game_id);
      $('#shownOn').addEventListener('click', () => bulk({ enabled: true, filter: { ids: ids() } })());
      $('#shownOff').addEventListener('click', () => bulk({ enabled: false, filter: { ids: ids() } })());
      $('#shownRtp').addEventListener('change', (e) => { if (e.target.value) bulk({ rtp_profile: e.target.value === 'null' ? null : Number(e.target.value), filter: { ids: ids() } })(); });
    }

    if (tab === 'jackpots') await renderJackpots(t, id, m);

    if (tab === 'security') {
      t.innerHTML = `<div class="grid cols-2">
        <div class="card"><h3>IP whitelist</h3>
          <p class="muted small">One rule per line: <code>203.0.113.7</code>, CIDR <code>10.0.0.0/8</code> or <code>*</code>. Empty list = any IP (not recommended for production).</p>
          <textarea id="ips" placeholder="203.0.113.7&#10;10.0.0.0/8">${esc(m.ip_whitelist.join('\n'))}</textarea>
          ${m.ip_whitelist.length ? '' : '<div class="hint warn section">Whitelist is empty — API calls are accepted from any IP.</div>'}
          <div class="row section"><span class="spacer"></span><button class="btn primary" id="saveIps">Save whitelist</button></div></div>
        <div class="card"><h3>Request signing (HMAC-SHA256)</h3>
          <label class="check"><input type="checkbox" id="reqSig" ${m.require_signature ? 'checked' : ''}>Require signed requests</label>
          <p class="muted small">Header <code>X-Timestamp</code> (unix seconds) and <code>X-Signature</code> = hex HMAC-SHA256(secret, <code>"{ts}.{METHOD}.{path?query}.{raw body}"</code>).</p>
          <label>Signing secret<div class="secret"><code id="sec">••••••••••••••••••••</code><button class="btn small" id="showSec">Show</button>${copyBtn(m.signing_secret || '')}</div></label>
          <div class="row section"><button class="btn danger" id="rotSec">Rotate secret</button><span class="spacer"></span><button class="btn primary" id="saveSig">Save</button></div></div></div>`;
      $('#saveIps').addEventListener('click', save(() => ({ ip_whitelist: $('#ips').value }), 'Whitelist saved'));
      $('#saveSig').addEventListener('click', save(() => ({ require_signature: $('#reqSig').checked })));
      $('#showSec').addEventListener('click', () => { $('#sec').textContent = m.signing_secret; });
      $('#rotSec').addEventListener('click', guard(async () => {
        if (!confirm('Rotate the signing secret? The merchant must update it immediately.')) return;
        const r = await POST(`/api/admin/merchants/${id}/secret`);
        showSecret('New signing secret', r.signing_secret, 'Send it to the merchant over a secure channel.');
      }));
    }

    if (tab === 'tokens') {
      t.innerHTML = `<div class="row between"><p class="muted">Bearer tokens for the Merchant API. The full token is shown only once, only its hash is stored.</p>
          <div class="row"><input id="tokName" placeholder="Token name, e.g. production"><button class="btn primary" id="newTok">+ Create token</button></div></div>
        <div class="section">${table([
          { h: 'Name', v: (r) => esc(r.name) },
          { h: 'Prefix', v: (r) => `<code>${esc(r.prefix)}…</code>` },
          { h: 'Created', v: (r) => date(r.created_at) },
          { h: 'Last used', v: (r) => date(r.last_used_at) },
          { h: 'Status', v: (r) => (r.revoked_at ? `<span class="badge red">revoked ${date(r.revoked_at)}</span>` : '<span class="badge green">active</span>') },
          { h: '', v: (r) => (r.revoked_at ? '' : `<button class="btn danger small" data-revoke="${r.id}">Revoke</button>`) }
        ], d.tokens, { empty: 'No tokens' })}</div>`;
      $('#newTok').addEventListener('click', guard(async () => {
        const r = await POST(`/api/admin/merchants/${id}/tokens`, { name: $('#tokName').value || 'API token' });
        showSecret('New API token', r.token.token, 'Copy it now — it will not be shown again.');
      }));
      $$('[data-revoke]').forEach((b) => b.addEventListener('click', guard(async () => {
        if (!confirm('Revoke this token? Calls using it will fail immediately.')) return;
        await DEL(`/api/admin/merchants/${id}/tokens/${b.dataset.revoke}`);
        toast('Token revoked');
        route();
      })));
    }

    if (tab === 'float') {
      const { ledger } = await GET(`/api/admin/ledger?merchant_id=${id}&limit=50`);
      t.innerHTML = `<div class="grid cols-2">
        <div class="card"><h3>Float balance</h3>
          <div class="kpi"><div class="value">${m.float_unlimited ? '∞ unlimited' : money(m.float_balance, info)}</div><div class="sub">Player deposits are drawn from the float, withdrawals return to it.</div></div>
          <label class="check section"><input type="checkbox" id="unl" ${m.float_unlimited ? 'checked' : ''}>Unlimited float</label>
          <div class="row section"><input id="famt" type="number" step="0.01" placeholder="Amount (${esc(info.symbol)}), negative to deduct"><input id="fnote" placeholder="Note"><button class="btn primary" id="fadj">Adjust</button></div></div>
        <div class="card"><h3>How it works</h3><p class="muted">Transfer wallet: the casino calls <code>deposit</code> when a player enters a game and <code>withdraw</code> when they leave. Each call is idempotent on the casino's <code>tx_id</code>. Wins and losses change the player's game balance; GGR = bets − wins.</p></div></div>
        <div class="section"><h3>Ledger</h3>${ledgerTable(ledger)}</div>`;
      $('#unl').addEventListener('change', save(() => ({ float_unlimited: $('#unl').checked })));
      $('#fadj').addEventListener('click', guard(async () => {
        await POST(`/api/admin/merchants/${id}/float`, { amount: toMinor($('#famt').value, info), note: $('#fnote').value });
        toast('Float adjusted');
        route();
      }));
    }

    if (tab === 'integration') {
      const base = location.origin;
      t.innerHTML = `<div class="card">
        <h3>Quick start</h3>
        <p class="muted">Full reference: <a href="/docs" target="_blank">/docs</a> · OpenAPI JSON: <a href="/api/openapi.json" target="_blank">/api/openapi.json</a></p>
        <pre class="json">${esc(`# 1) create / find a player
curl -X POST ${base}/api/v2/players \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"external_id":"user-1001","username":"Alice"}'

# 2) put money into the game wallet (idempotent on tx_id)
curl -X POST ${base}/api/v2/players/user-1001/deposit \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"amount":5000,"tx_id":"dep-0001"}'

# 3) launch a game -> open session.launch_url in an iframe / WebView
curl -X POST ${base}/api/v2/sessions \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"external_id":"user-1001","game_id":"olympus_thunder","lobby_url":"https://your-casino/lobby"}'

# 4) take the balance back when the player leaves
curl -X POST ${base}/api/v2/players/user-1001/withdraw \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"amount":4200,"tx_id":"wd-0001"}'`)}</pre>
        <div class="grid cols-2 section">
          <div><h3>Settings summary</h3><table><tbody>
            <tr><td>Merchant</td><td>${esc(m.code)} (#${m.id})</td></tr>
            <tr><td>Currency</td><td>${esc(m.currency)} — amounts in minor units (1 ${esc(m.currency)} = ${Math.pow(10, info.decimals)})</td></tr>
            <tr><td>Active tokens</td><td>${d.tokens.filter((x) => !x.revoked_at).length}</td></tr>
            <tr><td>IP whitelist</td><td>${m.ip_whitelist.length ? esc(m.ip_whitelist.join(', ')) : '<span class="badge red">any IP</span>'}</td></tr>
            <tr><td>Signed requests</td><td>${m.require_signature ? 'required' : 'off'}</td></tr>
            <tr><td>RTP</td><td>${m.rtp_profile}%</td></tr>
          </tbody></table></div>
          <div class="hint">Test accounts: create players with <code>"is_test": true</code>. Only they can get QA sessions with a custom RTP or a forced bonus (<code>"test": {"rtp_profile": 150, "force_feature": true}</code>). Test sessions show a TEST MODE badge, are logged in the audit log and test accounts cannot withdraw.</div>
        </div></div>`;
    }
  }

  function ledgerTable(rows) {
    return table([
      { h: 'Time', v: (r) => date(r.created_at) },
      { h: 'Merchant', v: (r) => esc(r.merchant_code) },
      { h: 'Type', v: (r) => `<span class="badge ${r.amount >= 0 ? 'green' : 'red'}">${esc(r.type)}</span>` },
      { h: 'Player', v: (r) => (r.user_id ? `<a href="#/players/${r.user_id}">${esc(r.external_id)}</a>` : '—') },
      { h: 'Amount', num: 1, v: (r) => `<span class="${r.amount >= 0 ? 'pos' : 'neg'}">${money(r.amount, curInfo(r.merchant_id))}</span>` },
      { h: 'Player balance', num: 1, v: (r) => money(r.player_balance_after, curInfo(r.merchant_id)) },
      { h: 'Float after', num: 1, v: (r) => (r.float_after == null ? '—' : money(r.float_after, curInfo(r.merchant_id))) },
      { h: 'tx_id / note', v: (r) => esc(r.ext_tx_id || r.note || '') },
      { h: 'By', v: (r) => esc(r.actor || '') }
    ], rows, { empty: 'No wallet movements yet' });
  }

  // ------------------------------------------------------------------ jackpots
  const JP_COLORS = { mini: '#3ddc84', minor: '#3db7ff', major: '#ff5a5a', grand: '#ffd23f' };

  async function renderJackpots(t, id, m) {
    const info = curInfo(id);
    const [{ jackpots }, { wins }] = await Promise.all([GET(`/api/admin/merchants/${id}/jackpots`), GET(`/api/admin/jackpots/wins?merchant_id=${id}`)]);
    t.innerHTML = `
      <div class="row between"><label class="check"><input type="checkbox" id="jpOn" ${m.jackpot_enabled ? 'checked' : ''}>Jackpots enabled for ${esc(m.name)}</label>
        <span class="muted small">Must-hit-by progressive pools shared by all games of this merchant. Contributions are taken from paid bets and returned 100% to players.</span></div>
      <div class="grid jp-cards section">${jackpots.map((j) => `
        <div class="card jp-card" style="--c:${JP_COLORS[j.tier] || '#f5b83d'}">
          <div class="row between"><b>${esc(j.name)}</b>${j.enabled ? '<span class="badge green">on</span>' : '<span class="badge">off</span>'}</div>
          <div class="amount">${money(j.amount, info)}</div>
          <div class="form-grid" data-tier="${j.tier}">
            <label>Seed ${esc(info.symbol)}<input data-k="seed" type="number" step="0.01" value="${toMajor(j.seed, info)}"></label>
            <label>Must hit by ${esc(info.symbol)}<input data-k="must_hit_by" type="number" step="0.01" value="${toMajor(j.must_hit_by, info)}"></label>
            <label>Contribution %<input data-k="contribution_pct" type="number" step="0.01" min="0" max="5" value="${j.contribution_pct}"></label>
            <label>Min bet ${esc(info.symbol)}<input data-k="min_bet" type="number" step="0.01" value="${toMajor(j.min_bet, info)}"></label>
            <label class="check"><input type="checkbox" data-k="enabled" ${j.enabled ? 'checked' : ''}>Enabled</label>
          </div>
          <div class="muted small section">Hits: ${n(j.hits)} · paid ${money(j.total_paid, info)}${j.last_hit_at ? ` · last ${money(j.last_hit_amount, info)} at ${date(j.last_hit_at)}` : ''}</div>
          <div class="row section"><button class="btn small danger" data-reset="${j.tier}">Reset to seed</button><span class="spacer"></span><button class="btn small primary" data-savejp="${j.tier}">Save</button></div>
        </div>`).join('')}</div>
      <div class="section"><h3>Recent wins</h3>${table([
        { h: 'Time', v: (r) => date(r.created_at) },
        { h: 'Tier', v: (r) => `<span class="badge gold">${esc(r.tier.toUpperCase())}</span>` },
        { h: 'Player', v: (r) => `<a href="#/players/${r.user_id}">${esc(r.external_id)}</a>` },
        { h: 'Game', v: (r) => esc(r.game_id) },
        { h: 'Round', v: (r) => `<a href="#/rounds/${r.round_id}" class="mono">${esc(String(r.round_id).slice(0, 8))}…</a>` },
        { h: 'Amount', num: 1, v: (r) => money(r.amount, info) }
      ], wins, { empty: 'No wins yet' })}</div>`;
    $('#jpOn', t).addEventListener('change', guard(async (e) => { await PATCH(`/api/admin/merchants/${id}`, { jackpot_enabled: e.target.checked }); await loadMeta(); toast('Saved'); route(); }));
    $$('[data-savejp]', t).forEach((b) => b.addEventListener('click', guard(async () => {
      const box = $(`[data-tier="${b.dataset.savejp}"]`, t);
      const v = (k) => $(`[data-k="${k}"]`, box);
      await PATCH(`/api/admin/merchants/${id}/jackpots/${b.dataset.savejp}`, {
        seed: toMinor(v('seed').value, info), must_hit_by: toMinor(v('must_hit_by').value, info),
        contribution_pct: Number(v('contribution_pct').value), min_bet: toMinor(v('min_bet').value || 0, info), enabled: v('enabled').checked
      });
      toast('Jackpot saved');
      route();
    })));
    $$('[data-reset]', t).forEach((b) => b.addEventListener('click', guard(async () => {
      if (!confirm('Reset this pool to its seed value? The accumulated amount will be lost.')) return;
      await POST(`/api/admin/merchants/${id}/jackpots/${b.dataset.reset}/reset`);
      toast('Pool reset');
      route();
    })));
  }

  pages.jackpots = async (el) => {
    const id = Number(state.scope || state.meta.merchants[0].id);
    const m = (await GET(`/api/admin/merchants/${id}`)).merchant;
    el.innerHTML = `<div class="row"><span class="muted">Merchant:</span><select id="jpM">${state.meta.merchants.map((x) => `<option value="${x.id}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div><div class="section" id="jpT"></div>`;
    $('#jpM').addEventListener('change', (e) => { setScope(e.target.value); });
    await renderJackpots($('#jpT'), id, m);
  };

  // ------------------------------------------------------------------ players
  pages.players = async (el, args) => {
    const q = store.get('sk_pq', '');
    const testOnly = store.get('sk_ptest', '') === '1';
    const off = Number(store.get('sk_poff', 0));
    const r = await GET(`/api/admin/players?${scopeQ()}&q=${encodeURIComponent(q)}&test=${testOnly ? 1 : 0}&limit=50&offset=${off}`);
    el.innerHTML = `
      <div class="row"><input id="pq" placeholder="Search by external id / username / id" value="${esc(q)}" style="min-width:300px">
        <label class="check"><input type="checkbox" id="pt" ${testOnly ? 'checked' : ''}>Test accounts only</label><span class="spacer"></span>
        <button class="btn primary" id="newP">+ Player</button></div>
      <div class="section">${table([
        { h: 'ID', v: (p) => p.player_id },
        { h: 'Player', v: (p) => `<b>${esc(p.external_id)}</b> <span class="muted small">${esc(p.username)}</span> ${p.is_test ? '<span class="badge test">TEST</span>' : ''}` },
        { h: 'Merchant', v: (p) => esc(p.merchant_code) },
        { h: 'Status', v: (p) => statusBadge(p.status) },
        { h: 'Balance', num: 1, v: (p) => money(p.balance, curInfo(p.merchant_id)) },
        { h: 'Rounds', num: 1, v: (p) => n(p.rounds) },
        { h: 'Bets', num: 1, v: (p) => money(p.total_bet, curInfo(p.merchant_id)) },
        { h: 'Net', num: 1, v: (p) => `<span class="${p.total_bet - p.total_win >= 0 ? 'pos' : 'neg'}">${money(p.total_bet - p.total_win, curInfo(p.merchant_id))}</span>` },
        { h: 'Last seen', v: (p) => date(p.last_seen_at) }
      ], r.players, { rowAttr: (p) => `class="click" data-pid="${p.player_id}"`, empty: 'No players found' })}</div>
      <div class="pager">${off + 1}–${Math.min(off + 50, r.total)} of ${n(r.total)} <button class="btn small" id="prev" ${off ? '' : 'disabled'}>‹</button><button class="btn small" id="next" ${off + 50 < r.total ? '' : 'disabled'}>›</button></div>`;
    let tmr;
    $('#pq').addEventListener('input', (e) => { clearTimeout(tmr); tmr = setTimeout(() => { store.set('sk_pq', e.target.value); store.set('sk_poff', 0); route(); }, 350); });
    $('#pt').addEventListener('change', (e) => { store.set('sk_ptest', e.target.checked ? '1' : ''); store.set('sk_poff', 0); route(); });
    $('#prev').addEventListener('click', () => { store.set('sk_poff', Math.max(0, off - 50)); route(); });
    $('#next').addEventListener('click', () => { store.set('sk_poff', off + 50); route(); });
    $$('[data-pid]', el).forEach((tr) => tr.addEventListener('click', () => playerModal(Number(tr.dataset.pid))));
    if (args[0]) playerModal(Number(args[0]));
    $('#newP').addEventListener('click', () => {
      const card = modal(`<div class="modal-head"><h2>New player</h2><button class="btn ghost" data-close>✕</button></div>
        <div class="form-grid"><label>Merchant<select id="npm">${state.meta.merchants.map((x) => `<option value="${x.id}" ${String(x.id) === state.scope ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>External id<input id="npe" placeholder="user-1001"></label><label>Username<input id="npu"></label>
        <label class="check" style="align-self:end"><input type="checkbox" id="npt">Test account (QA)</label></div>
        <div class="row section"><span class="spacer"></span><button class="btn primary" id="npSave">Create</button></div>`);
      $('#npSave', card).addEventListener('click', guard(async () => {
        const r2 = await POST('/api/admin/players', { merchant_id: Number($('#npm').value), external_id: $('#npe').value, username: $('#npu').value, is_test: $('#npt').checked });
        closeModal();
        toast(r2.created ? 'Player created' : 'Player already existed');
        playerModal(r2.player.player_id);
      }));
    });
  };

  async function playerModal(pid) {
    const d = await GET(`/api/admin/players/${pid}`);
    const p = d.player;
    const info = p.currency_info;
    const card = modal(`
      <div class="modal-head"><h2>${esc(p.external_id)} <span class="muted small">#${p.player_id} · ${esc(p.merchant_code)}</span> ${p.is_test ? '<span class="badge test">TEST ACCOUNT</span>' : ''}</h2><button class="btn ghost" data-close>✕</button></div>
      <div class="grid kpis">
        ${kpi('Balance', money(p.balance, info), statusBadge(p.status))}
        ${kpi('Bets', money(d.stats.bets, info), `${n(d.stats.rounds)} rounds`)}
        ${kpi('Wins', money(d.stats.wins, info), `RTP ${pct(d.stats.rtp_actual, 1)}`)}
        ${kpi('Net for casino', `<span class="${d.stats.ggr >= 0 ? 'pos' : 'neg'}">${money(d.stats.ggr, info)}</span>`, `jackpots ${money(d.stats.jackpot_wins, info)}`)}
      </div>
      <div class="grid cols-2 section">
        <div class="card"><h3>Balance correction</h3>
          <div class="row"><input id="adjA" type="number" step="0.01" placeholder="Amount ${esc(info.symbol)} (+/−)"><input id="adjN" placeholder="Reason"><button class="btn primary" id="adj">Apply</button></div>
          <div class="row section"><button class="btn ${p.status === 'active' ? 'danger' : ''}" id="blk">${p.status === 'active' ? 'Block player' : 'Unblock player'}</button>
            <label class="check"><input type="checkbox" id="tst" ${p.is_test ? 'checked' : ''}>Test account</label></div>
          <p class="muted small">Test accounts can receive QA sessions (custom RTP, forced bonus) and cannot withdraw.</p></div>
        <div class="card"><h3>QA test session</h3>${p.is_test ? `
          <div class="form-grid"><label>Game<select id="qg">${state.meta.games.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>
          <label>RTP % (QA ${state.meta.qa_rtp_range.join('–')})<input id="qr" type="number" value="96" min="${state.meta.qa_rtp_range[0]}" max="${state.meta.qa_rtp_range[1]}"></label>
          <label class="check" style="align-self:end"><input type="checkbox" id="qf">Force bonus on next spin</label></div>
          <div class="row section"><span class="spacer"></span><button class="btn primary" id="qs">Launch test session</button></div><div id="qres"></div>`
          : '<p class="muted">Custom-RTP sessions are available only for test accounts. Real players always play the merchant\'s configured RTP.</p>'}</div>
      </div>
      <div class="section"><h3>Recent rounds</h3>${roundsTable(d.rounds)}</div>
      <div class="section"><h3>Wallet</h3>${ledgerTable(d.ledger)}</div>`, { wide: true });
    $('#adj', card).addEventListener('click', guard(async () => {
      await POST(`/api/admin/players/${pid}/adjust`, { amount: toMinor($('#adjA').value, info), note: $('#adjN').value });
      toast('Balance adjusted');
      playerModal(pid);
    }));
    $('#blk', card).addEventListener('click', guard(async () => { await PATCH(`/api/admin/players/${pid}`, { status: p.status === 'active' ? 'blocked' : 'active' }); playerModal(pid); }));
    $('#tst', card).addEventListener('change', guard(async (e) => { await PATCH(`/api/admin/players/${pid}`, { is_test: e.target.checked }); toast('Saved'); playerModal(pid); }));
    const qs = $('#qs', card);
    if (qs) {
      qs.addEventListener('click', guard(async () => {
        const r = await POST('/api/admin/sessions', { player_id: pid, game_id: $('#qg').value, rtp_profile: Number($('#qr').value), force_feature: $('#qf').checked });
        $('#qres').innerHTML = `<div class="secret section"><code>${esc(r.session.launch_url)}</code><a class="btn small" target="_blank" href="${esc(r.session.launch_url)}">Open</a>${copyBtn(r.session.launch_url)}</div>`;
      }));
    }
    $$('[data-round]', card).forEach((tr) => tr.addEventListener('click', () => roundModal(tr.dataset.round)));
  }

  // ------------------------------------------------------------------ RTP manager
  pages.rtp = async (el) => {
    const [{ merchants }, { sessions }] = await Promise.all([GET('/api/admin/merchants'), GET(`/api/admin/sessions?${scopeQ()}`)]);
    el.innerHTML = `
      <div class="grid cols-2">
        <div class="card"><h3>How RTP is controlled</h3>
          <p>Every game ships in ${state.meta.rtp_profiles.map((p) => `<b>${p}%</b>`).join(' / ')} versions. A version rescales every pay of the certified paytable; reels, features and hit frequency stay identical, and the selected RTP is shown to players in the game rules.</p>
          <p class="muted">Priority: <b>per-game override</b> (Merchant → Games) › <b>merchant default</b>. QA sessions for <b>test accounts</b> may use any RTP between ${state.meta.qa_rtp_range.join('% and ')}% and a forced bonus; they show a TEST MODE badge and are written to the audit log.</p>
          <div class="hint warn">Changing the RTP of an individual real player or session is intentionally not possible: it misleads players and is prohibited by gaming regulators.</div></div>
        <div class="card"><h3>Merchant RTP</h3>${table([
          { h: 'Merchant', v: (m) => `<a href="#/merchants/${m.id}/limits">${esc(m.name)}</a>` },
          { h: 'Default RTP', v: (m) => `<select data-mr="${m.id}">${state.meta.rtp_profiles.map((p) => `<option ${p === m.rtp_profile ? 'selected' : ''}>${p}</option>`).join('')}</select>` },
          { h: 'Per-game', v: (m) => `<a href="#/merchants/${m.id}/games">overrides →</a>` }
        ], merchants)}</div>
      </div>
      <div class="section card"><h3>New QA test session</h3>
        <div class="form-grid">
          <label>Test player<select id="tp"><option value="">Loading…</option></select></label>
          <label>Game<select id="tg">${state.meta.games.map((g) => `<option value="${g.id}">${esc(g.name)} · ${esc(g.mechanic)}</option>`).join('')}</select></label>
          <label>RTP %<input id="tr" type="number" value="96" min="${state.meta.qa_rtp_range[0]}" max="${state.meta.qa_rtp_range[1]}"></label>
          <label class="check" style="align-self:end"><input type="checkbox" id="tf">Force bonus on next spin</label>
        </div>
        <div class="row section"><span class="muted small">Need a test account? Players → + Player → "Test account".</span><span class="spacer"></span><button class="btn primary" id="ts">Create session</button></div>
        <div id="tres"></div></div>
      <div class="section"><div class="row between"><h3>Active sessions</h3></div>${table([
        { h: 'Started', v: (s) => date(s.created_at) },
        { h: 'Merchant', v: (s) => esc(s.merchant_code) },
        { h: 'Player', v: (s) => `<a href="#/players/${s.user_id}">${esc(s.external_id)}</a> ${s.is_test ? '<span class="badge test">TEST</span>' : ''}` },
        { h: 'Game', v: (s) => esc(s.game_name) },
        { h: 'Mode', v: (s) => (s.test_mode ? `<span class="badge test">QA${s.rtp_profile ? ` RTP ${s.rtp_profile}%` : ''}${s.force_feature ? ' · FORCE' : ''}</span>` : '<span class="badge">live</span>') },
        { h: 'Spins', num: 1, v: (s) => n(s.spins) },
        { h: 'Expires', v: (s) => date(s.expires_at) },
        { h: '', v: (s) => `<button class="btn danger small" data-kill="${esc(s.token_full)}">End</button>` }
      ], sessions, { empty: 'No active sessions' })}</div>`;
    $$('[data-mr]', el).forEach((s) => s.addEventListener('change', guard(async () => { await PATCH(`/api/admin/merchants/${s.dataset.mr}`, { rtp_profile: Number(s.value) }); await loadMeta(); toast('RTP profile saved'); })));
    $$('[data-kill]', el).forEach((b) => b.addEventListener('click', guard(async () => { await DEL(`/api/admin/sessions/${b.dataset.kill}`); toast('Session ended'); route(); })));
    const tp = await GET(`/api/admin/players?test=1&limit=200&${scopeQ()}`);
    $('#tp').innerHTML = tp.players.length ? tp.players.map((p) => `<option value="${p.player_id}">${esc(p.external_id)} · ${esc(p.merchant_code)}</option>`).join('') : '<option value="">No test accounts yet</option>';
    $('#ts').addEventListener('click', guard(async () => {
      if (!$('#tp').value) throw new Error('Create a test account first');
      const r = await POST('/api/admin/sessions', { player_id: Number($('#tp').value), game_id: $('#tg').value, rtp_profile: Number($('#tr').value), force_feature: $('#tf').checked });
      $('#tres').innerHTML = `<div class="secret section"><code>${esc(r.session.launch_url)}</code><a class="btn small" target="_blank" href="${esc(r.session.launch_url)}">Open game</a>${copyBtn(r.session.launch_url)}</div>`;
    }));
  };

  // ------------------------------------------------------------------ rounds
  function roundsTable(rows) {
    return table([
      { h: 'Time', v: (r) => date(r.created_at) },
      { h: 'Round', v: (r) => `<span class="mono">${esc(r.round_id.slice(0, 8))}…</span>` },
      { h: 'Merchant', v: (r) => esc(r.merchant_code) },
      { h: 'Player', v: (r) => esc(r.external_id) },
      { h: 'Game', v: (r) => esc(r.game_name) },
      { h: 'Type', v: (r) => `<span class="badge ${r.type === 'buy' ? 'purple' : r.type === 'free_spin' ? 'gold' : ''}">${esc(r.type)}</span>${r.test_mode ? ' <span class="badge test">QA</span>' : ''}` },
      { h: 'RTP', v: (r) => (r.rtp_profile ? `${r.rtp_profile}%` : '—') },
      { h: 'Bet', num: 1, v: (r) => money(r.bet, curInfo(r.merchant_id)) },
      { h: 'Win', num: 1, v: (r) => `<span class="${r.win > 0 ? 'pos' : ''}">${money(r.win, curInfo(r.merchant_id))}</span>${r.jackpot_win ? ' 💎' : ''}` },
      { h: 'Balance', num: 1, v: (r) => money(r.balance_after, curInfo(r.merchant_id)) }
    ], rows, { rowAttr: (r) => `class="click" data-round="${r.round_id}"`, empty: 'No rounds' });
  }

  pages.rounds = async (el, args) => {
    if (args[0]) { await roundModal(args[0]); }
    const f = JSON.parse(store.get('sk_rf', '{}'));
    const off = Number(f.offset || 0);
    const qs = new URLSearchParams({ ...(state.scope ? { merchant_id: state.scope } : {}), ...(f.player_id ? { player_id: f.player_id } : {}), ...(f.game_id ? { game_id: f.game_id } : {}), ...(f.from ? { from: f.from } : {}), ...(f.to ? { to: f.to } : {}), limit: 50, offset: off });
    const r = await GET(`/api/admin/rounds?${qs}`);
    el.innerHTML = `
      <div class="row"><input id="rp" placeholder="Player id" value="${esc(f.player_id || '')}" style="width:120px">
        <select id="rg"><option value="">All games</option>${state.meta.games.map((g) => `<option value="${g.id}" ${g.id === f.game_id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
        <input id="rfrom" type="date" value="${esc(f.from || '')}"><input id="rto" type="date" value="${esc(f.to || '')}"><button class="btn" id="rapply">Apply</button><button class="btn ghost" id="rclear">Clear</button></div>
      <div class="section">${roundsTable(r.rounds)}</div>
      <div class="pager">${n(r.total)} rounds <button class="btn small" id="prev" ${off ? '' : 'disabled'}>‹</button><button class="btn small" id="next" ${off + 50 < r.total ? '' : 'disabled'}>›</button></div>`;
    const setF = (x) => { store.set('sk_rf', JSON.stringify(x)); route(); };
    $('#rapply').addEventListener('click', () => setF({ player_id: $('#rp').value, game_id: $('#rg').value, from: $('#rfrom').value, to: $('#rto').value }));
    $('#rclear').addEventListener('click', () => setF({}));
    $('#prev').addEventListener('click', () => setF({ ...f, offset: Math.max(0, off - 50) }));
    $('#next').addEventListener('click', () => setF({ ...f, offset: off + 50 }));
    $$('[data-round]', el).forEach((tr) => tr.addEventListener('click', () => roundModal(tr.dataset.round)));
  };

  async function roundModal(id) {
    const { round: r } = await GET(`/api/admin/rounds/${id}`);
    const info = curInfo(r.merchant_id);
    const winSet = new Set((r.wins || []).flatMap((w) => (w.positions || []).map(([a, b]) => `${a},${b}`)));
    const grid = Array.isArray(r.matrix) && r.matrix.length ? `<div class="rgrid" style="grid-template-columns:repeat(${r.matrix[0].length},58px)">${r.matrix.map((row, ri) => row.map((s, ci) => `<span class="${winSet.has(`${ri},${ci}`) ? 'win' : ''}">${esc(s)}</span>`).join('')).join('')}</div>` : '';
    modal(`<div class="modal-head"><h2>Round <span class="mono small">${esc(r.round_id)}</span></h2><button class="btn ghost" data-close>✕</button></div>
      <div class="grid kpis">${kpi('Bet', money(r.bet, info), esc(r.type))}${kpi('Win', money(r.win, info), r.jackpot_win ? `jackpot ${money(r.jackpot_win, info)}` : '')}${kpi('Balance', money(r.balance_after, info), `before ${money(r.balance_before, info)}`)}${kpi('RTP profile', r.rtp_profile ? `${r.rtp_profile}%` : '—', r.test_mode ? 'QA session' : 'live')}</div>
      <p class="muted section">${esc(r.game_name)} · player ${esc(r.external_id)} · ${esc(r.merchant_code)} · ${date(r.created_at)}</p>
      <div class="section"><h3>Final grid</h3>${grid}</div>
      <div class="section"><h3>Wins & details</h3><pre class="json">${esc(JSON.stringify({ wins: r.wins, details: r.details }, null, 2))}</pre></div>`, { wide: true });
  }

  // ------------------------------------------------------------------ ledger / audit / settings
  pages.ledger = async (el) => {
    const { ledger } = await GET(`/api/admin/ledger?${scopeQ()}&limit=200`);
    el.innerHTML = ledgerTable(ledger);
  };

  pages.audit = async (el) => {
    const { audit } = await GET('/api/admin/audit?limit=300');
    el.innerHTML = table([
      { h: 'Time', v: (a) => date(a.created_at) },
      { h: 'Actor', v: (a) => esc(a.actor) },
      { h: 'Action', v: (a) => `<span class="badge ${/test|rotate|revoke|failed/.test(a.action) ? 'gold' : ''}">${esc(a.action)}</span>` },
      { h: 'Target', v: (a) => esc(a.target || '') },
      { h: 'Details', v: (a) => `<span class="mono small">${esc(a.details ? JSON.stringify(a.details).slice(0, 140) : '')}</span>` },
      { h: 'IP', v: (a) => esc(a.ip || '') }
    ], audit, { empty: 'Nothing logged yet' });
  };

  pages.settings = async (el) => {
    const { admins } = await GET('/api/admin/admins');
    el.innerHTML = `<div class="grid cols-2">
      <div class="card"><h3>Change your password</h3><div class="form-grid">
        <label>Current password<input id="cp" type="password"></label><label>New password (10+ chars)<input id="np" type="password"></label></div>
        <div class="row section"><span class="spacer"></span><button class="btn primary" id="chg">Change password</button></div></div>
      <div class="card"><h3>Back-office users</h3>${table([{ h: 'User', v: (a) => esc(a.username) }, { h: 'Role', v: (a) => `<span class="badge">${esc(a.role)}</span>` }, { h: 'Created', v: (a) => date(a.created_at) }], admins)}
        ${state.admin.role === 'owner' ? `<div class="form-grid section"><label>Username<input id="au"></label><label>Password<input id="ap" type="password"></label>
          <label>Role<select id="ar"><option>admin</option><option>viewer</option><option>owner</option></select></label></div>
          <div class="row section"><span class="spacer"></span><button class="btn" id="add">Add user</button></div>` : ''}</div></div>`;
    $('#chg').addEventListener('click', guard(async () => {
      await POST('/api/admin/password', { current_password: $('#cp').value, new_password: $('#np').value });
      toast('Password changed — please log in again');
      showLogin();
    }));
    const add = $('#add');
    if (add) add.addEventListener('click', guard(async () => { await POST('/api/admin/admins', { username: $('#au').value, password: $('#ap').value, role: $('#ar').value }); toast('User added'); route(); }));
  };

  // ================================================================== shell
  const TITLES = { dashboard: 'Dashboard', merchants: 'Merchants', players: 'Players', rtp: 'RTP Manager', jackpots: 'Jackpots', rounds: 'Rounds', ledger: 'Wallet ledger', audit: 'Audit log', settings: 'Settings' };

  async function loadMeta() {
    state.meta = await GET('/api/admin/meta');
    const sel = $('#merchantFilter');
    sel.innerHTML = `<option value="">All merchants</option>${state.meta.merchants.map((m) => `<option value="${m.id}">${esc(m.name)} (${esc(m.currency)})</option>`).join('')}`;
    if (state.scope && !state.meta.merchants.find((m) => String(m.id) === state.scope)) state.scope = '';
    sel.value = state.scope;
  }

  function setScope(v) {
    state.scope = String(v || '');
    store.set('sk_scope', state.scope);
    $('#merchantFilter').value = state.scope;
    route();
  }

  async function route() {
    const [page = 'dashboard', ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const fn = pages[page] || pages.dashboard;
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
    $('#pageTitle').textContent = TITLES[page] || 'Dashboard';
    const el = $('#content');
    try {
      await fn(el, args);
    } catch (e) {
      if (e.message !== 'Please log in') el.innerHTML = `<div class="card danger-box hint">${esc(e.message)}</div>`;
    }
  }

  function showLogin() {
    $('#shell').hidden = true;
    $('#login').hidden = false;
    closeModal();
  }

  async function start() {
    try {
      const me = await GET('/api/admin/me');
      state.admin = me.admin;
    } catch {
      return;
    }
    $('#login').hidden = true;
    $('#shell').hidden = false;
    $('#who').textContent = `${state.admin.username} · ${state.admin.role}`;
    await loadMeta();
    route();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await POST('/api/admin/login', f);
      $('#loginError').textContent = '';
      start();
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  });
  $('#btnLogout').addEventListener('click', async () => { await POST('/api/admin/logout').catch(() => {}); showLogin(); });
  $('#merchantFilter').addEventListener('change', (e) => setScope(e.target.value));
  window.addEventListener('hashchange', route);
  showLogin();
  start();
})();
