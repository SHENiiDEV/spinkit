/** Giant symbols: 1x3 giants on ways reels, sticky multiplier giants in free spins. */
(function () {
  const { audio } = SlotKit.util;

  function demoGiants(cfg) {
    const ids = Object.keys(cfg.giants || {});
    const out = [];
    const nonWild = ids.find((id) => !cfg.symbols[id].isWild);
    const wild = ids.find((id) => cfg.symbols[id].isWild);
    const rowsOf = (c) => (cfg.reel_heights ? cfg.reel_heights[c] : cfg.rows);
    const h = (id, c) => (cfg.giants[id].height === 'reel' ? rowsOf(c) : cfg.giants[id].height);
    if (nonWild && cfg.reels > 1) out.push({ reel: 1, top: 0, height: h(nonWild, 1), symbol: nonWild });
    if (wild && cfg.reels > 3) out.push({ reel: 3, top: Math.max(0, rowsOf(3) - h(wild, 3)), height: h(wild, 3), symbol: wild });
    return out;
  }

  const symbolName = (cfg, id) => ((cfg.symbols[id] || {}).name || id).toUpperCase();

  SlotKit.mechanic('giants', {
    createView: (g, canvas) => new SlotKit.views.GiantReelView(canvas, g.art, g.cfg, g.demoMatrix(), demoGiants(g.cfg)),
    rules(cfg) {
      const ids = Object.keys(cfg.giants || {});
      const name = (id) => `<b>${(cfg.symbols[id] || {}).name || id}</b>`;
      const fixed = ids.filter((id) => cfg.giants[id].height !== 'reel');
      const reelGiants = ids.filter((id) => cfg.giants[id].height === 'reel');
      const grid = cfg.reel_heights ? `${cfg.reel_heights.join('-')} grid (${cfg.reels} reels)` : `${cfg.reels}x${cfg.rows} grid`;
      const out = [`<p><b>${Number(cfg.ways_count).toLocaleString()} ways to win</b> on a ${grid}. Symbols pay when they appear on adjacent reels starting from the leftmost reel, in any position. Win = symbol pay × number of ways.</p>`];
      if (fixed.length) out.push(`<p><b>GIANT SYMBOLS:</b> ${fixed.map(name).join(' and ')} always land as giant symbols ${cfg.giants[fixed[0]].height} rows tall. A giant counts as one symbol on its reel.</p>`);
      if (reelGiants.length) out.push(`<p><b>FULL-REEL GIANTS:</b> ${reelGiants.map(name).join(' and ')} always covers its whole reel, whatever its height, and counts as one symbol on that reel.</p>`);
      return out;
    },

    async present(g, r) {
      const giants = r.giants || [];
      const fresh = giants.filter((x) => !(x.sticky && !x.new_sticky));
      await g.landReels(SlotKit.views.GiantReelView.tokens(r.matrix, giants), r, (c) => {
        const landed = fresh.filter((x) => x.reel === c && x.full);
        if (!landed.length) return;
        landed.forEach((x) => g.view.giantLanded(x));
        g.shake(false);
        audio().playLand(c);
      });
      g.view.giants = giants;

      // new sticky giants lock in one by one and reveal their multiplier
      g.view.onReveal = (x) => {
        g.setMessage(`STICKY ${symbolName(g.cfg, x.symbol)} <b>x${x.multiplier}</b>`, 'win');
        if (x.multiplier >= 25) {
          g.shake(true);
          audio().playTierUp();
          if (x.multiplier >= 100) g.coins.burst(60);
        } else {
          audio().playMultiplier();
        }
      };
      for (const x of giants.filter((gg) => gg.new_sticky)) {
        g.setMessage(`STICKY ${symbolName(g.cfg, x.symbol)}!`, 'win');
        if (audio().playScatterAlert) audio().playScatterAlert();
        g.shake(true);
        await g.view.lockSticky(x, g.quick || g.skipRequested);
        audio().playMultiplier();
      }

      if (g.highlightWins(r)) {
        const mults = r.winning_lines.flatMap((w) => w.giant_multipliers || []);
        if (mults.length) {
          g.view.pulseMultipliers(mults);
          audio().playMultiplier();
        }
      }
      await g.countSmallWin(r);
    }
  });
})();
