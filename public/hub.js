/**
 * SpinKit Hub Client
 * Handles Game catalog loading, Launch URL requests, Balance sync,
 * Audit log viewer, and API sandbox execution.
 */

const DEFAULT_USER_ID = 49102;
let allGames = [];
let activeToken = null;
let currentLaunchUrl = null;
let currency = { code: 'USD', symbol: '$', decimals: 2 };
let moneyFmt = null;

function fmt(minor) {
  if (!moneyFmt) {
    try {
      moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.code, minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals });
      moneyFmt.format(1);
    } catch {
      const plain = new Intl.NumberFormat(undefined, { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals });
      moneyFmt = { format: (v) => currency.symbol + plain.format(v) };
    }
  }
  return moneyFmt.format(Number(minor) / Math.pow(10, currency.decimals));
}

const CATEGORY_LABELS = { egypt: 'Ancient Egypt', classic: 'Classic', scifi: 'Sci-Fi', mythology: 'Mythology', candy: 'Candy', asian: 'Asian', animals: 'Animals', aztec: 'Aztec', norse: 'Norse', pirates: 'Pirates', western: 'Wild West', fantasy: 'Fantasy', ocean: 'Ocean', winter: 'Winter', jungle: 'Jungle', space: 'Space', horror: 'Horror', lucky: 'Lucky', ancient: 'Ancient Rome', adventure: 'Adventure', fun: 'Fun & Party', fruits: 'Fruits', sweets: 'Sweets', nature: 'Nature', holiday: 'Holidays', gems: 'Gems', arabian: 'Arabian Nights', sport: 'Sport', music: 'Music', tropical: 'Tropical', crime: 'Crime' };
const MECHANIC_LABEL = (g) => g.mechanic === 'matchlines' ? `${g.reels_count}×${g.rows_count} LINE CASCADES` : g.mechanic === 'holdwin' ? `${g.paylines_count} LINES · HOLD & WIN` : g.mechanic === 'lines' ? `${g.paylines_count} LINES` : (g.mechanic === 'ways' || g.mechanic === 'giants') ? `${Number(g.ways_count).toLocaleString()} WAYS` : g.mechanic === 'clusters' ? 'CLUSTER PAYS' : g.mechanic === 'megaways' ? `${Number(g.ways_count).toLocaleString()} MEGAWAYS` : 'PAY ANYWHERE';
const NEW_GAMES = ['enchanted_knight', 'jade_dragon', 'wild_safari'];

// DOM Elements
const elBalance = document.getElementById('headerBalance');
const btnRefill = document.getElementById('btnHubRefill');
const gamesGrid = document.getElementById('gamesGrid');
const filterChipsWrap = document.getElementById('filterChips');
const tabButtons = document.querySelectorAll('.nav-tab[data-tab]');
const tabPanes = document.querySelectorAll('.tab-pane');

const gameModal = document.getElementById('gameModal');
const gameIframe = document.getElementById('gameIframe');
const gameModalTitle = document.getElementById('gameModalTitle');
const btnCloseGameModal = document.getElementById('btnCloseGameModal');
const btnOpenNewTab = document.getElementById('btnOpenNewTab');

const auditTableBody = document.getElementById('auditTableBody');
const btnRefreshAudit = document.getElementById('btnRefreshAudit');
const statRounds = document.getElementById('statRounds');

const txModal = document.getElementById('txModal');
const txModalContent = document.getElementById('txModalContent');
const btnCloseTxModal = document.getElementById('btnCloseTxModal');

// API Sandbox Elements
const btnTestLaunch = document.getElementById('btnTestLaunch');
const btnTestInit = document.getElementById('btnTestInit');
const btnTestSpin = document.getElementById('btnTestSpin');
const resBoxLaunch = document.getElementById('resBoxLaunch');
const resBoxInit = document.getElementById('resBoxInit');
const resBoxSpin = document.getElementById('resBoxSpin');
const reqBoxInit = document.getElementById('reqBoxInit');
const reqBoxSpin = document.getElementById('reqBoxSpin');

// Initialize Hub
async function init() {
  bindEvents();
  await Promise.all([
    fetchBalance(),
    fetchGames(),
    fetchAuditLog()
  ]);

  // Periodic balance sync
  setInterval(fetchBalance, 4000);
}

