/** Megaways: 2..N symbols per reel, cascades, win multiplier +1 per cascade. */
(function () {
  const { $, audio, bump } = SlotKit.util;

  function demoColumns(cfg) {
    const ids = Object.keys(cfg.symbols).filter((s) => !['MULT', 'SCATTER', 'WILD'].includes(s));
    return [5, 3, 6, 4, 7, 4].slice(0, cfg.reels).map((h, c) => Array.from({ length: Math.min(h, cfg.rows) }, (_, r) => ids[(r * 3 + c * 2) % ids.length]));
  }

  const persistent = (g) => g.fs.active && g.cfg.free_spins && g.cfg.free_spins.persistent_multiplier;

  SlotKit.mechanic('megaways', {
    cascading: true,
    createView: (g, canvas) => new SlotKit.views.MegawaysView(canvas, g.art, g.cfg, demoColumns(g.cfg)),
    demoScreen: (g) => demoColumns(g.cfg),
    plate: (cfg) => ({ value: Number(cfg.ways_count).toLocaleString(), label: 'MEGAWAYS' }),
    rules: (cfg) => [
      `<p><b>MEGAWAYS.</b> Every reel shows 2 to ${cfg.rows} symbols, so every spin has a different number of ways — up to <b>${Number(cfg.ways_count).toLocaleString()}</b>. Symbols pay on adjacent reels from the leftmost reel, in any position. Win = symbol pay × number of ways.</p>`,
      `<p><b>CASCADES & WIN MULTIPLIER:</b> winning symbols disappear and new ones fall into place. The win multiplier starts at x1 and grows by <b>+1 after every cascade</b>. In the base game it resets on the next spin${cfg.free_spins && cfg.free_spins.persistent_multiplier ? '; in FREE SPINS it <b>never resets</b> until the feature ends' : ''}.</p>`
    ],

    async present(g, r) {
      await g.view.dropIn(r.reels, g.quick, (c) => audio().playLand(c));
      $('waysText').textContent = Number(r.ways).toLocaleString();
      $('waysLabel').textContent = 'WAYS';
      bump($('waysPlate'));
      await g.runCascades(r, {
        screens: 'reels',
        suffix: (step) => (step.win_multiplier > 1 ? ` · MULTIPLIER x${step.win_multiplier}` : ''),
        afterCollapse: (step) => {
          audio().playMultiplier(); // every cascade raises the win multiplier by 1
          if (persistent(g)) {
            g.fs.totalMult = step.win_multiplier + 1;
            g.updateMultPlate();
            bump($('multPlate'));
          }
        }
      });
      if (r.win_multiplier && persistent(g)) {
        g.fs.totalMult = r.win_multiplier.end;
        g.updateMultPlate();
      }
      await g.finishCascades(r, r.final_reels, 4);
    }
  });
})();
