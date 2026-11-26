import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import {
  createPublicClient,
  http,
  isAddress,
  keccak256,
  toBytes,
  parseAbi,
  decodeEventLog,
  type Hex,
  type Address,
} from 'viem';
import { anvil, base, baseSepolia } from 'viem/chains';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { privateKeyToAccount } from 'viem/accounts';
import { escrowAbi, resultTypes } from '../../../packages/shared/contracts';
import { statement as q, internal, lobby, room, type Env, type AppEnv, type Member } from './env';
import { token, digest, login, requireUser, audit } from './auth';
import type { GameState } from '../../../packages/shared/types';
export const web3 = new Hono<AppEnv>();
export function chainConfig(env: Env) {
  const chainId = Number(env.CHAIN_ID || 84532);
  const configured =
    !!env.ESCROW_ADDRESS &&
    isAddress(env.ESCROW_ADDRESS) &&
    !!env.TOKEN_ADDRESS &&
    isAddress(env.TOKEN_ADDRESS) &&
    !!env.RESULT_SIGNER_KEY &&
    (chainId === 84532 || (chainId === 31337 && env.ENVIRONMENT === 'local'));
  return {
    configured,
    chainId,
    address: env.ESCROW_ADDRESS as Address,
    token: env.TOKEN_ADDRESS as Address,
    mainnetFinancial: false,
  };
}
function client(env: Env, id = Number(env.CHAIN_ID)) {
  return createPublicClient({
    chain: id === 8453 ? base : id === 84532 ? baseSepolia : anvil,
    transport: http(
      id === Number(env.CHAIN_ID)
        ? env.RPC_URL
        : id === 8453
          ? env.BASE_RPC_URL || 'https://mainnet.base.org'
          : env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    ),
  });
}
const matchId = (s: string) =>
  z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .parse(s) as Hex;
