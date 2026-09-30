/** Paylines: classic reels, wins on fixed lines. */
SlotKit.mechanic('lines', {
  betLabel: 'LINES',
  plate: (cfg) => ({ value: cfg.paylines_count, label: 'LINES' }),
  rules: (cfg) => [
    `<p>All wins pay on <b>${cfg.paylines_count} fixed lines</b> from the leftmost reel to the right. Only the highest win per line is paid. Line wins are multiplied by the line bet (total bet ÷ ${cfg.bet_multiplier}).</p>`
  ]
});