function bindEvents() {
  // Tabs switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      if (targetTab === 'audit') {
        fetchAuditLog();
      }
    });
  });

  // Games can ask the lobby to close them (menu -> back to lobby)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'spinkit:close') btnCloseGameModal.click();
  });

  // Refill balance
  btnRefill.addEventListener('click', refillBalance);

  // Close Game Modal
  btnCloseGameModal.addEventListener('click', () => {
    gameModal.classList.remove('active');
    gameIframe.src = 'about:blank';
    fetchBalance();
    fetchAuditLog();
  });

  // Open full window
  btnOpenNewTab.addEventListener('click', () => {
    if (currentLaunchUrl) {
      window.open(currentLaunchUrl, '_blank');
    }
  });

  // Audit refresh
  btnRefreshAudit.addEventListener('click', fetchAuditLog);

  // Tx inspector modal close
  btnCloseTxModal.addEventListener('click', () => {
    txModal.classList.remove('active');
  });

  // API Sandbox Tests
  btnTestLaunch.addEventListener('click', runSandboxLaunch);
  btnTestInit.addEventListener('click', runSandboxInit);
  btnTestSpin.addEventListener('click', runSandboxSpin);
}

// Fetch user balance
async function fetchBalance() {
  try {
    const res = await fetch(`/api/v1/user/balance?user_id=${DEFAULT_USER_ID}`);
    const data = await res.json();
    if (data.balance !== undefined) {
      elBalance.textContent = fmt(data.balance);
    }
  } catch (e) {
    console.error('Balance fetch failed:', e);
  }
}

// Refill infinite credits (+10,000,000)
async function refillBalance() {
  try {
    const res = await fetch('/api/v1/user/refill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: DEFAULT_USER_ID })
    });
    const data = await res.json();
    if (data.status === 'success') {
      elBalance.textContent = fmt(data.balance);
      showNotification(`Added +${fmt(data.added)} free credits!`);
    }
  } catch (e) {
    console.error('Refill error:', e);
  }
}

// Fetch games list
async function fetchGames() {
  try {
    const res = await fetch('/api/v1/games');
    const data = await res.json();
    // games with painted artwork first
    allGames = (data.games || []).slice().sort((a, b) => (a.collection === 'artwork' ? 0 : 1) - (b.collection === 'artwork' ? 0 : 1));
    if (data.currency) { currency = data.currency; moneyFmt = null; }
    const el = document.getElementById('statGames');
    if (el) el.textContent = allGames.length;
    renderFilters();
    renderGames();
    fetchBalance();
  } catch (e) {
    console.error('Games fetch error:', e);
  }
}

const lobbyState = { mech: 'all', cat: '', q: '' };

function renderFilters() {
  if (!filterChipsWrap) return;
  const chips = [
    ['all', `All (${allGames.length})`],
    ['artwork', `With artwork (${allGames.filter((g) => g.collection === 'artwork').length})`],
    ['lines', 'Paylines'],
    ['ways', 'Ways'],
    ['tumble', 'Tumble / Pay Anywhere'],
    ['giants', 'Giant Symbols'],
    ['clusters', 'Cluster Pays'],
    ['megaways', 'Megaways'],
    ['holdwin', 'Hold & Win'],
    ['matchlines', 'Line Cascades'],
    ['classic', 'Classic 3×3'],
    ['buy', 'Bonus Buy'],
    ['new', 'New']
  ];
  filterChipsWrap.innerHTML = '';
  chips.forEach(([key, label]) => {
    const b = document.createElement('button');
    b.className = 'chip-btn' + (key === lobbyState.mech ? ' active' : '');
    b.textContent = label;
    b.onclick = () => {
      lobbyState.mech = key;
      filterChipsWrap.querySelectorAll('.chip-btn').forEach((x) => x.classList.toggle('active', x === b));
      renderGames();
    };
    filterChipsWrap.appendChild(b);
  });

  const sel = document.getElementById('themeSelect');
  if (sel) {
    const cats = [...new Set(allGames.map((g) => g.category))].sort();
    sel.innerHTML = '<option value="">All themes</option>' + cats.map((c) => `<option value="${c}">${CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1)} (${allGames.filter((g) => g.category === c).length})</option>`).join('');
    sel.onchange = () => { lobbyState.cat = sel.value; renderGames(); };
  }
  const search = document.getElementById('gameSearch');
  if (search) search.oninput = () => { lobbyState.q = search.value.trim().toLowerCase(); renderGames(); };
}

