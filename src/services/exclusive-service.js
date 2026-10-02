/**
 * SpinKit Exclusive — stateful round games (step crash: Apple Shooter, …).
 *
 * Unlike slots (one request = one finished round), a round here spans several requests:
 *
 *   POST /api/v1/rgs/action { token, action: 'start',   bet, mode }
 *   POST /api/v1/rgs/action { token, action: 'shoot',   side_bets: { bullseye: 20, … }, helmet: true, expect_shot: 0 }
 *   POST /api/v1/rgs/action { token, action: 'cashout' }
 *   POST /api/v1/rgs/action { token, action: 'seed',    client_seed }   rotate seeds, reveal the old server seed
 *   POST /api/v1/rgs/action { token, action: 'skin',    skin }
 *
 * Money moves immediately (bet on start, side bets / helmet on each shot, side wins on each shot,
 * cash-out on cashout). One rgs_transactions row is written when the round settles, with every
 * shot, wager and fair hash in `details`. An unfinished round survives reloads (returned by init).
 *
 * Per player & game the state lives in game_states.active_bonus_data:
 *   { pf: { server_seed, server_seed_hash, client_seed, nonce }, round, stats: { shots, rounds }, skin, revenge }
 */
const crypto = require('node:crypto');
const { dbService } = require('../db/database');
const merchants = require('./merchants');
const players = require('./players');
const jackpots = require('./jackpots');
const { currencyInfo } = require('./currency');
const { ApiError, bad } = require('./errors');
const sc = require('../engine/exclusive/step-crash');

const db = () => dbService.db;

const isExclusive = (game) => !!game && game.kind === 'exclusive';

// ------------------------------------------------------------------ state
function loadState(userId, gameId) {
  const row = dbService.getGameState(userId, gameId);
  let st = {};
  try { st = row.active_bonus_data ? JSON.parse(row.active_bonus_data) : {}; } catch { st = {}; }
  if (!st.pf || !st.pf.server_seed) {
    const server = sc.newServerSeed();
    st.pf = { server_seed: server, server_seed_hash: sc.hashSeed(server), client_seed: sc.newClientSeed(), nonce: 0 };
  }
  st.stats = st.stats || { shots: 0, rounds: 0 };
  st.skin = st.skin || 'classic';
  st.round = st.round || null;
  st.revenge = st.revenge || null;
  return st;
}

function saveState(userId, gameId, st) {
  dbService.getGameState(userId, gameId);
  db().prepare('UPDATE game_states SET active_bonus_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND game_id = ?')
    .run(JSON.stringify(st), userId, gameId);
}

const unlockedSkins = (game, st) => game.crash.skins.filter((s) => st.stats.shots >= s.shots).map((s) => s.id);

function revengeView(game, st) {
  const r = st.revenge;
  if (!r || Date.now() > r.until) return null;
  return { bet_max: r.bet, expires_at: new Date(r.until).toISOString(), seconds_left: Math.ceil((r.until - Date.now()) / 1000), boost: game.crash.revenge.boost, from_level: r.level };
}

function roundView(game, round) {
  if (!round) return null;
  return {
    round_id: round.id,
    mode: round.mode,
    bet: round.bet,
    boost: round.boost,
    nonce: round.nonce,
    level: round.level,
    levels: game.crash.distances.length,
    multiplier: round.level > 0 ? sc.round2(round.multiplier) : null,
    cashout_value: round.level > 0 ? sc.payoutOf(round.bet, round.multiplier, game.max_win_x) : 0,
    side_staked: round.side_staked,
    side_won: round.side_won,
    helmets: round.helmets,
    shots: round.shots
  };
}

function pfView(st) {
  return { server_seed_hash: st.pf.server_seed_hash, client_seed: st.pf.client_seed, nonce: st.pf.nonce };
}

function context(token) {
  const gameService = require('./game-service'); // lazy: game-service delegates back to us
  const { session, merchant, player } = gameService.loadSession(token);
  const eff = merchants.effective(merchant, session.game_id, undefined, session);
  let game = eff.game;
  if (eff.max_win_x && eff.max_win_x !== game.max_win_x) { game = Object.create(game); game.max_win_x = eff.max_win_x; }
  if (!isExclusive(game)) throw bad('NOT_EXCLUSIVE', 'This game is played with /rgs/spin');
  return { session, merchant, player, eff, game, gameService };
}

