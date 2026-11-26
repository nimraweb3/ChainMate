import { Hono } from 'hono';
import { z } from 'zod';
import jpeg from 'jpeg-js';
import { statement as q, type AppEnv, type Member } from './env';
import { requireUser, publicUser, audit, limit } from './auth';
export const profiles = new Hono<AppEnv>();
profiles.get('/profile/:username', async (c) => {
  const u = await q(
    c.env,
    'SELECT * FROM users WHERE username=? AND deleted=0',
    c.req.param('username'),
  ).first<Member>();
  if (!u || (u.private && u.id !== c.get('user')?.id))
    return c.json({ error: 'This profile is private or unavailable.' }, 404);
  const games = await q(
    c.env,
    `SELECT state FROM games WHERE (white=? OR black=?) AND status='finished'
     AND (white=? OR black=? OR NOT EXISTS(SELECT 1 FROM users WHERE id IN (games.white,games.black) AND private=1))
     ORDER BY created DESC LIMIT 30`,
    u.id,
    u.id,
    c.get('user')?.id || '',
    c.get('user')?.id || '',
  ).all<{ state: string }>();
  const ratings = await q(
    c.env,
    'SELECT category,rating,games FROM ratings WHERE user_id=?',
    u.id,
  ).all();
  const stats = await q(
    c.env,
    `SELECT COUNT(*) AS total,SUM(CASE WHEN (white=? AND json_extract(state,'$.outcome')='white') OR (black=? AND json_extract(state,'$.outcome')='black') THEN 1 ELSE 0 END) AS wins,SUM(CASE WHEN json_extract(state,'$.outcome')='draw' THEN 1 ELSE 0 END) AS draws FROM games WHERE (white=? OR black=?) AND status='finished' AND black IS NOT NULL`,
    u.id,
    u.id,
    u.id,
    u.id,
  ).first<{ total: number; wins: number; draws: number }>();
  const achievements = await q(
    c.env,
    'SELECT a.*,ua.earned,ua.chain_id,ua.tx FROM achievements a JOIN user_achievements ua ON a.id=ua.achievement_id WHERE ua.user_id=?',
    u.id,
  ).all();
  const wallets = u.wallet_public
    ? (await q(c.env, 'SELECT address,primary_wallet FROM wallets WHERE user_id=?', u.id).all())
        .results
    : [];
  return c.json({
    user: publicUser(u, u.id === c.get('user')?.id),
    games: games.results.map((g) => JSON.parse(g.state)),
    ratings: ratings.results,
    stats: {
      total: stats?.total || 0,
      wins: stats?.wins || 0,
      draws: stats?.draws || 0,
      losses: (stats?.total || 0) - (stats?.wins || 0) - (stats?.draws || 0),
    },
    achievements: achievements.results,
    wallets,
  });
});
profiles.patch('/profile', async (c) => {
  const u = requireUser(c),
    p = z
      .object({
        username: z
          .string()
          .regex(/^[a-zA-Z0-9_]{3,24}$/)
          .optional(),
        bio: z.string().max(240).optional(),
        display_name: z.string().max(60).optional(),
        country: z.string().max(60).optional(),
        private: z.boolean().optional(),
        wallet_public: z.boolean().optional(),
        settings: z
          .object({
            board: z.enum(['slate', 'warm']),
            muted: z.boolean(),
            notifications: z.boolean(),
            network: z.enum(['8453', '84532', '31337']),
          })
          .optional(),
      })
      .parse(await c.req.json());
  if (
    p.username &&
    p.username !== u.username &&
    (await q(c.env, 'SELECT 1 FROM active_players WHERE user_id=?', u.id).first())
  )
    throw Error('Finish your match before changing your username.');
  try {
    await q(
      c.env,
      'UPDATE users SET username=?,bio=?,display_name=?,country=?,private=?,wallet_public=?,settings=? WHERE id=?',
      p.username ?? u.username,
      p.bio ?? u.bio,
      p.display_name ?? u.display_name,
      p.country ?? u.country,
      p.private === undefined ? u.private : Number(p.private),
      p.wallet_public === undefined ? u.wallet_public : Number(p.wallet_public),
      p.settings ? JSON.stringify(p.settings) : u.settings,
      u.id,
    ).run();
  } catch {
    throw Error('That username is unavailable.');
  }
  await audit(c.env, u.id, 'profile_updated');
  return c.json({ ok: true });
});
profiles.post('/profile/media/:kind', async (c) => {
  const u = requireUser(c);
  await limit(c.env, 'upload:' + u.id, 10, 3600000);
  const kind = z.enum(['avatar', 'banner']).parse(c.req.param('kind'));
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (
    bytes.length > 2 * 1024 * 1024 ||
    bytes.length < 4 ||
    c.req.header('content-type') !== 'image/jpeg' ||
    bytes[0] !== 255 ||
    bytes[1] !== 216
  )
    throw Error('Upload a JPEG image under 2 MB.');
  let decoded: { data: Uint8Array; width: number; height: number };
  try {
    decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 3, maxMemoryUsageInMB: 32 });
  } catch {
    throw Error('The image could not be decoded.');
  }
  const maxWidth = kind === 'avatar' ? 512 : 1600,
    maxHeight = kind === 'avatar' ? 512 : 600;
  if (
    decoded.width > maxWidth ||
    decoded.height > maxHeight ||
    decoded.width < 32 ||
    decoded.height < 32
  )
    throw Error(`Crop the image to at most ${maxWidth} × ${maxHeight}.`);
  const optimized = jpeg.encode(decoded, 82).data;
  const key = `${u.id}/${kind}/${crypto.randomUUID()}.jpg`;
  await c.env.MEDIA.put(key, optimized, { httpMetadata: { contentType: 'image/jpeg' } });
  try {
    await q(c.env, `UPDATE users SET ${kind}=? WHERE id=?`, key, u.id).run();
  } catch (e) {
    await c.env.MEDIA.delete(key);
    throw e;
  }
  if (u[kind]) await c.env.MEDIA.delete(u[kind]!);
  await audit(c.env, u.id, kind + '_updated');
  return c.json({ key, url: '/api/media/' + key });
});
profiles.get('/media/:user/:kind/:file', async (c) => {
  const owner = c.req.param('user'),
    kind = z.enum(['avatar', 'banner']).parse(c.req.param('kind'));
  const key = `${owner}/${kind}/${c.req.param('file')}`;
  const u = await q(
    c.env,
    'SELECT id,private,avatar,banner FROM users WHERE id=? AND deleted=0',
    owner,
  ).first<Member>();
  if (!u || u[kind] !== key || (u.private && c.get('user')?.id !== u.id)) return c.notFound();
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  });
});
profiles.get('/wallets', async (c) => {
  const u = requireUser(c);
  return c.json(
    (
      await q(
        c.env,
        'SELECT address,primary_wallet,linked FROM wallets WHERE user_id=?',
        u.id,
      ).all()
    ).results,
  );
});
profiles.delete('/wallets/:address', async (c) => {
  const u = requireUser(c),
    address = c.req.param('address').toLowerCase();
  const count = await q(c.env, 'SELECT COUNT(*) AS n FROM wallets WHERE user_id=?', u.id).first<{
    n: number;
  }>();
  if (!u.password && count!.n <= 1) throw Error('Keep at least one sign-in method.');
  if (await q(c.env, 'SELECT 1 FROM active_players WHERE user_id=?', u.id).first())
    throw Error('Finish your active match before unlinking a wallet.');
  await q(c.env, 'DELETE FROM wallets WHERE user_id=? AND address=?', u.id, address).run();
  await audit(c.env, u.id, 'wallet_unlinked');
  return c.json({ ok: true });
});
profiles.get('/achievements', async (c) => {
  const u = requireUser(c);
  return c.json(
    (
      await q(
        c.env,
        'SELECT a.*,ua.earned,ua.chain_id,ua.tx FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id WHERE ua.user_id=?',
        u.id,
      ).all()
    ).results,
  );
});
