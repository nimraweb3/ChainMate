# Cloudflare deployment

The Cloudflare implementation is in `apps/worker/`. The original Express/PostgreSQL implementation remains available for compatibility; it is not deployed inside Workers. No existing PostgreSQL data has been deleted or silently migrated.

## Local runtime

```powershell
pnpm install
pnpm assets
pnpm db:local
pnpm build
pnpm dev:cloudflare
```

Open http://127.0.0.1:8787. This serves the built React application and Worker API from one origin with real local D1, R2 and Durable Objects. Rebuild after frontend edits. Worker edits reload automatically. `pnpm dev` still starts the original Node/Vite implementation at 5173; new platform features require the Cloudflare runtime.

For local blockchain testing, in a second terminal run `pnpm chain`, then `pnpm contracts:deploy`. Restart `pnpm dev:cloudflare` so the generated ignored local `.env` signer configuration is loaded. Never reuse this signer outside local development. The wallet adapters in tests submit real Anvil transactions; they are not a real extension or public-testnet validation.

```powershell
pnpm typecheck
pnpm typecheck:worker
pnpm lint
pnpm test
pnpm contracts:test
pnpm build:worker
pnpm test:cloudflare
```

## Account and resource setup

Wrangler, cf and the Cloudflare Codex MCP server were authenticated on 26 November 2026. Staging D1 was created and migrated, and the private R2 bucket was provisioned. The Worker deployment succeeded at https://chainmate-staging.chainmate.workers.dev (version 8a83bf22-7de4-4ab3-8db8-c120561ab2c1). Initial TLS provisioning took several minutes; HTTPS health and configuration checks now return 200. Public-testnet contracts and email delivery are not configured. See docs/VERIFICATION.md for browser results.

```powershell
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm exec wrangler d1 create chainmate-staging
pnpm exec wrangler r2 bucket create chainmate-media-staging
node scripts/prepare-cloudflare.mjs staging ACTUAL_D1_UUID ACTUAL_BUCKET_NAME
pnpm exec wrangler d1 migrations apply chainmate-staging --remote --config wrangler.staging.json
```

Use the real ID and bucket name returned by Cloudflare. The preparation script writes an ignored environment-specific configuration; it does not provision anything. Review remote migrations before applying them. The checked-in local configuration contains an unmistakable local-only zero UUID. `pnpm deploy:cloudflare` rejects missing production bindings.

R2 may require billing enrollment. Confirm the account's existing plan and billing status before enabling paid resources. Do not accept a billing upgrade automatically. A custom domain is not required: `workers_dev: true` requests Cloudflare's actual assigned platform subdomain.

## Testnet setup

Deploy `MockToken` and `ChessEscrow` on Base Sepolia with a separately funded testnet deployer and a separate result-authority address. The local deployment script deliberately targets Anvil only. Public-testnet deployment must use the reviewed Solidity artifacts and an explicitly selected signer; no public-testnet signer or gas funds were supplied in this session.

Configure runtime values using Wrangler secrets (addresses are public but can use the same binding mechanism):

```powershell
pnpm exec wrangler secret put ESCROW_ADDRESS --config wrangler.staging.json
pnpm exec wrangler secret put TOKEN_ADDRESS --config wrangler.staging.json
pnpm exec wrangler secret put RESULT_SIGNER_KEY --config wrangler.staging.json
pnpm exec wrangler secret put RPC_URL --config wrangler.staging.json
pnpm exec wrangler secret put INDEX_START_BLOCK --config wrangler.staging.json
```

Use the escrow deployment block as `INDEX_START_BLOCK`. Never put private signing keys in Vite variables, Git, command arguments or screenshots. Mainnet financial mode must remain false; contracts also reject Mainnet deployment. Ordinary chess and profiles work without testnet configuration; Arena explicitly reports it as unavailable.

Optional email delivery: configure `EMAIL_API_KEY` and `EMAIL_FROM` for a verified Resend sender. Without them the production reset endpoint returns an explicit unavailable response. Local email links are stored only in D1 `mail_outbox`; no delivery is claimed.

## Build, deploy and verify

```powershell
pnpm build
pnpm typecheck:worker
pnpm deploy:cloudflare -- wrangler.staging.json
```

The script disables automatic loading of local dotenv secrets for deployment. Use the actual URL returned by Wrangler. Verify `/api/health`, refresh `/play/bot`, register two disposable accounts, upload an avatar/banner, reload profiles, play a private match across two browser contexts, reconnect, finish and replay. Inspect real Base Sepolia receipts and the scheduled event indexer before claiming the escrow demo is live.

For production, repeat provisioning with distinct `chainmate-production` D1 and a distinct R2 bucket, then `node scripts/prepare-cloudflare.mjs production ACTUAL_D1_UUID ACTUAL_BUCKET_NAME`, apply reviewed migrations, configure separate secrets, and use `pnpm deploy:cloudflare`. Never share staging sessions, databases or signing keys with production.

## Data migration and rollback

The local PostgreSQL database is preserved at `.data/postgres`. D1 has a separate migration directory and schema. There is no automatic production-data importer: export and back up any real existing records, resolve case-insensitive username collisions, map wallet relations, and validate row counts and game PGNs before a planned cutover. Never point D1 at PostgreSQL or overwrite either database. Roll back application versions with Wrangler; coordinate schema rollback with a backup/Time Travel recovery plan.

## Costs and operational limits

Cloudflare's current Workers Free limit is 100,000 requests/day and 10 ms CPU per invocation. Password hashing, JPEG decoding and some contract verification may exceed that CPU budget; they need actual deployed CPU measurement before a free-tier launch can be promised. Do not weaken password hashing to fit a plan. R2 Standard includes 10 GB-month storage, 1 million Class A and 10 million Class B operations/month; overages are billed. Free D1 has 500 MB per database and 5 GB aggregate storage. The lobby is a serialized coordinator suitable for a modest portfolio load, not an unlimited-scale matchmaking service.

Sources checked during implementation: [React/Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/), [static assets](https://developers.cloudflare.com/workers/static-assets/), [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [platform subdomains](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).
