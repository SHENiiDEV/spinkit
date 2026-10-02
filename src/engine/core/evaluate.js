/**
 * Win evaluators shared by the mechanics.
 *
 *   evaluatePaylines  fixed paylines, left to right, pays x LINE bet (total bet / bet_multiplier)
 *   evaluateWays      ways to win on columns of "objects"; an object is one symbol on a reel
 *                     ({ symbol, weight, positions, meta }). weight > 1 = multiplier (wild or giant);
 *                     win = coin x pay x product of the weights. WILD substitutes, SCATTER never pays.
 */

function evaluateLine(paytable, symbols, positions) {
  // leading wild run
  let wildRun = 0;
  while (wildRun < symbols.length && symbols[wildRun] === 'WILD') wildRun++;

  let best = null;
  const wildPay = paytable.WILD && paytable.WILD[wildRun];
  if (wildRun >= 2 && wildPay) best = { symbol: 'WILD', count: wildRun, mult: wildPay };

  const target = symbols.find((s) => s !== 'WILD');
  if (target && target !== 'SCATTER' && paytable[target]) {
    let count = 0;
    while (count < symbols.length && (symbols[count] === target || symbols[count] === 'WILD')) count++;
    const mult = paytable[target][count];
    if (mult && (!best || mult > best.mult)) best = { symbol: target, count, mult };
  }

  if (!best) return null;
  return { ...best, positions: positions.slice(0, best.count) };
}

function evaluatePaylines(game, matrix, bet, wildMults = {}) {
  const lineBet = bet / game.bet_multiplier;
  const wins = [];
  game.paylines.forEach((rows, idx) => {
    const positions = rows.map((r, c) => [r, c]);
    const res = evaluateLine(game.paytable, positions.map(([r, c]) => matrix[r][c]), positions);
    if (res) {
      let lineMult = 1;
      res.positions.forEach(([r, c]) => {
        if (wildMults[`${r},${c}`]) lineMult *= wildMults[`${r},${c}`];
      });
      const payout = Math.floor(lineBet * res.mult * lineMult);
      wins.push({
        line_index: idx + 1,
        symbol: res.symbol,
        count: res.count,
        positions: res.positions,
        multiplier: res.mult,
        ...(lineMult > 1 ? { wild_multiplier: lineMult } : {}),
        payout
      });
    }
  });
  return wins;
}

/** One object per cell of a rectangular matrix; `weightAt(r, c)` gives wild multipliers. */
function cellColumns(matrix, weightAt = () => 1) {
  const rows = matrix.length;
  return matrix[0].map((_, c) => Array.from({ length: rows }, (__, r) => ({ symbol: matrix[r][c], weight: matrix[r][c] === 'WILD' ? weightAt(r, c) : 1, positions: [[r, c]] })));
}

/**
 * @param columns  columns[c] = objects on reel c
 * @param coin     coin value (total bet / bet_multiplier)
 * @param opts.minReels   adjacent reels needed (default 3)
 * @param opts.decorate   (win, metas) => extra fields; metas = `meta` of every counted object
 * @param opts.scale      whole-number factor applied after rounding (e.g. a cascade multiplier)
 */
function evaluateWays(game, columns, coin, { minReels = 3, decorate = null, scale = 1 } = {}) {
  const wins = [];
  for (const symbol of Object.keys(game.paytable)) {
    if (symbol === 'SCATTER' || symbol === 'WILD') continue;
    let ways = 1;
    let reels = 0;
    let natural = false;
    const positions = [];
    const metas = [];
    for (const objects of columns) {
      let weight = 0;
      for (const o of objects) {
        if (o.symbol !== symbol && o.symbol !== 'WILD') continue;
        weight += o.weight;
        positions.push(...o.positions);
        if (o.symbol === symbol) natural = true;
        if (o.meta) metas.push(o.meta);
      }
      if (!weight) break;
      ways *= weight;
      reels++;
    }
    const pay = game.paytable[symbol][reels];
    if (!natural || reels < minReels || !pay) continue;
    const win = { line_index: null, symbol, count: reels, ways, positions, multiplier: pay, payout: Math.floor(coin * pay * ways) * scale };
    wins.push(decorate ? { ...win, ...decorate(win, metas) } : win);
  }
  return wins.sort((a, b) => b.payout - a.payout);
}

const totalPayout = (wins) => wins.reduce((s, w) => s + w.payout, 0);

module.exports = { evaluateLine, evaluatePaylines, cellColumns, evaluateWays, totalPayout };
