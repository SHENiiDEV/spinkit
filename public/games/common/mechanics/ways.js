/** Ways to win: classic reels, adjacent reels from the left, any row. */
SlotKit.mechanic('ways', {
  rules: (cfg) => [
    `<p><b>${Number(cfg.ways_count).toLocaleString()} ways to win.</b> Symbols pay when they appear on adjacent reels starting from the leftmost reel, in any position. Win = symbol pay × number of ways.</p>`
  ]
});
