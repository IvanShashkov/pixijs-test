import { at, inBounds } from './board';
import type { Board, Cell, MatchGroup } from './types';

const MIN_RUN = 3;

/** True when `cell` is part of a horizontal or vertical run of 3+ identical gems. */
export function matchesAt(b: Board, cell: Cell): boolean {
  const gem = at(b, cell.r, cell.c);
  if (gem < 0) return false;
  let run = 1;
  for (let c = cell.c - 1; c >= 0 && at(b, cell.r, c) === gem; c--) run++;
  for (let c = cell.c + 1; c < b.cols && at(b, cell.r, c) === gem; c++) run++;
  if (run >= MIN_RUN) return true;
  run = 1;
  for (let r = cell.r - 1; r >= 0 && at(b, r, cell.c) === gem; r--) run++;
  for (let r = cell.r + 1; r < b.rows && at(b, r, cell.c) === gem; r++) run++;
  return run >= MIN_RUN;
}

/**
 * All matched groups. Horizontal and vertical runs that share a cell are merged (union-find),
 * so L / T / + shapes come out as one group. Groups and their cells are sorted row-major.
 */
export function findMatches(b: Board): MatchGroup[] {
  const n = b.rows * b.cols;
  const cellRun = new Int32Array(n).fill(-1);
  const parent: number[] = [];
  const runGem: number[] = [];

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const union = (a: number, c: number) => {
    const ra = find(a);
    const rc = find(c);
    if (ra !== rc) parent[rc] = ra;
  };
  const newRun = (gem: number) => {
    const id = parent.length;
    parent.push(id);
    runGem.push(gem);
    return id;
  };

  // Horizontal runs.
  for (let r = 0; r < b.rows; r++) {
    let c = 0;
    while (c < b.cols) {
      const gem = at(b, r, c);
      let end = c + 1;
      while (end < b.cols && at(b, r, end) === gem) end++;
      if (gem >= 0 && end - c >= MIN_RUN) {
        const id = newRun(gem);
        for (let k = c; k < end; k++) cellRun[r * b.cols + k] = id;
      }
      c = end;
    }
  }
  // Vertical runs, merged into any horizontal run they cross.
  for (let c = 0; c < b.cols; c++) {
    let r = 0;
    while (r < b.rows) {
      const gem = at(b, r, c);
      let end = r + 1;
      while (end < b.rows && at(b, end, c) === gem) end++;
      if (gem >= 0 && end - r >= MIN_RUN) {
        const id = newRun(gem);
        for (let k = r; k < end; k++) {
          const i = k * b.cols + c;
          if (cellRun[i] !== -1) union(id, cellRun[i]!);
          else cellRun[i] = id;
        }
      }
      r = end;
    }
  }

  const groups = new Map<number, MatchGroup>();
  for (let i = 0; i < n; i++) {
    const run = cellRun[i]!;
    if (run === -1) continue;
    const root = find(run);
    let group = groups.get(root);
    if (!group) {
      group = { gem: runGem[root]!, cells: [] };
      groups.set(root, group);
    }
    const cell = { r: Math.floor(i / b.cols), c: i % b.cols };
    if (!inBounds(b, cell.r, cell.c)) continue;
    group.cells.push(cell);
  }
  const out = [...groups.values()];
  // Cells were visited in row-major order, so they are already sorted and unique.
  out.sort((g1, g2) => {
    const a = g1.cells[0]!;
    const c = g2.cells[0]!;
    return a.r - c.r || a.c - c.c;
  });
  return out;
}
