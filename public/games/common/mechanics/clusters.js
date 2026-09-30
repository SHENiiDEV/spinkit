/** Cluster pays + multiplier spots (x2 .. x1024 on cells where symbols exploded twice). */
(function () {
  const { sleep, audio } = SlotKit.util;

  SlotKit.mechanic('clusters', {
    cascading: true,
    view: 'TumbleView',
    wildRule: null,
    plate: (cfg) => ({ value: `${cfg.min_cluster || 5}+`, label: 'CLUSTER PAYS' }),
    payUnit: (cfg, bet) => bet,
    payRows: (cfg, id, pays) => {
      const rows = Object.entries(pays).sort((a, b) => Number(b[0]) - Number(a[0]));
      if (id === 'SCATTER') return rows;
      return rows
        .filter(([n], i, arr) => [15, 12, 10, 8, 5].includes(Number(n)) || arr.length <= 5)
        .map(([n, v], i) => [i === 0 ? `${n}+` : n, v]);
    },
    rules(cfg) {
      const max = (cfg.spots && cfg.spots.max) || 1024;
      return [
        `<p><b>CLUSTER PAYS.</b> ${cfg.min_cluster || 5} or more identical symbols connected horizontally or vertically form a cluster and pay (values are multiples of the total bet). Winning symbols explode and new ones <b>tumble</b> in; tumbles continue while new clusters appear.</p>`,
        `<p><b>MULTIPLIER SPOTS:</b> every cell where a winning symbol explodes gets <b>marked</b>. When a winning symbol explodes on a marked cell again, it becomes a multiplier spot <b>x2</b>, and every further hit doubles it — x4, x8, x16 … up to <b>x${max}</b>. A cluster win is multiplied by the sum of all multiplier spots under the cluster. In the base game spots reset after every spin${cfg.free_spins && cfg.free_spins.sticky_spots ? '; in FREE SPINS they stay on the grid for the whole feature' : ''}.</p>`
      ];
    },
    beforeSpin(g, { inFs }) {
      if (!inFs) g.view.setSpots({});
    },

    async present(g, r) {
      await g.view.dropIn(r.matrix, g.quick, (c) => audio().playLand(c));
      const boostedOf = (step) => step.wins.filter((w) => w.spot_multiplier > 1);
      await g.runCascades(r, {
        beforeHighlight: (step) => g.view.setSpots(step.spots_before),
        onHighlight: (step) => {
          const boosted = boostedOf(step);
          if (!boosted.length) return;
          boosted.forEach((w) => (w.spot_cells || []).forEach(([rr, cc]) => { g.view.spotFx[`${rr},${cc}`] = g.view.time; }));
          audio().playMultiplier();
        },
        floater: (w) => (w.spot_multiplier > 1 ? `${g.money.fmt(w.payout)} ×${w.spot_multiplier}` : g.money.fmt(w.payout)),
        suffix: (step) => {
          const best = boostedOf(step).reduce((m, w) => Math.max(m, w.spot_multiplier), 0);
          return best ? ` · SPOT x${best}` : '';
        },
        pause: (step) => (boostedOf(step).length ? 950 : 700),
        // cells get marked / multiplier spots double where symbols exploded
        afterExplode: async (step) => {
          const upgraded = Object.entries(step.spots_after).some(([k, v]) => v >= 2 && (step.spots_before[k] || 0) !== v);
          g.view.setSpots(step.spots_after, true);
          if (upgraded) audio().playTierUp();
          await sleep(g.quick ? 120 : 320);
        },
        settle: 140
      });
      if (r.spots) g.view.setSpots(r.spots);
      await g.finishCascades(r, r.final_matrix || r.matrix, 3);
    }
  });
})();
