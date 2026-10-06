/** Flat, row-major board. `cells[r * cols + c]` is a gem id (0..gemCount-1) or -1 for empty. */
export interface Board {
  readonly rows: number;
  readonly cols: number;
  readonly cells: number[];
}

export interface Cell {
  r: number;
  c: number;
}

/** Deterministic random source in [0, 1). Every random function takes one as its last argument. */
export type Rng = () => number;

export interface ScoringRules {
  baseTile: number;
  bonus4: number;
  bonus5: number;
  comboStep: number;
  comboMax: number;
}

export interface BoardRules {
  rows: number;
  cols: number;
  gemCount: number;
  scoring: ScoringRules;
}

/** One connected set of matched cells of the same gem (L/T/+ shapes are a single group). */
export interface MatchGroup {
  gem: number;
  cells: Cell[];
}

export interface Move {
  a: Cell;
  b: Cell;
}

export interface Fall {
  from: Cell;
  to: Cell;
  gem: number;
}

export interface Spawn {
  cell: Cell;
  gem: number;
  /** Rows above row 0 where the tile starts falling from. */
  spawnOffset: number;
}

export interface CascadeStep {
  comboIndex: number;
  multiplier: number;
  matches: MatchGroup[];
  clearedCells: Cell[];
  falls: Fall[];
  spawns: Spawn[];
  scoreDelta: number;
  /** Board after clear → gravity → refill for this step. */
  board: Board;
}

export type SwapOutcome =
  | { valid: false }
  | { valid: true; swapped: Board; steps: CascadeStep[]; board: Board; totalScore: number };
