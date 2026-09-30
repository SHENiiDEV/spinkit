/**
 * Gravity for cascading mechanics: removed cells disappear, the symbols above fall down and new
 * symbols (from `draw(col)`) enter from the top. `draw` is called column by column, top to bottom,
 * so results are reproducible with a seeded RNG.
 */

/** Rectangular grid (rows x cols). `remove` is a Set of "r,c". */
function collapseGrid(grid, remove, draw) {
  const rows = grid.length;
  const cols = grid[0].length;
  const next = Array.from({ length: rows }, () => Array(cols).fill(''));
  for (let c = 0; c < cols; c++) {
    const survivors = [];
    for (let r = 0; r < rows; r++) if (!remove.has(`${r},${c}`)) survivors.push(grid[r][c]);
    const fresh = [];
    for (let i = survivors.length; i < rows; i++) fresh.push(draw(c));
    const column = fresh.concat(survivors);
    for (let r = 0; r < rows; r++) next[r][c] = column[r];
  }
  return next;
}

/** Columns of different heights (cols[c] = symbols top -> bottom). Heights never change. */
function collapseColumns(cols, remove, draw) {
  return cols.map((col, c) => {
    const survivors = col.filter((_, r) => !remove.has(`${r},${c}`));
    const fresh = Array.from({ length: col.length - survivors.length }, () => draw(c));
    return fresh.concat(survivors);
  });
}

/** Set of "r,c" of every position of every win. */
function winPositions(wins) {
  const set = new Set();
  wins.forEach((w) => w.positions.forEach(([r, c]) => set.add(`${r},${c}`)));
  return set;
}

const copyGrid = (grid) => grid.map((row) => row.slice());

module.exports = { collapseGrid, collapseColumns, winPositions, copyGrid };
