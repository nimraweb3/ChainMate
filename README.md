# ChainMate

**Every move matters.** A modern chess club with guest Stockfish play, authenticated realtime matches, and an optional, explicitly trusted, test-token escrow Arena.

Built as a full-stack/Web3 portfolio project: the chess game remains useful without a wallet, while the Arena connects actual on-chain deposits to server-verified match results. This is a local/testnet implementation with known limitations, not an audited production wagering service.

## Run locally

Requires Node.js 24+ and pnpm 11.16+. No Docker or paid service is needed for ordinary chess.

```sh
pnpm install --frozen-lockfile
pnpm assets
pnpm dev
```

Open http://127.0.0.1:5173. The API listens on 127.0.0.1:3001. First startup initializes persistent embedded PostgreSQL under `.data/postgres` and can take several seconds. Accounts, games and ratings survive restarts. The app starts with no fabricated players or leaderboard entries.

The frontend proxies `/api` and `/socket.io` to the API. Keep one dev server/API process per data directory. Both `localhost:5173` and `127.0.0.1:5173` are accepted development origins; use one consistently because browser cookies are host-specific.

## What works

* Original responsive green/ivory/gold homepage, editorial typography, CSS/SVG chess artwork, scroll camera movement, light/dark themes and reduced motion.
* Guest chess against Bitcoin, Ethereum and Solana: three real Stockfish worker configurations, no invented Elo claims.
* Legal moves, castling, en passant, promotion choice, tap/drag and keyboard moves, last-move/check highlights, clocks, resignation, rematch, PGN download and completed-game replay.
* Email/password registration/login/logout, salted password hashing, expiring cookie sessions, local password-reset mail, profiles and online history.
* Private invitations, casual/rated quick matchmaking, authenticated Socket.IO, authoritative moves/clocks, reconnect state and atomic/idempotent Elo updates.
* Injected EVM wallets, chain switching, SIWE authentication/linking, local demo-token faucet, two-player escrow, signed completed-game records, dispute period, settlement and recovery.
* Foundry security/fuzz tests, rule/API tests, browser tests for bots and two-session multiplayer, and a two-wallet local-chain browser harness.

## Local test-token Arena

In a separate terminal:

```sh
pnpm chain
```

Then:

```sh
pnpm contracts:deploy
```

Restart `pnpm dev` after deployment. The deployment script **only permits local chain 31337**, deploys the mock token and escrow, generates a fresh result-signer key, and writes ignored `.env` configuration. It preserves unrelated existing environment variables. Public deployment information is in `.local/deployment.json`.

For manual wallet testing, add local network `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH`. Use disposable Anvil test accounts only. Anvil prints its public development accounts on startup. Two separate browser profiles/wallet accounts are needed for two human participants; never use real funds or real private keys.

1. Connect each test wallet in `/arena` and sign the SIWE message.
2. Get free cmUSD demo tokens using the faucet.
3. White creates a challenge naming black's address and a stake.
4. Share the Arena match URL. Each player approves and deposits the same stake.
5. Enter the linked 10+0 casual chess match after both deposits are confirmed.
6. Finish the game, return to the Arena and submit the server's signed result.
7. After 120 seconds without a dispute, settle. Winner receives both deposits; a draw refunds both.

Funding expires after 15 minutes. Unfinished or disputed matches have a 24-hour refund recovery path. A trusted arbiter can resolve a dispute before recovery. The browser transaction timeline reflects receipts, not simulated timers.

Restarting Anvil clears its chain unless you configure Anvil persistence. Redeploy contracts after a chain reset and restart the API. Old database matches may refer to the old local chain; they remain historical records, not evidence of current deposits.

## PostgreSQL / configuration

Copy `.env.example` to `.env` only if you need to change defaults. Do not overwrite the generated signer configuration after local deployment.

Optional external PostgreSQL:

```sh
docker compose up -d postgres
# Set DATABASE_URL=postgresql://chainmate:chainmate@localhost:5432/chainmate in .env
pnpm dev
```

The API applies `apps/api/migrations/001_initial.sql` at startup. PostgreSQL and PGlite use the same parameterized SQL. Prisma and Redis were intentionally omitted from this single-process implementation; see `docs/ARCHITECTURE.md` for the rationale and scale-out limitations. Local reset emails are written into ignored `.local/mail`; production email delivery/verification is not implemented.

Key variables: `PORT`, `ORIGIN`, `DATA_DIR`, optional `DATABASE_URL`, `CHAIN_ID`, `RPC_URL`, `TOKEN_ADDRESS`, `ESCROW_ADDRESS`, `RESULT_SIGNER_KEY`. The private signer must never be named with a `VITE_` prefix or shipped to the client.

## Verification

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm contracts:test
pnpm exec playwright install chromium
# With the app running:
pnpm test:e2e
```

The Arena browser test requires a running Anvil, deployed contracts and a restarted API. It uses two explicit EIP-1193 test adapters backed by distinct unlocked local wallets, not a real browser-wallet extension. It performs real transactions and checks token balances. Without contract configuration it is explicitly skipped. See `docs/VERIFICATION.md` for the actual results of this build.

## Repository guide

```text
apps/web/              React screens, CSS, optimized original artwork
apps/api/              Express/Socket.IO API and SQL migration
packages/game-core/    Rules integration, clocks, outcomes, Elo
packages/shared/       Shared types, controls, bot settings, ABIs
packages/contracts/    Solidity escrow/token and Foundry suite
scripts/               Engine assets, local deployment, tooling
tests/                 Rule/API and browser end-to-end suites
docs/                  Architecture, threat model, design, deployment
```

## Design and supplied skill

The supplied `lets-scroll` SKILL.md informed camera pacing, static fallbacks, mobile handling and reduced-motion behavior. The subsequent premium redesign adds original generated chrome/pearl chess artwork, large editorial typography, a legal-move board preview and a shared product visual system. The paid generated-video chain is not enabled. See `docs/DESIGN_SYSTEM.md`, `docs/ARTWORK.md` and `docs/CINEMATIC_ASSETS.md`.

## Security and limits

The server and result signer are trusted. A record hash proves record consistency, not that a player avoided engine assistance. Contracts are unaudited and restricted to Anvil/Base Sepolia, with no mainnet support. The API is single-process, matchmaking is ephemeral, and production email, anti-cheat review, distributed coordination, durable event indexing and operational hardening remain unfinished. Optional tournaments, on-chain badges and advanced postgame analysis are explicitly unavailable rather than simulated.

Threefold repetition and the fifty-move rule are automatic club draws in this version. Exact tournament claim procedures and all rare dead-position/time-forfeit adjudications need further work; see `docs/GAME_ENGINE.md`.

## Deployment

No public deployment is performed by the local setup script. The frontend can be hosted as Vite static output, but the API needs a persistent Node process and PostgreSQL. A static-only preview is not a deployed full-stack product. See `docs/DEPLOYMENT.md` before exposing the app.

## Licensing and contributions

Original ChainMate application code is MIT; see `LICENSE`. Third-party code retains its own license. Stockfish.js is GPL-3.0 and distributed as a separate worker with its license and corresponding source information; see `THIRD_PARTY_NOTICES.md`. Fonts are OFL. Original SVG/CSS artwork is created in this repository.

Contributions should include focused tests for game state, authentication or escrow changes. Run the checks above, document changed trust assumptions, and never commit `.env`, `.data`, private keys or generated wallet credentials. Do not describe unexecuted tests as passing or enable real-money stakes.
