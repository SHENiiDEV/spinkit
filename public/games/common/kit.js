/**
 * SlotKit — the client's module registry (loaded first).
 *
 *   SlotKit.util        small shared helpers
 *   SlotKit.views       canvas renderers (views/*.js): GridView, ReelView, TumbleView, ...
 *   SlotKit.mechanics   one presenter per server mechanic (mechanics/*.js), registered with
 *                       SlotKit.mechanic(id, descriptor). See docs/ARCHITECTURE.md for the fields.
 *
 * slot.html loads kit.js, then views, then mechanics, then slot-engine.js (the UI shell).
 */
(function () {
  const util = {
    TAU: Math.PI * 2,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    key: (r, c) => `${r},${c}`,
    $: (id) => document.getElementById(id),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    audio: () => window.slotAudio,
    /** Restarts a CSS "bump" animation on an element. */
    bump(el, cls = 'bump') {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    },
    scatterCount: (grid) => (grid || []).flat().filter((s) => s === 'SCATTER').length
  };

  /** Defaults every mechanic descriptor inherits (a descriptor only overrides what differs). */
  const BASE = {
    cascading: false,          // true: TumbleView-style drop / explode / collapse spins
    view: 'ReelView',          // SlotKit.views class used by the default createView
    betLabel: 'BET MULTIPLIER',
    buyTitle: null,            // html of the buy button title (null = default "BUY FREE SPINS")
    wildRule: '<p><b>WILD</b> substitutes for all symbols except SCATTER.</p>',
    genericBuyRule: true,      // show the standard "BUY FREE SPINS" rule
    alwaysShowMultiplier: false,
    /** Value / label of the plate under the logo (LINES, WAYS, ...). */
    plate: (cfg) => ({ value: Number(cfg.ways_count || 0).toLocaleString(), label: 'WAYS' }),
    /** Money value of 1.0 in the paytable. */
    payUnit: (cfg, bet) => bet / cfg.bet_multiplier,
    /** Paytable rows of one symbol: [[label, multiplier], ...] highest first. */
    payRows: (cfg, id, pays) => Object.entries(pays).sort((a, b) => Number(b[0]) - Number(a[0])),
    rules: () => [],
    createView(game, canvas) {
      return new SlotKit.views[this.view](canvas, game.art, game.cfg, game.demoMatrix());
    },
    demoScreen: (game) => game.demoMatrix(),
    buyQuestion: (cfg) => {
      const fs = cfg.free_spins;
      return `Buy ${typeof fs.spins === 'object' ? fs.spins[fs.trigger] : fs.spins}+ FREE SPINS for`;
    },
    beforeSpin() {},
    async present(game, r) { return game.presentReels(r); }
  };

  window.SlotKit = {
    util,
    views: {},
    mechanics: {},
    mechanic(id, def) {
      this.mechanics[id] = { ...BASE, id, ...def };
      return this.mechanics[id];
    },
    get(id) {
      return this.mechanics[id] || this.mechanics.lines;
    }
  };
})();
