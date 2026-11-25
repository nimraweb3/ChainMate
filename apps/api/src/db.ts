import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
export interface Query {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Query {
  transaction<T>(fn: (tx: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function database(path = process.env.DATA_DIR || '.data/postgres'): Promise<Database> {
  let db: Database;
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    db = {
      query: async <T>(sql: string, p?: unknown[]) => ({
        rows: (await pool.query(sql, p)).rows as T[],
      }),
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await fn(c as Query);
          await c.query('COMMIT');
          return r;
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    };
  } else {
    if (!path.startsWith('memory://')) await mkdir(dirname(path), { recursive: true });
    const p = new PGlite(path);
    await p.waitReady;
    db = p as unknown as Database;
  }
  const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').filter((s) => s.trim())) await db.query(statement);
  return db;
}
