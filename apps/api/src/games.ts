import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { controls, type Control, type GameState, type User } from '../../../packages/shared/types';
import { elo, move, tick } from '../../../packages/game-core';
import type { Database } from './db';
export class Games {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(public db: Database) {}
  serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => {});
    return run;
  }
  async get(id: string) {
    return (await this.db.query<{ state: GameState }>('SELECT state FROM games WHERE id=$1', [id]))
      .rows[0]?.state;
  }
  async save(g: GameState) {
    await this.db.transaction(async (tx) => {
      await tx.query('UPDATE games SET state=$2::jsonb WHERE id=$1', [g.id, JSON.stringify(g)]);
      if (g.status === 'finished' && g.rated && g.black) {
        const changed = await tx.query(
          'UPDATE games SET rated_applied=true WHERE id=$1 AND rated_applied=false RETURNING id',
          [g.id],
        );
        if (changed.rows.length) {
          const users = await tx.query<User>(
            'SELECT id,rating FROM users WHERE id=$1 OR id=$2 FOR UPDATE',
            [g.white, g.black],
          );
          const w = users.rows.find((u) => u.id === g.white)!;
          const b = users.rows.find((u) => u.id === g.black)!;
          const [wr, br] = elo(
            w.rating,
            b.rating,
            g.outcome === 'white' ? 1 : g.outcome === 'draw' ? 0.5 : 0,
          );
          await tx.query(
            'UPDATE users SET rating=CASE WHEN id=$1 THEN $3::integer ELSE $4::integer END WHERE id=$1 OR id=$2',
            [w.id, b.id, wr, br],
          );
        }
      }
    });
    return g;
  }
  async create(user: User, control: Control, rated = false, chainMatch?: string) {
    const g: GameState = {
      id: randomUUID(),
      white: user.id,
      black: null,
      whiteName: user.username,
      blackName: 'Waiting for a rival',
      fen: new Chess().fen(),
      pgn: '',
      moves: [],
      revision: 0,
      status: 'waiting',
      outcome: null,
      reason: null,
      whiteMs: controls[control][0] * 1000,
      blackMs: controls[control][0] * 1000,
      lastTick: 0,
      increment: controls[control][1],
      control,
      rated,
      drawOffer: null,
      created: Date.now(),
      expires: Date.now() + 15 * 60000,
      ...(chainMatch ? { chainMatch } : {}),
    };
    await this.db.query('INSERT INTO games(id,state) VALUES($1,$2::jsonb)', [
      g.id,
      JSON.stringify(g),
    ]);
    return g;
  }
  async join(id: string, user: User) {
    return this.serial(async () => {
      const g = await this.get(id);
      if (!g) throw Error('Challenge not found.');
      if (g.white === user.id || g.black === user.id) return g;
      if (g.status !== 'waiting' || g.expires < Date.now())
        throw Error('This challenge is full or expired.');
      if (g.chainMatch) throw Error('Arena players must join through verified funding.');
      g.black = user.id;
      g.blackName = user.username;
      g.status = 'active';
      g.lastTick = Date.now();
      return this.save(g);
    });
  }
  async submit(
    id: string,
    user: string,
    payload: { from: string; to: string; promotion: string; revision: number },
  ) {
    return this.serial(async () => {
      const g = await this.get(id);
      if (!g) throw Error('Game not found.');
      move(g, user, payload.from, payload.to, payload.promotion, payload.revision, Date.now());
      return this.save(g);
    });
  }
  async action(id: string, user: string, action: string) {
    return this.serial(async () => {
      const g = await this.get(id);
      if (!g || ![g.white, g.black].includes(user)) throw Error('You are not a participant.');
      tick(g, Date.now());
      if (g.status !== 'active') return this.save(g);
      if (action === 'resign') {
        g.status = 'finished';
        g.outcome = g.white === user ? 'black' : 'white';
        g.reason = 'Resignation';
      } else if (action === 'offer') g.drawOffer = user;
      else if (action === 'accept' && g.drawOffer && g.drawOffer !== user) {
        g.status = 'finished';
        g.outcome = 'draw';
        g.reason = 'Draw by agreement';
      } else if (action === 'decline') g.drawOffer = null;
      else throw Error('No valid draw offer.');
      return this.save(g);
    });
  }
  async clocks() {
    return this.serial(async () => {
      const rows = await this.db.query<{ state: GameState }>(
        "SELECT state FROM games WHERE state->>'status'='active'",
      );
      const changed: GameState[] = [];
      for (const { state: g } of rows.rows) {
        tick(g, Date.now());
        await this.save(g);
        changed.push(g);
      }
      return changed;
    });
  }
}
