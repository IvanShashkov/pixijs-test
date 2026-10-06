import { describe, expect, it } from 'vitest';
import { createBoard, fromRows } from './board';
import { DEFAULT_RULES } from './index';
import { findMatches } from './matches';
import { hasValidMove } from './moves';
import { reshuffle } from './reshuffle';
import { mulberry32 } from './rng';

const multiset = (cells: number[]) => [...cells].sort((a, b) => a - b);

describe('reshuffle', () => {
  // Move-less, match-less 4-colour pattern (see moves.test.ts).
  const checkerboard = fromRows(
    Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (c + 2 * r) % 4)),
  );

  it('produces a board with no matches and a valid move', () => {
    const { board } = reshuffle(checkerboard, DEFAULT_RULES, mulberry32(1));
    expect(findMatches(board)).toEqual([]);
    expect(hasValidMove(board)).toBe(true);
  });

  it('preserves the gem multiset when not falling back', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const src = createBoard(DEFAULT_RULES, mulberry32(seed));
      const { board, fallback } = reshuffle(src, DEFAULT_RULES, mulberry32(seed * 7));
      if (!fallback) expect(multiset(board.cells)).toEqual(multiset(src.cells));
      expect(findMatches(board)).toEqual([]);
      expect(hasValidMove(board)).toBe(true);
    }
  });

  it('falls back to a fresh board when attempts are exhausted', () => {
    const { board, fallback } = reshuffle(checkerboard, DEFAULT_RULES, mulberry32(1), 0);
    expect(fallback).toBe(true);
    expect(findMatches(board)).toEqual([]);
    expect(hasValidMove(board)).toBe(true);
  });

  it('is deterministic', () => {
    const a = reshuffle(checkerboard, DEFAULT_RULES, mulberry32(5));
    const b = reshuffle(checkerboard, DEFAULT_RULES, mulberry32(5));
    expect(a).toEqual(b);
  });

  it('does not mutate the input', () => {
    const before = checkerboard.cells.slice();
    reshuffle(checkerboard, DEFAULT_RULES, mulberry32(2));
    expect(checkerboard.cells).toEqual(before);
  });
});
