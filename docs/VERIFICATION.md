# Verification — 26 November 2026

## Cloudflare implementation

- Frontend production build, application and Worker TypeScript checks, and ESLint passed.
- 15 Vitest tests and 21 Solidity tests passed.
- All 13 Cloudflare Chromium scenarios passed across the full run (12 passed) and a focused rerun of the profile suite (2 passed). The profile assertion was fixed to wait for avatar decoding rather than reading naturalWidth immediately after reload.
- Coverage includes D1 profiles/settings, R2 JPEG upload and private media, verification/reset/session revocation/account deletion, illegal and duplicate moves, exactly-once ratings, idle clock alarms, matchmaking, reconnect/replay, real Stockfish, and actual Anvil escrow settlement. Confirmed event indexing and repeated indexing without duplicates passed.
- Worker deployment dry-run and local D1 migrations passed. Local Cloudflare runtime: http://127.0.0.1:8787.
- Mobile metallic board and wallet screenshots were visually inspected.
- The latest production dependency audit reports one high advisory in transitive Zod 3 dependencies introduced by WalletConnect. The application's Zod 4 is patched; a Zod 4-only override does not resolve the older third-party dependency. Do not describe the current dependency audit as clean.
- Staging deployed to https://chainmate-staging.chainmate.workers.dev with remote D1, R2 and Durable Objects. HTTPS health returns 200. Initial TLS propagation failures resolved without bypassing certificate validation. Email provider delivery, public-testnet contracts, WalletConnect relay, real browser extensions and Mainnet balances remain externally unverified.
- Hosted Chromium run: **7 passed (1.1m)** against the HTTPS staging URL, covering profile/settings reload, private R2 avatar upload, homepage/mobile/reduced-motion behavior, all three Stockfish bots, and two registered players creating a challenge, exchanging moves, reconnecting, resigning and replaying.

## Earlier redesign verification (25 November)

## Executed checks

- `pnpm build`: passed TypeScript and Vite production build.
- `pnpm lint`: passed.
- `pnpm test`: 15 passing game-rule and API tests, including persistent database/auth/game behavior.
- `pnpm contracts:test`: 18 passing Solidity tests, including fuzz cases, fee-token rejection and reentrancy protection.
- `pnpm test:e2e`: **7 passed (1.4m)**. Covers actual Stockfish replies, illegal-move rejection, resignation/rematch, two-session synchronization, reconnect and replay; local escrow funding and settlement; interactive homepage moves, mode selection, mobile navigation and reduced motion.
- `pnpm audit --prod`: no known vulnerabilities reported at execution time.
- `node scripts/visual-review.mjs`: captured homepage at 320, 390, 768, 1024, 1440 and 1920 CSS pixels; product screens at 390 and 1440. No horizontal overflow or browser page exceptions reported.

## Visual review

Screenshots are in `.local/review/` (ignored local artifacts). Desktop and mobile homepage, bot selection, actual chess board, sign-in, Arena, profile and wallet dialog were visually inspected. The redesign uses original generated chrome/pearl sculptures, oversized Manrope typography, restrained glass controls and pearl gallery sections. Small-screen board controls retain a typed-move alternative. Refined word spacing and the move-history empty state after inspection. Read-only session checks no longer consume the authentication-attempt allowance; rate limits return a readable JSON error.

## Boundaries

Browser coverage is Chromium, not a cross-browser certification. Wallet automation uses local test adapters, not a real extension; there is no mainnet or public testnet deployment. Solidity tests are not an independent audit. Screenshot review is not a formal accessibility audit. Optional tournaments, badge minting and advanced analysis remain explicitly unavailable. See GAME_ENGINE.md and THREAT_MODEL.md for rule and production-operation limitations.

The Vite build reports a dependency's `node:worker_threads` module externalized for the browser; build succeeds and exercised wallet flows pass. The app uses the EVM paths, not that dependency's worker feature.
