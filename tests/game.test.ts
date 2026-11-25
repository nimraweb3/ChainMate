import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { move, result, tick, elo } from '../packages/game-core';
import type { GameState } from '../packages/shared/types';
function game(): GameState {
  return {
    id: 'g',
    white: 'a',
    black: 'b',
    whiteName: 'A',
    blackName: 'B',
    fen: new Chess().fen(),
    pgn: '',
    moves: [],
    revision: 0,
    status: 'active',
    outcome: null,
    reason: null,
    whiteMs: 60000,
    blackMs: 60000,
    lastTick: 1000,
    increment: 2,
    control: '1+0',
    rated: false,
    drawOffer: null,
    created: 0,
    expires: 999999,
  };
}
describe('Authoritative chess', () => {
  it('accepts legal moves and accounts for elapsed time plus increment', () => {
    const g = game();
    move(g, 'a', 'e2', 'e4', 'q', 0, 2000);
    expect(g.moves).toEqual(['e4']);
    expect(g.whiteMs).toBe(61000);
    expect(g.revision).toBe(1);
  });
  it('rejects illegal, out of turn and duplicate revisions without changing position', () => {
    const g = game();
    expect(() => move(g, 'b', 'e7', 'e5', 'q', 0, 2000)).toThrow();
    expect(() => move(g, 'a', 'e2', 'e5', 'q', 0, 2000)).toThrow();
    move(g, 'a', 'e2', 'e4', 'q', 0, 2000);
    expect(() => move(g, 'a', 'e2', 'e4', 'q', 0, 2000)).toThrow();
    expect(g.moves).toEqual(['e4']);
  });
  it('handles castling', () => {
    const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    c.move('O-O');
    expect(c.get('f1')?.type).toBe('r');
    expect(c.get('g1')?.type).toBe('k');
  });
  it('handles en passant', () => {
    const c = new Chess();
    ['e4', 'a6', 'e5', 'd5', 'exd6'].forEach((m) => c.move(m));
    expect(c.get('d5')).toBeUndefined();
    expect(c.get('d6')?.type).toBe('p');
  });
  it('permits underpromotion', () => {
    const c = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
    c.move({ from: 'a7', to: 'a8', promotion: 'n' });
    expect(c.get('a8')?.type).toBe('n');
  });
  it('recognizes mate and stalemate', () => {
    const c = new Chess();
    ['f3', 'e5', 'g4', 'Qh4#'].forEach((m) => c.move(m));
    expect(result(c)?.outcome).toBe('black');
    expect(result(new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'))?.reason).toBe('Stalemate');
  });
  it('recognizes insufficient material and repetition', () => {
    expect(result(new Chess('7k/8/8/8/8/8/8/K7 w - - 0 1'))?.outcome).toBe('draw');
    const c = new Chess();
    ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'].forEach((m) => c.move(m));
    expect(result(c)?.reason).toContain('Threefold');
  });
  it('recognizes fifty move draw', () =>
    expect(result(new Chess('7k/8/8/8/8/8/6R1/K7 w - - 100 51'))?.reason).toContain('Fifty'));
  it('expires clocks and rejects moves after finish', () => {
    const g = game();
    tick(g, 61000);
    expect(g.outcome).toBe('black');
    expect(() => move(g, 'a', 'e2', 'e4', 'q', 0, 62000)).toThrow();
  });
  it('maintains zero-sum Elo changes', () => expect(elo(1200, 1200, 1)).toEqual([1216, 1184]));
});