function matchesFilter(g) {
  const m = lobbyState.mech;
  if (m === 'lines' && !(g.mechanic === 'lines' && g.reels_count > 3)) return false;
  if (m === 'classic' && g.reels_count !== 3) return false;
  if ((m === 'ways' || m === 'tumble' || m === 'giants' || m === 'clusters' || m === 'megaways' || m === 'holdwin' || m === 'matchlines') && g.mechanic !== m) return false;
  if (m === 'buy' && !g.has_feature_buy) return false;
  if (m === 'artwork' && g.collection !== 'artwork') return false;
  if (m === 'new' && !g.skin_of && !NEW_GAMES.includes(g.id)) return false;
  if (lobbyState.cat && g.category !== lobbyState.cat) return false;
  if (lobbyState.q && !(`${g.name} ${g.category} ${g.tagline}`.toLowerCase().includes(lobbyState.q))) return false;
  return true;
}

function renderGames() {
  gamesGrid.innerHTML = '';
  const filtered = allGames.filter(matchesFilter);
  const countEl = document.getElementById('gamesCount');
  if (countEl) countEl.textContent = `${filtered.length} / ${allGames.length}`;
  if (!filtered.length) {
    gamesGrid.innerHTML = '<div class="no-games">No games match your filters.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach((game) => {
    const card = document.createElement('div');
    card.className = 'game-tile';
    const t = game.theme || {};
    let icons = '';
    const stageCover = t.thumb || t.cover || (t.stage ? t.stage.image : null); // lobby thumbnail, else full artwork cover
    if (!stageCover) {
      const files = game.cover_files && game.cover_files.length ? game.cover_files : (game.symbol_files || []).slice(0, 3);
      icons = files.map((f, i) => `<img class="tile-icon i${i}" src="/games/assets/icons/${f}" alt="" loading="lazy">`).join('');
    }
    const [l1, l2] = t.title || [game.name, ''];
    const logoHtml = stageCover
      ? ''
      : t.logo
      ? `<img src="${t.logo}" style="max-height:46px;max-width:85%;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.8));">`
      : `<span>${l1}</span><span>${l2}</span>`;
    const isNew = game.skin_of || NEW_GAMES.includes(game.id);

    card.innerHTML = `
      <div class="tile-cover${stageCover ? ' has-art' : ''}${t.thumb ? ' has-thumb' : ''}" style="--a:${t.accent};--b1:${t.bg1};--b2:${t.bg2};--font:'${t.font || 'Cinzel'}'${stageCover ? `;background:url('${stageCover}') ${t.thumb ? 'center' : 'center 30%'} / cover no-repeat` : ''}">
        <div class="tile-icons">${icons}</div>
        <div class="tile-logo">${logoHtml}</div>
        <div class="tile-badges">
          ${NEW_GAMES.includes(game.id) || game.mechanic === 'giants' ? '<span class="badge new">NEW</span>' : ''}
          ${game.has_feature_buy ? '<span class="badge buy">BUY</span>' : ''}
        </div>
        <div class="tile-play"><span>▶ PLAY</span></div>
      </div>
      <div class="tile-info">
        <div class="tile-name">${game.name}</div>
        <div class="tile-meta"><span>${MECHANIC_LABEL(game)}</span><span>RTP ${game.rtp}</span></div>
      </div>
    `;
    card.addEventListener('click', () => launchGame(game.id, game.name));
    frag.appendChild(card);
  });
  gamesGrid.appendChild(frag);
}

// Launch Game through RGS
async function launchGame(gameId, gameTitle) {
  try {
    const res = await fetch('/api/v1/games/launch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-key'
      },
      body: JSON.stringify({
        user_id: DEFAULT_USER_ID,
        game_id: gameId
      })
    });

    const data = await res.json();
    if (data.status === 'success' && data.launch_url) {
      currentLaunchUrl = data.launch_url;
      activeToken = data.token;

      // Update Sandbox boxes automatically for user convenience
      reqBoxInit.textContent = JSON.stringify({ token: activeToken }, null, 2);
      const g = allGames.find((x) => x.id === gameId);
      reqBoxSpin.textContent = JSON.stringify({ token: activeToken, bet_amount: g ? g.default_bet : 200 }, null, 2);

      gameModalTitle.textContent = `Playing: ${gameTitle}`;
      gameIframe.src = data.launch_url;
      gameModal.classList.add('active');
    } else {
      alert('Launch failed: ' + (data.message || 'Unknown error'));
    }
  } catch (e) {
    console.error('Launch game failed:', e);
    alert('Failed to connect to RGS game launch service.');
  }
}

