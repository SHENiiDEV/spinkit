/** Hold & Win: paylines + money coins; 6+ coins start the respin bonus with jackpots. */
(function () {
  const { $, sleep, audio, bump } = SlotKit.util;

  SlotKit.mechanic('holdwin', {
    plate: (cfg) => ({ value: cfg.paylines_count, label: 'LINES' }),
    buyTitle: 'BUY<br>HOLD &amp; WIN',
    buyQuestion: () => 'Buy the HOLD & WIN bonus (6 coins) for',
    wildRule: '<p><b>WILD</b> substitutes for all symbols except MOON COINS.</p>',
    genericBuyRule: false,
    createView(g, canvas) {
      const view = new SlotKit.views.HoldWinView(canvas, g.art, g.cfg, g.demoMatrix());
      view.fmtCoin = (coin) => g.fmtShort(g.bet * coin.v);
      return view;
    },
    rules(cfg, { bet, fmt }) {
      const h = cfg.holdwin || {};
      const jp = h.jackpots || {};
      const f = (x) => fmt(Math.floor(bet * x));
      const nm = (k) => (h.jackpot_names && h.jackpot_names[k]) || k;
      const fs = cfg.free_spins;
      const out = [
        `<p>All wins pay on <b>${cfg.paylines_count} fixed lines</b> from the leftmost reel. Line wins are multiplied by the line bet (total bet ÷ ${cfg.bet_multiplier}). MOON COINS do not pay on lines — every coin shows a cash value.</p>`,
        `<p><b>HOLD & WIN:</b> ${h.trigger || 6} or more coins anywhere start the bonus. The coins lock in place and you get <b>${h.respins || 3} respins</b>; every new coin locks too and resets the respins to ${h.respins || 3}. The bonus ends when the respins run out or all ${cfg.reels * cfg.rows} positions are filled. All coin values are then paid.</p>`,
        `<p><b>JACKPOT COINS:</b> ${nm('MINI')} ${f(jp.MINI || 0)}, ${nm('MINOR')} ${f(jp.MINOR || 0)}, ${nm('MAJOR')} ${f(jp.MAJOR || 0)}. Fill all ${cfg.reels * cfg.rows} positions to win the <b>${nm('GRAND')} ${f(jp.GRAND || 0)}</b> on top of all coins.</p>`,
        '<p><b>COLLECTOR</b> coins (bonus only) add up the values of all coins on screen and keep the total. <b>BOOSTER</b> coins double the value of every coin already on screen.</p>'
      ];
      if (fs && fs.buy_cost) out.push(`<p><b>BUY HOLD & WIN:</b> the bonus can be bought instantly with ${h.trigger || 6} coins for ${fs.buy_cost}x total bet (${fmt(bet * fs.buy_cost)}).</p>`);
      return out;
    },

    async present(g, r) {
      const coinsByCol = {};
      Object.keys(r.coins || {}).forEach((k) => { const c = Number(k.split(',')[1]); coinsByCol[c] = (coinsByCol[c] || 0) + 1; });
      let seen = 0;
      await g.landReels(r.matrix, null, (c) => {
        // reveal the coin values reel by reel
        for (const [k, coin] of Object.entries(r.coins || {})) {
          if (Number(k.split(',')[1]) !== c) continue;
          g.view.coins[k] = coin;
          g.view.pops[k] = g.view.time;
        }
        if (coinsByCol[c]) {
          seen += coinsByCol[c];
          audio().playScatterLand(Math.min(5, Math.max(1, seen - 2)));
        }
      });
      const lineWin = r.winning_lines.reduce((s, w) => s + w.payout, 0);
      if (lineWin > 0) {
        g.view.setHighlight(r.winning_lines.flatMap((w) => w.positions));
        audio().playLineWin(Math.min(5, r.winning_lines.length));
        if (!r.holdwin) await g.countWin(lineWin, lineWin / r.bet >= 3 ? 1100 : 500);
      }
      if (r.holdwin) await playBonus(g, r, lineWin);
    }
  });

  async function playBonus(g, r, lineWin) {
    const hw = r.holdwin;
    const cfgHw = g.cfg.holdwin || { respins: 3 };
    const coinPos = Object.keys(hw.start);
    g.view.setHighlight(coinPos.map((k) => k.split(',').map(Number)), { dim: true });
    audio().playFreeSpinsTrigger();
    await sleep(g.quick ? 500 : 1200);
    await g.featureScreen({ kicker: 'HOLD & WIN!', line1: `${coinPos.length} COINS LOCKED`, big: String(cfgHw.respins), line2: 'RESPINS · EVERY NEW COIN RESETS THEM', btn: 'START', auto: true });
    g.view.enterBonus(hw.start);
    $('app').classList.add('fs-mode');
    const label = $('fsCounter').querySelector('span');
    const oldLabel = label.textContent;
    label.textContent = 'RESPINS';
    $('fsCounterValue').textContent = cfgHw.respins;
    $('fsCounter').classList.add('show');
    g.setMessage('HOLD & WIN');
    for (const step of hw.steps) {
      g.view.setBonusSpinning(true);
      audio().startReelSpin();
      await sleep(g.skipRequested ? 150 : (g.quick ? 380 : 800));
      g.view.setBonusSpinning(false);
      audio().stopReelSpin();
      const landed = Object.entries(step.landed);
      for (const [k, coin] of landed) {
        g.view.landCoin(k, coin.special === 'COLLECT' ? { v: 0, special: 'COLLECT' } : coin);
        audio().playScatterLand(Math.min(5, 1 + Object.keys(g.view.bonus.grid).length / 4));
        await sleep(g.quick ? 80 : 180);
      }
      for (const ev of step.events) {
        if (ev.type === 'collect') {
          g.setMessage(`COLLECTOR <b>${g.money.fmt(Math.floor(r.bet * ev.value))}</b>`, 'win');
          audio().playMultiplier();
          await g.view.collectAnim(ev.at, ev.value);
        } else if (ev.type === 'boost') {
          g.setMessage('BOOSTER <b>ALL COINS x2</b>', 'win');
          audio().playTierUp();
          g.shake(true);
          await g.view.boostAnim();
          g.view.syncGrid(step.grid);
        }
      }
      g.view.syncGrid(step.grid);
      $('fsCounterValue').textContent = step.respins_left;
      if (landed.length) bump($('fsCounter'));
      const sumX = Object.values(step.grid).reduce((s, c) => s + c.v, 0);
      g.setMessage(`HOLD & WIN · ${Object.keys(step.grid).length} / ${g.cfg.reels * g.cfg.rows} · <b>${g.money.fmt(Math.floor(r.bet * sumX))}</b>`, 'win');
      await sleep(g.skipRequested ? 60 : (g.quick ? 150 : 350));
    }
    if (hw.full) {
      const gname = (cfgHw.jackpot_names && cfgHw.jackpot_names.GRAND) || 'GRAND';
      g.setMessage(`<b>${gname} JACKPOT ${g.money.fmt(Math.floor(r.bet * hw.grand_x))}</b>`, 'win');
      g.shake(true);
      audio().playBigWin();
      g.coins.burst(80);
      await sleep(1600);
    }
    // collect every coin into the bonus total, reel by reel
    const keys = Object.keys(hw.grid).sort((a, b) => { const [ra, ca] = a.split(',').map(Number); const [rb, cb] = b.split(',').map(Number); return ca - cb || ra - rb; });
    let sum = lineWin;
    for (const k of keys) {
      sum += Math.floor(r.bet * hw.grid[k].v);
      const [rr, cc] = k.split(',').map(Number);
      g.view.bonus.pops[k] = g.view.time;
      g.view.burst(rr, cc, '#ffd23f', 8);
      g.showWinBanner(Math.min(sum, r.total_win), '', 'HOLD & WIN');
      audio().playTick();
      await sleep(g.skipRequested ? 20 : (g.quick ? 60 : 120));
    }
    g.showWinBanner(r.total_win, '', 'HOLD & WIN');
    await sleep(g.quick ? 700 : 1500);
    g.view.exitBonus();
    $('app').classList.remove('fs-mode');
    $('fsCounter').classList.remove('show');
    label.textContent = oldLabel;
    g.hideWinBanner();
  }
})();