// ------------------------------------------------------------------ init
function init(token) {
  const { session, merchant, player, eff, game, gameService } = context(token);
  const st = dbService.tx(() => {
    const s = loadState(player.id, game.id);
    saveState(player.id, game.id, s);
    return s;
  });
  db().prepare('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(player.id);
  return {
    user: { user_id: player.id, external_id: player.external_id, username: player.username, balance: players.byId(player.id).balance },
    game_config: { ...gameService.publicGameConfig(game, eff, merchant), kind: 'exclusive' },
    provably_fair: pfView(st),
    round: roundView(game, st.round),
    next: st.round ? sc.quote(game, st.round, st.pf) : null,
    stats: st.stats,
    skin: st.skin,
    skins_unlocked: unlockedSkins(game, st),
    revenge: revengeView(game, st),
    session: {
      test_mode: !!session.test_mode,
      lobby_url: session.lobby_url || null,
      refill_enabled: !!merchant.demo_refill,
      expires_at: new Date(session.expires_at).toISOString()
    },
    jackpots: jackpots.ticker(merchant),
    currency: currencyInfo(merchant.currency)
  };
}

// ------------------------------------------------------------------ actions
function action(token, body = {}) {
  const ctx = context(token);
  const fn = ACTIONS[body.action];
  if (!fn) throw bad('UNKNOWN_ACTION', `action must be one of ${Object.keys(ACTIONS).join(', ')}`);
  return dbService.tx(() => {
    const user = players.byId(ctx.player.id);
    const st = loadState(user.id, ctx.game.id);
    const out = fn({ ...ctx, user, st, token }, body);
    saveState(user.id, ctx.game.id, st);
    const balance = players.byId(user.id).balance;
    return {
      status: 'success',
      action: body.action,
      ...out,
      balance,
      round: roundView(ctx.game, st.round),
      next: st.round ? sc.quote(ctx.game, st.round, st.pf) : null,
      provably_fair: pfView(st),
      stats: st.stats,
      skin: st.skin,
      skins_unlocked: unlockedSkins(ctx.game, st),
      revenge: revengeView(ctx.game, st)
    };
  });
}

function setBalance(userId, balance) {
  db().prepare('UPDATE users SET balance = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(balance, userId);
}

function start({ game, eff, merchant, user, st, session }, { bet: betIn, mode: modeIn }) {
  if (st.round) throw new ApiError(409, 'ROUND_IN_PROGRESS', 'Finish the current round first (shoot or cash out).');
  if (!eff.enabled) throw new ApiError(403, 'GAME_DISABLED', 'Game is disabled for this merchant');
  const cfg = game.crash;
  const bet = Number(betIn);
  if (!bet || !eff.bet_steps.includes(bet)) throw bad('INVALID_BET', 'Ставка не соответствует сетке ставок.', { allowed_steps: eff.bet_steps });
  const mode = modeIn || cfg.default_mode;
  if (!cfg.modes[mode]) throw bad('INVALID_MODE', `mode must be one of ${Object.keys(cfg.modes).join(', ')}`);
  if (user.balance < bet) throw bad('INSUFFICIENT_FUNDS', 'Недостаточно средств.', { balance: user.balance, required: bet });

  let boost = 1;
  const rv = st.revenge;
  if (rv && Date.now() <= rv.until && bet <= rv.bet) {
    boost = cfg.revenge.boost;
    st.revenge = null;
  } else if (rv && Date.now() > rv.until) {
    st.revenge = null;
  }

  const roundId = crypto.randomUUID();
  const jpWins = jackpots.contribute(merchant, bet, { userId: user.id, gameId: game.id, roundId });
  const jpTotal = jpWins.reduce((s, w) => s + w.amount, 0);
  setBalance(user.id, user.balance - bet + jpTotal);

  st.round = {
    id: roundId,
    mode,
    bet,
    boost,
    nonce: st.pf.nonce,
    client_seed: st.pf.client_seed,
    server_seed_hash: st.pf.server_seed_hash,
    rtp_profile: eff.rtp_profile,
    started_at: new Date().toISOString(),
    balance_before: user.balance,
    level: 0,
    multiplier: cfg.rtp * boost,
    shot_index: 0,
    shots: [],
    side_staked: 0,
    side_won: 0,
    helmets: 0,
    jackpot_win: jpTotal,
    jackpot_wins: jpWins,
    session_token: session.token,
    test_mode: !!session.test_mode
  };
  st.pf.nonce += 1;
  return { started: true, boost, jackpot_wins: jpWins };
}

function shoot({ game, eff, merchant, user, st }, body) {
  const round = st.round;
  if (!round) throw new ApiError(409, 'NO_ROUND', 'Start a round first.');
  if (body.expect_shot != null && Number(body.expect_shot) !== round.shot_index) {
    throw new ApiError(409, 'STALE_SHOT', 'This shot was already played.', { shot_index: round.shot_index });
  }
  const cfg = game.crash;
  const q = sc.quote(game, round, { server_seed: st.pf.server_seed, client_seed: round.client_seed });

  // wagers for this shot
  const sideIn = body.side_bets && typeof body.side_bets === 'object' ? body.side_bets : {};
  const sides = [];
  for (const [id, amtIn] of Object.entries(sideIn)) {
    const amount = Number(amtIn);
    if (!amount) continue;
    if (!(id in cfg.side_bets)) throw bad('INVALID_SIDE_BET', `Unknown side bet ${id}`);
    if (!q.side_bets[id]) throw bad('SIDE_BET_UNAVAILABLE', `${cfg.side_bets[id].label} is not offered on this shot`);
    if (!Number.isInteger(amount) || amount < eff.bet_steps[0] || amount > round.bet) {
      throw bad('INVALID_SIDE_BET_AMOUNT', `Side bet must be ${eff.bet_steps[0]}…${round.bet} (minor units)`);
    }
    sides.push({ id, stake: amount, odds: q.side_bets[id] });
  }
  const helmet = !!body.helmet;
  if (helmet && q.helmet_price == null) throw bad('HELMET_UNAVAILABLE', `The helmet is available from level ${cfg.helmet.from_level}`);
  const cost = sides.reduce((s, x) => s + x.stake, 0) + (helmet ? q.helmet_price : 0);
  if (user.balance < cost) throw bad('INSUFFICIENT_FUNDS', 'Недостаточно средств.', { balance: user.balance, required: cost });

  // the fair shot
  const h = sc.shotHash(st.pf.server_seed, round.client_seed, round.nonce, round.shot_index);
  const outcome = sc.outcomeOf(cfg, q.chance, h.u);
  let sideWin = 0;
  for (const s of sides) {
    s.won = cfg.side_bets[s.id].wins_on.includes(outcome);
    s.win = s.won ? Math.min(Math.floor(s.stake * s.odds), s.stake * game.max_win_x) : 0;
    sideWin += s.win;
  }
  setBalance(user.id, user.balance - cost + sideWin);
  round.side_staked += sides.reduce((s, x) => s + x.stake, 0);
  round.side_won += sideWin;
  if (helmet) round.helmets += q.helmet_price;

  const lethal = outcome === 'lethal';
  const saved = lethal && helmet;
  const shot = {
    i: round.shot_index,
    level: q.level,
    wind: q.wind,
    wind_tier: q.wind_tier,
    chance: q.chance,
    u: h.u,
    hash: h.hex,
    outcome,
    saved,
    helmet: helmet ? q.helmet_price : 0,
    side_bets: sides,
    aim: sanitizeAim(body.aim)
  };
  round.shots.push(shot);
  round.shot_index += 1;

  let settled = null;
  if (saved) {
    round.multiplier *= cfg.helmet.keep;
  } else if (lethal) {
    if (q.level >= cfg.revenge.min_level) {
      st.revenge = { until: Date.now() + cfg.revenge.window_sec * 1000, bet: round.bet, level: q.level };
    }
    settled = settle({ game, merchant, user, st }, 'lethal', 0);
  } else {
    round.level = q.level;
    round.multiplier /= q.chance;
    st.stats.shots += 1;
    shot.multiplier = sc.round2(round.multiplier);
    const pay = sc.payoutOf(round.bet, round.multiplier, game.max_win_x);
    if (round.level >= cfg.distances.length) settled = settle({ game, merchant, user, st }, 'top', pay);
    else if (pay >= round.bet * game.max_win_x) settled = settle({ game, merchant, user, st }, 'max_win', pay);
  }
  return { shot: { ...shot, side_win: sideWin, cost }, settled };
}

function cashout({ game, merchant, user, st }) {
  const round = st.round;
  if (!round) throw new ApiError(409, 'NO_ROUND', 'No round in progress.');
  if (round.level < 1) throw bad('NOTHING_TO_CASH_OUT', 'Clear at least one shot before cashing out.');
  const pay = sc.payoutOf(round.bet, round.multiplier, game.max_win_x);
  return { settled: settle({ game, merchant, user, st }, 'cashout', pay) };
}

/** Pays the main line, writes the round row and clears the round. */
function settle({ game, merchant, user, st }, end, payout) {
  const round = st.round;
  const now = players.byId(user.id).balance;
  const balanceAfter = now + payout;
  setBalance(user.id, balanceAfter);
  const multiplier = payout > 0 ? sc.round2(round.multiplier) : 0;
  const totalBet = round.bet + round.side_staked + round.helmets;
  const totalWin = payout + round.side_won;
  dbService.recordTransaction({
    round_id: round.id,
    user_id: user.id,
    game_id: game.id,
    bet_amount: totalBet,
    win_amount: totalWin + round.jackpot_win,
    balance_before: round.balance_before,
    balance_after: balanceAfter,
    matrix: round.shots.map((s) => [s.level, s.outcome, s.wind]),
    winning_lines: round.shots.flatMap((s) => s.side_bets.filter((b) => b.won).map((b) => ({ symbol: b.id, count: s.level, positions: [], multiplier: b.odds, payout: b.win }))),
    is_free_spin: false,
    merchant_id: merchant.id,
    rtp_profile: round.rtp_profile,
    jackpot_win: round.jackpot_win,
    bet_type: 'step_crash',
    session_token: round.session_token,
    test_mode: round.test_mode,
    details: {
      bet: round.bet,
      game_win: totalWin,
      mode: round.mode,
      boost: round.boost,
      end,
      level: round.level,
      cashout_multiplier: multiplier,
      cashout_win: payout,
      side_staked: round.side_staked,
      side_won: round.side_won,
      helmets: round.helmets,
      jackpot_wins: round.jackpot_wins,
      provably_fair: { server_seed_hash: round.server_seed_hash, client_seed: round.client_seed, nonce: round.nonce },
      shots: round.shots
    }
  });
  if (round.session_token) db().prepare('UPDATE session_tokens SET spins = spins + 1 WHERE token = ?').run(round.session_token);
  st.stats.rounds += 1;
  st.round = null;
  return {
    round_id: round.id, end, level: round.level, multiplier, win: payout, side_won: round.side_won, total_bet: totalBet, total_win: totalWin,
    mode: round.mode, nonce: round.nonce, client_seed: round.client_seed, server_seed_hash: round.server_seed_hash, shots: round.shots
  };
}

function seed({ st }, { client_seed: clientSeed }) {
  if (st.round) throw new ApiError(409, 'ROUND_IN_PROGRESS', 'Seeds can be changed between rounds only.');
  if (clientSeed != null && !/^[\w-]{1,64}$/.test(String(clientSeed))) throw bad('INVALID_CLIENT_SEED', 'client_seed: 1-64 letters, digits, _ or -');
  const revealed = { ...st.pf, rounds_played: st.pf.nonce };
  const server = sc.newServerSeed();
  st.pf = { server_seed: server, server_seed_hash: sc.hashSeed(server), client_seed: clientSeed ? String(clientSeed) : sc.newClientSeed(), nonce: 0 };
  return { revealed };
}

function skin({ game, st }, { skin: id }) {
  if (!unlockedSkins(game, st).includes(id)) throw bad('SKIN_LOCKED', 'This skin is not unlocked yet');
  st.skin = id;
  return {};
}

function sanitizeAim(aim) {
  if (!aim || typeof aim !== 'object') return null;
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 1000) / 1000 : null);
  return { angle: n(aim.angle), power: n(aim.power) }; // cosmetic: logged only, never used by the math
}

const ACTIONS = { start, shoot, cashout, seed, skin };

module.exports = { isExclusive, init, action };
