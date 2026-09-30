/** Match lines: big grid, 3+ in a row / column explode and cascade, growing win multiplier. */
(function () {
  const { $, audio, bump } = SlotKit.util;
  const DEFAULT_RULES = { base: { start: 1, step: 1 }, fs: { start: 2, step: 2 }, max: 1024 };
  const COLORS = ['#ffd23f', '#ff7a3a', '#3ddc97', '#3db7ff', '#ff5fa2', '#c77dff'];

  SlotKit.mechanic('matchlines', {
    cascading: true,
    view: 'TumbleView',
    alwaysShowMultiplier: true,
    payUnit: (cfg, bet) => bet, // paytable is x total bet
    plate: (cfg) => ({ value: `${cfg.reels}×${cfg.rows}`, label: `${cfg.min_line || 3}+ IN A LINE` }),
    rules(cfg) {
      const R = cfg.win_multiplier_rules || DEFAULT_RULES;
      return [
        `<p><b>LINE CASCADES.</b> ${cfg.min_line || 3} or more identical symbols next to each other in a <b>row or a column</b>, anywhere on the ${cfg.reels}×${cfg.rows} grid, form a line and pay (values are multiples of the total bet; longer lines pay more). WILD substitutes for all symbols except the ${((cfg.symbols.SCATTER || {}).name || 'SCATTER').toUpperCase()}. Winning symbols explode, new ones fall in and cascades continue while new lines appear.</p>`,
        `<p><b>WIN MULTIPLIER:</b> every cascade win is multiplied by the current multiplier. In the base game it starts at x${R.base.start} and grows by +${R.base.step} after every cascade (x1, x2, x3 …), resetting on the next spin. In FREE SPINS it starts at <b>x${R.fs.start}</b> and grows only in even steps of +${R.fs.step} (x2, x4, x6, x8 …); it is <b>never reset</b> until the feature ends. Maximum multiplier x${R.max}.</p>`
      ];
    },

    async present(g, r) {
      const rules = g.cfg.win_multiplier_rules || DEFAULT_RULES;
      const inFs = g.fs.active;
      const stepUp = inFs ? rules.fs.step : rules.base.step;
      if (!inFs) { g.baseMult = rules.base.start; g.updateMultPlate(); }
      await g.view.dropIn(r.matrix, g.quick, (c) => audio().playLand(c));
      await g.runCascades(r, {
        onHighlight: (step) => {
          g.view.runLines = step.wins.map((w, k) => ({ from: w.positions[0], to: w.positions[w.positions.length - 1], color: COLORS[k % COLORS.length], t0: g.view.time + k * 0.05 }));
        },
        suffix: (step) => (step.win_multiplier > 1 ? ` · x${step.win_multiplier}` : ''),
        pause: () => 750,
        beforeExplode: () => { g.view.runLines = []; },
        // the multiplier grows after every winning cascade (+1 base, +2 in free spins)
        afterCollapse: (step) => {
          const next = Math.min(rules.max, step.win_multiplier + stepUp);
          if (inFs) g.fs.totalMult = next;
          else g.baseMult = next;
          g.updateMultPlate();
          bump($('multPlate'));
          g.view.floaters.push({ x: g.view.w / 2, y: g.view.h / 2, text: `x${next}`, t0: g.view.time, scale: 2.4 });
          audio().playMultiplier();
        }
      });
      if (inFs && r.win_multiplier) { g.fs.totalMult = r.win_multiplier.end; g.updateMultPlate(); }
      await g.finishCascades(r, r.final_matrix, 4);
    }
  });
})();