async function readMatch(env: Env, id: Hex) {
  const config = chainConfig(env);
  if (!config.configured) throw Error('Testnet contracts and result signer are not configured.');
  const rpc = client(env),
    block = await rpc.getBlock();
  const m = await rpc.readContract({
    address: config.address,
    abi: escrowAbi,
    functionName: 'matches',
    args: [id],
    blockNumber: block.number,
  });
  if (m[6] === 0) throw Error('Match not found.');
  return {
    id,
    chainId: config.chainId,
    contract: config.address,
    chainTimestamp: Number(block.timestamp),
    white: m[0],
    black: m[1],
    stake: m[2].toString(),
    fundingDeadline: Number(m[3]),
    recoveryDeadline: Number(m[4]),
    disputeDeadline: Number(m[5]),
    state: m[6],
    whitePaid: m[7],
    blackPaid: m[8],
    outcome: m[9],
    recordHash: m[10],
  };
}
web3.get('/config', (c) => c.json(chainConfig(c.env)));
web3.get('/nonce', async (c) => {
  const raw = token();
  await q(
    c.env,
    'INSERT INTO challenges(token,purpose,expires,binding) VALUES(?,?,?,?)',
    digest(raw),
    'siwe',
    Date.now() + 300000,
    c.get('sessionHash'),
  ).run();
  setCookie(c, 'cm_nonce', raw, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: new URL(c.req.url).protocol === 'https:',
    maxAge: 300,
    path: '/api/web3',
  });
  return c.json({ nonce: raw });
});
web3.post('/verify', async (c) => {
  const p = z
      .object({ message: z.string().max(4096), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) })
      .parse(await c.req.json()),
    m = parseSiweMessage(p.message),
    origin = new URL(c.req.url).origin;
  const nonce = getCookie(c, 'cm_nonce');
  if (
    !nonce ||
    m.nonce !== nonce ||
    !m.address ||
    !m.chainId ||
    ![8453, 84532, ...(c.env.ENVIRONMENT === 'local' ? [31337] : [])].includes(m.chainId) ||
    m.uri !== origin ||
    !m.expirationTime ||
    !m.issuedAt ||
    m.expirationTime.getTime() - m.issuedAt.getTime() > 600000 ||
    m.issuedAt.getTime() > Date.now() + 30000 ||
    !validateSiweMessage({ message: m, domain: new URL(origin).host, nonce, time: new Date() })
  )
    throw Error('Invalid wallet sign-in request.');
  const saved = await q(
    c.env,
    `SELECT binding FROM challenges WHERE token=? AND purpose='siwe' AND expires>?`,
    digest(nonce),
    Date.now(),
  ).first<{ binding: string }>();
  if (!saved || saved.binding !== c.get('sessionHash'))
    throw Error('Login challenge expired or session changed.');
  if (
    !(await client(c.env, m.chainId).verifySiweMessage({
      message: p.message,
      signature: p.signature as Hex,
    }))
  )
    throw Error('Wallet signature is invalid.');
  const consumed = await q(
    c.env,
    `DELETE FROM challenges WHERE token=? AND purpose='siwe' RETURNING token`,
    digest(nonce),
  ).first();
  if (!consumed) throw Error('Login challenge already used.');
  deleteCookie(c, 'cm_nonce', { path: '/api/web3' });
  const address = m.address.toLowerCase(),
    existing = c.get('user');
  const linked = await q(c.env, 'SELECT user_id FROM wallets WHERE address=?', address).first<{
    user_id: string;
  }>();
  if (existing && linked && linked.user_id !== existing.id)
    throw Error('This wallet belongs to another account.');
  let id = existing?.id || linked?.user_id;
  if (!id) {
    id = crypto.randomUUID();
    await q(
      c.env,
      'INSERT INTO users(id,username,joined) VALUES(?,?,?)',
      id,
      'player_' + token().slice(0, 12),
      new Date().toISOString(),
    ).run();
  }
  await q(c.env, 'INSERT OR IGNORE INTO wallets VALUES(?,?,0,?)', address, id, Date.now()).run();
  const owner = await q(c.env, 'SELECT user_id FROM wallets WHERE address=?', address).first<{
    user_id: string;
  }>();
  if (owner?.user_id !== id) throw Error('This wallet belongs to another account.');
  await q(
    c.env,
    'UPDATE wallets SET primary_wallet=CASE WHEN address=? THEN 1 ELSE 0 END WHERE user_id=?',
    address,
    id,
  ).run();
  await login(c, id);
  await audit(c.env, id, existing ? 'wallet_linked' : 'wallet_login');
  return c.json({ ok: true });
});
web3.get('/match/:id', async (c) => c.json(await readMatch(c.env, matchId(c.req.param('id')))));
web3.post('/match/:id/start', async (c) => {
  const u = requireUser(c),
    id = matchId(c.req.param('id')),
    m = await readMatch(c.env, id);
  if (m.state !== 2) throw Error('Both deposits must be confirmed before playing.');
  const rows = (
    await q(
      c.env,
      'SELECT u.*,w.address AS wallet FROM users u JOIN wallets w ON w.user_id=u.id WHERE w.address IN (?,?) AND deleted=0',
      m.white.toLowerCase(),
      m.black.toLowerCase(),
    ).all<Member>()
  ).results;
  const w = rows.find((x) => x.wallet === m.white.toLowerCase()),
    b = rows.find((x) => x.wallet === m.black.toLowerCase());
  if (!w || !b || w.id === b.id)
    throw Error('Two different accounts must verify the funded wallets.');
  if (![w.id, b.id].includes(u.id)) throw Error('Only the funded players can enter this match.');
  const g = await internal(lobby(c.env), '/create', {
    user: w,
    black: b,
    control: '10+0',
    rated: false,
    chainMatch: id,
  });
  await internal(room(c.env, g.id), '/init', g);
  return c.json(g);
});
web3.post('/match/:id/attestation', async (c) => {
  const u = requireUser(c),
    id = matchId(c.req.param('id')),
    config = chainConfig(c.env);
  const row = await q(c.env, 'SELECT state FROM games WHERE chain_match=?', id).first<{
    state: string;
  }>();
  if (!row) throw Error('No authoritative game is associated with this match.');
  const g: GameState = JSON.parse(row.state);
  if (g.status !== 'finished' || ![g.white, g.black].includes(u.id))
    throw Error('A completed authoritative game is required.');
  const m = await readMatch(c.env, id);
  if (m.state !== 2) throw Error('Contract is not awaiting a result.');
  const rpc = client(c.env);
  const nonce = await rpc.readContract({
    address: config.address,
    abi: escrowAbi,
    functionName: 'nonces',
    args: [id],
  });
  const canonical = JSON.stringify({
    version: 1,
    id: g.id,
    chainMatch: id,
    white: g.white,
    black: g.black,
    pgn: g.pgn,
    fen: g.fen,
    outcome: g.outcome,
    reason: g.reason,
  });
  const message = {
    matchId: id,
    white: m.white,
    black: m.black,
    outcome: g.outcome === 'white' ? 1 : g.outcome === 'black' ? 2 : 3,
    recordHash: keccak256(toBytes(canonical)),
    nonce,
    expiry: BigInt(m.chainTimestamp + 600),
  };
  const signature = await privateKeyToAccount(c.env.RESULT_SIGNER_KEY as Hex).signTypedData({
    domain: {
      name: 'ChainMate',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.address,
    },
    types: resultTypes,
    primaryType: 'Result',
    message,
  });
  await q(
    c.env,
    'INSERT INTO attestations VALUES(?,?,?,?,?,?,?) ON CONFLICT(chain_id,contract,match_id,nonce) DO UPDATE SET expiry=excluded.expiry,signature=excluded.signature',
    config.chainId,
    config.address,
    id,
    nonce.toString(),
    message.recordHash,
    Number(message.expiry),
    signature,
  ).run();
  return c.json({
    ...message,
    nonce: nonce.toString(),
    expiry: message.expiry.toString(),
    signature,
    canonical,
  });
});
web3.get('/activity', async (c) => {
  const u = requireUser(c),
    config = chainConfig(c.env);
  const addresses = (
    await q(c.env, 'SELECT address FROM wallets WHERE user_id=?', u.id).all<{ address: string }>()
  ).results.map((x) => x.address);
  const matches = (
    await q(
      c.env,
      'SELECT * FROM chain_matches WHERE chain_id=? AND contract=? ORDER BY updated DESC LIMIT 200',
      config.chainId,
      config.address || '',
    ).all<any>()
  ).results.filter(
    (x) => addresses.includes(x.white.toLowerCase()) || addresses.includes(x.black.toLowerCase()),
  );
  const ids = new Set(matches.map((x) => x.id));
  const events = (
    await q(
      c.env,
      'SELECT * FROM chain_events WHERE chain_id=? AND contract=? ORDER BY block_number DESC,log_index DESC LIMIT 200',
      config.chainId,
      config.address || '',
    ).all<any>()
  ).results.filter((x) => ids.has(JSON.parse(x.payload).id));
  return c.json({
    matches,
    transactions: events,
    confirmations: config.chainId === 31337 ? 0 : 12,
  });
});
const eventsAbi = parseAbi([
  'event MatchCreated(bytes32 indexed id,address white,address black,uint256 stake)',
  'event Funded(bytes32 indexed id,address player)',
  'event Activated(bytes32 indexed id)',
  'event ResultPending(bytes32 indexed id,uint8 outcome,bytes32 recordHash,uint64 deadline)',
  'event Disputed(bytes32 indexed id,address player,bytes32 evidence)',
  'event Settled(bytes32 indexed id,uint8 outcome)',
  'event Cancelled(bytes32 indexed id)',
  'event Refunded(bytes32 indexed id,address player,uint256 amount)',
]);
export async function indexEvents(env: Env) {
  const cfg = chainConfig(env);
  if (!cfg.configured) return;
  const rpc = client(env);
  const latest = await rpc.getBlockNumber();
  const safe = latest - (cfg.chainId === 31337 ? 0n : 12n);
  if (safe < 0) return;
  let cursor = await q(
    env,
    'SELECT * FROM chain_cursors WHERE chain_id=? AND contract=?',
    cfg.chainId,
    cfg.address,
  ).first<{ block_number: number; block_hash: string }>();
  if (cursor) {
    // A reset local chain can be shorter than the persisted cursor. RPC failures
    // on an existing height still propagate rather than discarding valid history.
    const block =
      BigInt(cursor.block_number) <= latest
        ? await rpc.getBlock({ blockNumber: BigInt(cursor.block_number) })
        : null;
    if (!block || block.hash !== cursor.block_hash) {
      await env.DB.batch([
        q(
          env,
          'DELETE FROM chain_events WHERE chain_id=? AND contract=?',
          cfg.chainId,
          cfg.address,
        ),
        q(
          env,
          'DELETE FROM chain_matches WHERE chain_id=? AND contract=?',
          cfg.chainId,
          cfg.address,
        ),
        q(
          env,
          'DELETE FROM chain_cursors WHERE chain_id=? AND contract=?',
          cfg.chainId,
          cfg.address,
        ),
      ]);
      cursor = null;
    }
  }
  const from = cursor ? BigInt(cursor.block_number) + 1n : BigInt(env.INDEX_START_BLOCK || '0');
  if (from > safe) return;
  const to = from + 499n < safe ? from + 499n : safe;
  const logs = await rpc.getLogs({
    address: cfg.address,
    events: eventsAbi,
    fromBlock: from,
    toBlock: to,
    strict: true,
  });
  const ids = new Set<Hex>();
  const writes: D1PreparedStatement[] = [];
  for (const log of logs) {
    const event = decodeEventLog({ abi: eventsAbi, data: log.data, topics: log.topics });
    const payload = JSON.stringify(event.args, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    ids.add((event.args as any).id);
    writes.push(
      q(
        env,
        'INSERT OR IGNORE INTO chain_events VALUES(?,?,?,?,?,?,?,?)',
        cfg.chainId,
        cfg.address,
        log.transactionHash,
        log.logIndex,
        Number(log.blockNumber),
        log.blockHash,
        event.eventName,
        payload,
      ),
    );
  }
  for (const id of ids) {
    const m = await rpc.readContract({
      address: cfg.address,
      abi: escrowAbi,
      functionName: 'matches',
      args: [id],
      blockNumber: to,
    });
    writes.push(
      q(
        env,
        'INSERT INTO chain_matches VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(chain_id,contract,id) DO UPDATE SET state=excluded.state,updated=excluded.updated',
        cfg.chainId,
        cfg.address,
        id,
        m[0],
        m[1],
        m[6],
        m[2].toString(),
        cfg.token,
        Date.now(),
      ),
    );
  }
  const block = await rpc.getBlock({ blockNumber: to });
  writes.push(
    q(
      env,
      'INSERT INTO chain_cursors VALUES(?,?,?,?) ON CONFLICT(chain_id,contract) DO UPDATE SET block_number=excluded.block_number,block_hash=excluded.block_hash',
      cfg.chainId,
      cfg.address,
      Number(to),
      block.hash,
    ),
  );
  await env.DB.batch(writes);
}
