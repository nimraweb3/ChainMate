import type { Express, Response } from 'express';
import { createPublicClient, http, keccak256, toBytes, type Address, type Hex } from 'viem';
import { anvil, baseSepolia } from 'viem/chains';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { privateKeyToAccount } from 'viem/accounts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { escrowAbi, resultTypes } from '../../../packages/shared/contracts';
import { session, token, createSession } from './auth';
import type { Database } from './db';
import type { Games } from './games';
import type { User } from '../../../packages/shared/types';
export function arenaRoutes(
  app: Express,
  db: Database,
  games: Games,
  setCookie: (r: Response, t: string) => void,
) {
  const chainId = Number(process.env.CHAIN_ID || 31337);
  const chain = chainId === 84532 ? baseSepolia : anvil;
  const address = process.env.ESCROW_ADDRESS as Address | undefined;
  const client = createPublicClient({
    chain,
    transport: http(process.env.RPC_URL || 'http://127.0.0.1:8545'),
  });
  const configured =
    !!address &&
    !!process.env.TOKEN_ADDRESS &&
    !!process.env.RESULT_SIGNER_KEY &&
    [31337, 84532].includes(chainId);
  app.get('/api/web3/config', (_req, res) =>
    res.json({
      configured,
      chainId,
      address,
      token: process.env.TOKEN_ADDRESS,
      disputeSeconds: 120,
      recoverySeconds: 86400,
    }),
  );
  app.get('/api/web3/nonce', async (_req, res) => {
    const nonce = token();
    await db.query('INSERT INTO nonces VALUES($1,$2)', [nonce, Date.now() + 300000]);
    res.json({ nonce });
  });
  app.post('/api/web3/verify', async (req, res) => {
    const p = z
      .object({ message: z.string().max(4096), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) })
      .parse(req.body);
    const m = parseSiweMessage(p.message);
    const origin = req.headers.origin || '';
    if (
      !m.address ||
      m.chainId !== chainId ||
      m.uri !== origin ||
      !m.expirationTime ||
      !validateSiweMessage({
        message: m,
        domain: new URL(origin).host,
        nonce: m.nonce,
        time: new Date(),
      })
    )
      throw Error('Invalid wallet sign-in request.');
    if (!(await client.verifySiweMessage({ message: p.message, signature: p.signature as Hex })))
      throw Error('Signature verification failed.');
    await db.transaction(async (tx) => {
      const rows = await tx.query(
        'DELETE FROM nonces WHERE nonce=$1 AND expires>$2 RETURNING nonce',
        [m.nonce, Date.now()],
      );
      if (!rows.rows.length) throw Error('Nonce used or expired.');
    });
    const existing = await session(db, req.cookies.cm_session);
    const wallet = m.address.toLowerCase();
    let u = (await db.query<User>('SELECT id,username FROM users WHERE wallet=$1', [wallet]))
      .rows[0];
    if (existing) {
      if (u && u.id !== existing.id) throw Error('This wallet belongs to another account.');
      await db.query('UPDATE users SET wallet=$2 WHERE id=$1', [existing.id, wallet]);
      u = existing;
    } else if (!u) {
      const id = randomUUID();
      await db.query('INSERT INTO users(id,username,joined,wallet) VALUES($1,$2,$3,$4)', [
        id,
        'player_' + wallet.slice(2, 10),
        new Date().toISOString(),
        wallet,
      ]);
      u = { id } as User;
    }
    setCookie(res, await createSession(db, u.id));
    res.json({ ok: true });
  });
  app.get('/api/web3/match/:id', async (req, res) => {
    if (!configured)
      return res.status(503).json({ error: 'Local contracts have not been deployed.' });
    const id = z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .parse(req.params.id) as Hex;
    const m = await client.readContract({
      address: address!,
      abi: escrowAbi,
      functionName: 'matches',
      args: [id],
    });
    res.json({
      id,
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
    });
  });
  app.post('/api/web3/match/:id/start', async (req, res) => {
    if (!configured) throw Error('Deploy local contracts first.');
    const u = await session(db, req.cookies.cm_session);
    if (!u?.wallet) throw Error('Sign in with your wallet first.');
    const id = z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .parse(req.params.id) as Hex;
    const m = await client.readContract({
      address: address!,
      abi: escrowAbi,
      functionName: 'matches',
      args: [id],
    });
    if (m[6] !== 2 || ![m[0].toLowerCase(), m[1].toLowerCase()].includes(u.wallet))
      throw Error('Both named players must fund the match.');
    const g = await games.serial(async () => {
      const old = (
        await db.query<{ state: import('../../../packages/shared/types').GameState }>(
          "SELECT state FROM games WHERE state->>'chainMatch'=$1",
          [id],
        )
      ).rows[0];
      if (old) return old.state;
      const users = (
        await db.query<User>('SELECT id,username,wallet FROM users WHERE wallet=$1 OR wallet=$2', [
          m[0].toLowerCase(),
          m[1].toLowerCase(),
        ])
      ).rows;
      const w = users.find((x) => x.wallet === m[0].toLowerCase()),
        b = users.find((x) => x.wallet === m[1].toLowerCase());
      if (!w || !b) throw Error('Both players need to sign in with their wallets.');
      const g = await games.create(w, '10+0', false, id);
      g.black = b.id;
      g.blackName = b.username;
      g.status = 'active';
      g.lastTick = Date.now();
      return games.save(g);
    });
    res.json(g);
  });
  app.post('/api/web3/match/:id/attestation', async (req, res) => {
    if (!configured) throw Error('Result signer is not configured.');
    const u = await session(db, req.cookies.cm_session);
    if (!u) throw Error('Sign in first.');
    const id = z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .parse(req.params.id) as Hex;
    const g = (
      await db.query<{ state: import('../../../packages/shared/types').GameState }>(
        "SELECT state FROM games WHERE state->>'chainMatch'=$1",
        [id],
      )
    ).rows[0]?.state;
    if (!g || g.status !== 'finished' || ![g.white, g.black].includes(u.id))
      throw Error('A completed authoritative game is required.');
    const m = await client.readContract({
      address: address!,
      abi: escrowAbi,
      functionName: 'matches',
      args: [id],
    });
    if (m[6] !== 2) throw Error('Contract is not awaiting a result.');
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
    const nonce = await client.readContract({
      address: address!,
      abi: escrowAbi,
      functionName: 'nonces',
      args: [id],
    });
    const message = {
      matchId: id,
      white: m[0],
      black: m[1],
      outcome: g.outcome === 'white' ? 1 : g.outcome === 'black' ? 2 : 3,
      recordHash: keccak256(toBytes(canonical)),
      nonce,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 600),
    };
    const signature = await privateKeyToAccount(process.env.RESULT_SIGNER_KEY as Hex).signTypedData(
      {
        domain: { name: 'ChainMate', version: '1', chainId, verifyingContract: address },
        types: resultTypes,
        primaryType: 'Result',
        message,
      },
    );
    res.json({
      ...message,
      nonce: String(nonce),
      expiry: String(message.expiry),
      signature,
      canonical,
    });
  });
}
