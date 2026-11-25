import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Database } from './db';
import type { User } from '../../../packages/shared/types';
const scrypt = promisify(rawScrypt);
export const token = () => randomBytes(32).toString('hex');
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export async function hash(password: string) {
  const salt = token();
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ':' + key.toString('hex');
}
export async function verify(password: string, saved: string) {
  const [salt, hex] = saved.split(':');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
export async function session(db: Database, raw?: string): Promise<User | null> {
  if (!raw) return null;
  return (
    (
      await db.query<User>(
        'SELECT u.id,u.username,u.rating,u.bio,u.joined,u.wallet FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=$1 AND s.expires>$2',
        [digest(raw), Date.now()],
      )
    ).rows[0] || null
  );
}
export async function createSession(db: Database, id: string) {
  const raw = token();
  await db.query('INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,$3)', [
    digest(raw),
    id,
    Date.now() + 7 * 86400000,
  ]);
  return raw;
}
