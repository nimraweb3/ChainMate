import { Chess } from 'chess.js';
import type { GameState, Outcome } from '../shared/types';
export function position(game: Pick<GameState, 'pgn' | 'fen'>) {
  const c = new Chess();
  if (game.pgn) c.loadPgn(game.pgn);
  else c.load(game.fen);
  return c;
}
export function result(c: Chess): { outcome: Outcome; reason: string } | null {
  if (c.isCheckmate())
    return { outcome: c.turn() === 'w' ? 'black' : 'white', reason: 'Checkmate' };
  if (c.isStalemate()) return { outcome: 'draw', reason: 'Stalemate' };
  if (c.isInsufficientMaterial()) return { outcome: 'draw', reason: 'Insufficient material' };
  if (c.isThreefoldRepetition())
    return { outcome: 'draw', reason: 'Threefold repetition (automatic club rule)' };
  if (c.isDrawByFiftyMoves())
    return { outcome: 'draw', reason: 'Fifty-move rule (automatic club rule)' };
  return null;
}
export function tick(g: GameState, now: number) {
  if (g.status !== 'active') return;
  const c = position(g);
  const key = c.turn() === 'w' ? 'whiteMs' : 'blackMs';
  g[key] = Math.max(0, g[key] - Math.max(0, now - g.lastTick));
  g.lastTick = now;
  if (g[key] === 0) {
    g.status = 'finished';
    const winnerColor = c.turn() === 'w' ? 'b' : 'w';
    const winnerHasPiece = c
      .board()
      .flat()
      .some((p) => p?.color === winnerColor && p.type !== 'k');
    g.outcome =
      c.isInsufficientMaterial() || !winnerHasPiece ? 'draw' : c.turn() === 'w' ? 'black' : 'white';
    g.reason = 'Time expired';
  }
}
export function move(
  g: GameState,
  user: string,
  from: string,
  to: string,
  promotion: string,
  revision: number,
  now: number,
) {
  if (g.status !== 'active') throw Error('This game is not active.');
  if (revision !== g.revision)
    throw Error('Position changed. Please retry from the current board.');
  const c = position(g);
  if ((c.turn() === 'w' ? g.white : g.black) !== user) throw Error('It is not your turn.');
  // Validate before mutating clocks or state.
  c.move({ from, to, promotion });
  tick(g, now);
  if ((g.status as string) === 'finished') return;
  g[c.turn() === 'b' ? 'whiteMs' : 'blackMs'] += g.increment * 1000;
  g.fen = c.fen();
  g.pgn = c.pgn();
  g.moves = c.history();
  g.revision++;
  g.drawOffer = null;
  const end = result(c);
  if (end) {
    g.status = 'finished';
    Object.assign(g, end);
  }
}
export function elo(a: number, b: number, score: number, k = 32) {
  const delta = Math.round(k * (score - 1 / (1 + 10 ** ((b - a) / 400))));
  return [a + delta, b - delta];
}
