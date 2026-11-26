import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { hash, verify, digest, token } from '../../../packages/shared/credentials';
import { statement as q, type Env, type AppEnv, type Member } from './env';
export { digest, token };
export async function member(env: Env, sessionHash: string) {
  return q(
    env,
    `SELECT u.*,(SELECT address FROM wallets WHERE user_id=u.id ORDER BY primary_wallet DESC,linked LIMIT 1) AS wallet FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.deleted=0`,
    sessionHash,
    Date.now(),
  ).first<Member>();
}
export function publicUser(u: Member, own = false) {
  const { password: _password, email, email_verified, settings, wallet, ...safe } = u;
  return {
    ...safe,
    ...(own
      ? { email, email_verified, settings: JSON.parse(settings || '{}'), wallet }
      : u.wallet_public
        ? { wallet }
        : {}),
  };
}
export async function audit(env: Env, id: string | null, action: string) {
  await q(
    env,
    'INSERT INTO audit(id,user_id,action,at) VALUES(?,?,?,?)',
    crypto.randomUUID(),
    id,
    action,
    Date.now(),
  ).run();
}
export async function login(c: any, id: string) {
  const old = getCookie(c, 'cm_session');
  const raw = token();
  await c.env.DB.batch([
    q(c.env, 'DELETE FROM sessions WHERE token=?', digest(old || '')),
    q(
      c.env,
      'INSERT INTO sessions VALUES(?,?,?,?)',
      digest(raw),
      id,
      Date.now() + 7 * 86400000,
      Date.now(),
    ),
  ]);
  setCookie(c, 'cm_session', raw, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    maxAge: 604800,
  });
}
export async function limit(env: Env, key: string, max: number, window = 60000) {
  const now = Date.now();
  const r = await q(
    env,
    `INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END RETURNING count`,
    key,
    now + window,
    now,
    now,
  ).first<{ count: number }>();
  if (r!.count > max) throw Error('Too many requests. Please try again later.');
}
export function requireUser(c: any): Member {
  const u = c.get('user');
  if (!u) throw Error('Sign in to continue.');
  return u;
}
export const auth = new Hono<AppEnv>();
auth.get('/me', (c) => c.json({ user: c.get('user') ? publicUser(c.get('user')!, true) : null }));
auth.get('/username', async (c) => {
  const name = z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,24}$/)
    .parse(c.req.query('name'));
  return c.json({
    available: !(await q(c.env, 'SELECT id FROM users WHERE username=?', name).first()),
  });
});
auth.post('/register', async (c) => {
  const p = z
    .object({
      username: z.string().regex(/^[a-zA-Z0-9_]{3,24}$/),
      email: z.email().max(254),
      password: z.string().min(12).max(128),
    })
    .parse(await c.req.json());
  const id = crypto.randomUUID();
  try {
    await q(
      c.env,
      'INSERT INTO users(id,username,email,password,joined) VALUES(?,?,?,?,?)',
      id,
      p.username,
      p.email.toLowerCase(),
      await hash(p.password),
      new Date().toISOString(),
    ).run();
  } catch {
    throw Error('Username or email is unavailable.');
  }
  await login(c, id);
  await audit(c.env, id, 'register');
  return c.json({ ok: true }, 201);
});
auth.post('/login', async (c) => {
  const p = z.object({ email: z.email(), password: z.string().max(128) }).parse(await c.req.json());
  const u = await q(
    c.env,
    'SELECT * FROM users WHERE email=? AND deleted=0',
    p.email.toLowerCase(),
  ).first<Member>();
  if (!u?.password || !(await verify(p.password, u.password)))
    return c.json({ error: 'Email or password is incorrect.' }, 401);
  await login(c, u.id);
  await audit(c.env, u.id, 'login');
  return c.json({ ok: true });
});
auth.post('/logout', async (c) => {
  await q(c.env, 'DELETE FROM sessions WHERE token=?', c.get('sessionHash')).run();
  deleteCookie(c, 'cm_session', { path: '/' });
  return c.json({ ok: true });
});
async function sendMail(env: Env, u: Member, purpose: string, origin: string) {
  const raw = token(),
    expires = Date.now() + 1800000;
  await q(
    env,
    'INSERT INTO challenges(token,user_id,purpose,expires) VALUES(?,?,?,?)',
    digest(raw),
    u.id,
    purpose,
    expires,
  ).run();
  const url = origin + (purpose === 'reset' ? '/login?reset=' : '/settings?verify=') + raw;
  if (env.ENVIRONMENT === 'local') {
    await q(
      env,
      'INSERT INTO mail_outbox VALUES(?,?,?,?,?)',
      crypto.randomUUID(),
      u.id,
      purpose,
      url,
      Date.now(),
    ).run();
    return;
  }
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) throw Error('Email delivery is not configured.');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.EMAIL_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [u.email],
      subject:
        purpose === 'reset' ? 'Reset your ChainMate password' : 'Verify your ChainMate email',
      text: `Open this link within 30 minutes: ${url}`,
    }),
  });
  if (!r.ok) throw Error('Email delivery is temporarily unavailable.');
}
auth.post('/forgot', async (c) => {
  const p = z.object({ email: z.email() }).parse(await c.req.json());
  if (c.env.ENVIRONMENT !== 'local' && (!c.env.EMAIL_API_KEY || !c.env.EMAIL_FROM))
    return c.json({ error: 'Password recovery email is not configured yet.' }, 503);
  const u = await q(
    c.env,
    'SELECT * FROM users WHERE email=? AND deleted=0',
    p.email.toLowerCase(),
  ).first<Member>();
  if (u) await sendMail(c.env, u, 'reset', new URL(c.req.url).origin);
  return c.json({
    message:
      c.env.ENVIRONMENT === 'local'
        ? 'If the account exists, a reset link was saved to the local development mail outbox.'
        : 'If the account exists, a reset email was requested.',
  });
});
auth.post('/reset', async (c) => {
  const p = z
    .object({ token: z.string().length(64), password: z.string().min(12).max(128) })
    .parse(await c.req.json());
  const password = await hash(p.password);
  const t = await q(
    c.env,
    `SELECT user_id FROM challenges WHERE token=? AND purpose='reset' AND expires>?`,
    digest(p.token),
    Date.now(),
  ).first<{ user_id: string }>();
  if (!t) throw Error('Reset link is invalid or expired.');
  const resetResult = await c.env.DB.batch([
    q(
      c.env,
      `UPDATE users SET password=? WHERE id=? AND EXISTS(SELECT 1 FROM challenges WHERE token=? AND expires>?)`,
      password,
      t.user_id,
      digest(p.token),
      Date.now(),
    ),
    q(
      c.env,
      'DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM challenges WHERE token=? AND expires>?)',
      t.user_id,
      digest(p.token),
      Date.now(),
    ),
    q(c.env, 'DELETE FROM challenges WHERE user_id=? AND purpose=?', t.user_id, 'reset'),
  ]);
  if (resetResult[0].meta.changes !== 1) throw Error('Reset link is invalid or expired.');
  return c.json({ ok: true });
});
auth.post('/verification', async (c) => {
  const u = requireUser(c);
  if (!u.email) throw Error('This account has no email address.');
  await sendMail(c.env, u, 'verify', new URL(c.req.url).origin);
  return c.json({ ok: true });
});
auth.post('/verify', async (c) => {
  const u = requireUser(c),
    p = z.object({ token: z.string().length(64) }).parse(await c.req.json());
  const t = await q(
    c.env,
    `DELETE FROM challenges WHERE token=? AND user_id=? AND purpose='verify' AND expires>? RETURNING user_id`,
    digest(p.token),
    u.id,
    Date.now(),
  ).first();
  if (!t) throw Error('Verification link is invalid or expired.');
  await q(c.env, 'UPDATE users SET email_verified=1 WHERE id=?', u.id).run();
  return c.json({ ok: true });
});
auth.post('/password', async (c) => {
  const u = requireUser(c),
    p = z
      .object({ current: z.string().max(128), password: z.string().min(12).max(128) })
      .parse(await c.req.json());
  if (!u.password || !(await verify(p.current, u.password)))
    throw Error('Current password is incorrect.');
  await c.env.DB.batch([
    q(c.env, 'UPDATE users SET password=? WHERE id=?', await hash(p.password), u.id),
    q(c.env, 'DELETE FROM sessions WHERE user_id=?', u.id),
  ]);
  await login(c, u.id);
  await audit(c.env, u.id, 'password_changed');
  return c.json({ ok: true });
});
auth.delete('/account', async (c) => {
  const u = requireUser(c),
    p = z
      .object({ password: z.string().optional(), confirmation: z.literal('DELETE') })
      .parse(await c.req.json());
  if (u.password && !(await verify(p.password || '', u.password)))
    throw Error('Current password is incorrect.');
  if (!u.password) {
    const s = await q(
      c.env,
      'SELECT created FROM sessions WHERE token=?',
      c.get('sessionHash'),
    ).first<{ created: number }>();
    if (!s || Date.now() - s.created > 300000)
      throw Error('Sign in with your wallet again before deleting your account.');
  }
  if (await q(c.env, 'SELECT 1 FROM active_players WHERE user_id=?', u.id).first())
    throw Error('Finish your active match before deleting your account.');
  await c.env.DB.batch([
    q(
      c.env,
      `UPDATE users SET username=?,email=NULL,password=NULL,bio='',display_name='',country='',avatar=NULL,banner=NULL,private=1,deleted=1 WHERE id=?`,
      'deleted_' + token().slice(0, 12),
      u.id,
    ),
    q(c.env, 'DELETE FROM sessions WHERE user_id=?', u.id),
    q(c.env, 'DELETE FROM wallets WHERE user_id=?', u.id),
    q(c.env, 'DELETE FROM challenges WHERE user_id=?', u.id),
    q(c.env, 'DELETE FROM mail_outbox WHERE user_id=?', u.id),
    q(c.env, 'DELETE FROM user_experience WHERE user_id=?', u.id),
    q(c.env, 'DELETE FROM chat_messages WHERE sender_id=?', u.id),
    q(c.env, 'DELETE FROM chat_permissions WHERE user_id=? OR target_id=?', u.id, u.id),
    q(c.env, 'DELETE FROM user_blocks WHERE user_id=? OR target_id=?', u.id, u.id),
    q(
      c.env,
      `UPDATE games SET state=json_set(state,'$.whiteName',CASE WHEN white=? THEN 'Deleted player' ELSE json_extract(state,'$.whiteName') END,'$.blackName',CASE WHEN black=? THEN 'Deleted player' ELSE json_extract(state,'$.blackName') END) WHERE white=? OR black=?`,
      u.id,
      u.id,
      u.id,
      u.id,
    ),
  ]);
  for (const key of [u.avatar, u.banner]) if (key) await c.env.MEDIA.delete(key);
  deleteCookie(c, 'cm_session', { path: '/' });
  await audit(c.env, u.id, 'account_deleted');
  return c.json({ ok: true });
});
