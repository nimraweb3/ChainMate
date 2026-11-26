import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(rawScrypt);
export const token = () => randomBytes(32).toString('hex');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hash(password: string) {
  const salt = token();
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ':' + key.toString('hex');
}
export async function verify(password: string, saved: string) {
  const [salt, hex] = saved.split(':');
  if (!salt || !hex || hex.length !== 128) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