// Fetch live audit transactions
async function fetchAuditLog() {
  try {
    const res = await fetch('/api/v1/transactions?limit=25');
    const data = await res.json();
    const txs = data.transactions || [];

    statRounds.textContent = txs.length;
    auditTableBody.innerHTML = '';

    if (txs.length === 0) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 24px; color: var(--text-dim);">
            No spins recorded yet. Launch a slot and spin to see live transactions!
          </td>
        </tr>
      `;
      return;
    }

    txs.forEach(tx => {
      const row = document.createElement('tr');
      const isWin = tx.win_amount > 0;
      const winClass = isWin ? 'tx-win-pos' : 'tx-win-zero';
      const roundShort = tx.round_id.substring(0, 8) + '...';

      row.innerHTML = `
        <td class="tx-round" title="${tx.round_id}">${roundShort}</td>
        <td><strong>${tx.game_name || tx.game_id}</strong></td>
        <td>${fmt(tx.bet_amount)}</td>
        <td class="${winClass}">${fmt(tx.win_amount)}</td>
        <td>${fmt(tx.balance_after)}</td>
        <td>${tx.is_free_spin ? '<span style="color:#ec4899;font-weight:700;">FREE SPIN</span>' : 'Standard'}</td>
        <td style="color:var(--text-dim);font-size:11px;">${tx.created_at}</td>
        <td>
          <button class="btn-inspect-tx" data-tx-id="${tx.id}">Inspect</button>
        </td>
      `;

      row.querySelector('.btn-inspect-tx').addEventListener('click', () => {
        showTxDetails(tx);
      });

      auditTableBody.appendChild(row);
    });
  } catch (e) {
    console.error('Audit fetch error:', e);
  }
}

function showTxDetails(tx) {
  txModalContent.textContent = JSON.stringify(tx, null, 2);
  txModal.classList.add('active');
}

function showNotification(msg) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #10b981;
    color: #fff;
    font-weight: 800;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    z-index: 9999;
    animation: zoomIn 0.2s ease-out;
  `;
  notif.textContent = msg;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 2500);
}

// --- API Sandbox Test Runners ---

async function runSandboxLaunch() {
  resBoxLaunch.textContent = 'Sending request...';
  try {
    const res = await fetch('/api/v1/games/launch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-token'
      },
      body: JSON.stringify({
        user_id: DEFAULT_USER_ID,
        game_id: 'pharaoh_riches'
      })
    });
    const data = await res.json();
    resBoxLaunch.textContent = JSON.stringify(data, null, 2);
    if (data.token) {
      activeToken = data.token;
      reqBoxInit.textContent = JSON.stringify({ token: activeToken }, null, 2);
      const g = allGames.find((x) => x.id === gameId);
      reqBoxSpin.textContent = JSON.stringify({ token: activeToken, bet_amount: g ? g.default_bet : 200 }, null, 2);
    }
  } catch (e) {
    resBoxLaunch.textContent = 'Error: ' + e.message;
  }
}

async function runSandboxInit() {
  if (!activeToken) {
    await runSandboxLaunch();
  }
  resBoxInit.textContent = 'Sending request...';
  try {
    const res = await fetch('/api/v1/rgs/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: activeToken })
    });
    const data = await res.json();
    resBoxInit.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    resBoxInit.textContent = 'Error: ' + e.message;
  }
}

async function runSandboxSpin() {
  if (!activeToken) {
    await runSandboxLaunch();
  }
  resBoxSpin.textContent = 'Calculating spin on RGS...';
  try {
    const res = await fetch('/api/v1/rgs/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: (() => {
        let body = { token: activeToken, bet_amount: 200 };
        try { body = { ...body, ...JSON.parse(reqBoxSpin.textContent), token: activeToken }; } catch {}
        return JSON.stringify(body);
      })()
    });
    const data = await res.json();
    resBoxSpin.textContent = JSON.stringify(data, null, 2);
    fetchBalance();
  } catch (e) {
    resBoxSpin.textContent = 'Error: ' + e.message;
  }
}

window.addEventListener('DOMContentLoaded', init);
