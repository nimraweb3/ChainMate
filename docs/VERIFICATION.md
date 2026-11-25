# Verification — 25 November 2026

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
