/** Tumble / pay anywhere: 8+ anywhere, cascades, multiplier symbols. */
(function () {
  const { sleep, audio, scatterCount } = SlotKit.util;

  SlotKit.mechanic('tumble', {
    cascading: true,
    view: 'TumbleView',
    plate: () => ({ value: '8+', label: 'PAY ANYWHERE' }),
    payUnit: (cfg, bet) => bet,
    payRows: (cfg, id, pays) => Object.entries(pays)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([n, v]) => [id === 'SCATTER' ? n : `${n}${Number(n) >= 12 ? '-30' : `-${Number(n) + 1}`}`, v]),
    rules: () => ['<p><b>Pay anywhere.</b> 8 or more identical symbols anywhere on the screen pay. After every win the winning symbols explode and new ones <b>tumble</b> into place — tumbles continue as long as new wins appear.</p>'],

    async present(g, r) {
      await g.view.dropIn(r.matrix, g.quick, (c) => audio().playLand(c));
      const scat = scatterCount(r.matrix);
      if (scat >= 3) audio().playScatterLand(scat);
      const running = await g.runCascades(r, {
        afterCollapse: (step, next) => {
          const sc = scatterCount(next);
          if (sc >= 3) audio().playScatterLand(sc);
        }
      });

      // multiplier symbols
      const m = r.multipliers;
      const multiplied = m && m.values.length && r.total_win > 0 && m.applied > 1;
      if (multiplied) {
        g.view.setHighlight(m.positions, { dim: true });
        for (const [rr, cc] of m.positions) {
          g.view.pops[`${rr},${cc}`] = g.view.time;
          audio().playMultiplier();
          await sleep(g.quick ? 120 : 280);
        }
        const label = g.fs.active && g.cfg.multipliers.mode === 'accumulate' ? `TOTAL MULTIPLIER x${m.applied}` : `MULTIPLIER x${m.applied}`;
        g.showWinBanner(running * m.applied, `${g.money.fmt(running)} × ${m.applied}`, label);
        await sleep(g.quick ? 500 : 1100);
      }
      if (g.fs.active && m) {
        g.fs.totalMult = m.total || g.fs.totalMult;
        g.updateMultPlate();
      }
      if (r.scatter_win && r.scatter_win.count >= 3) g.view.setHighlight(r.scatter_win.positions);
      if (r.total_win > 0 && r.total_win / r.bet < 10 && !multiplied) await g.countWin(r.total_win, 400);
      g.hideWinBannerLater();
    }
  });
})();
