# Deployment boundaries

Local development is the verified target. No paid infrastructure or public-chain deployment has been purchased or authorized.

`pnpm build` produces `dist/`. A static web host must provide SPA fallback to index.html and reverse-proxy `/api` and `/socket.io` to a persistent Node process. Preserve WebSocket upgrade headers and cookies. Configure HTTPS, a single exact `ORIGIN`, secure cookies (`NODE_ENV=production`), database access restrictions and secrets outside the source tree. The API currently binds loopback; put a local reverse proxy in front of it or deliberately change binding in a controlled container environment.

The API can run with `pnpm exec tsx apps/api/src/server.ts` (tsx is a development dependency, so install it in the deployment runtime or produce a separate server build). Configure `DATABASE_URL` to PostgreSQL. PGlite is a convenient single-process local store, not a horizontally scaled hosted database. Redis is not provisioned.

Sites hosting supports Workers/static artifacts, while this implementation requires persistent Node sockets. Publishing only the frontend would disconnect core functionality. No incomplete static-only application is published as a full-stack product.

Base Sepolia is configured in the wallet client (84532, https://sepolia.base.org), but no public testnet contract has been deployed. Deployment and signer provisioning need an explicit public-testnet procedure, a funded test account, verified RPC/explorer configuration and operational review. The supplied deploy script intentionally refuses nonlocal chain IDs. Mainnet is prohibited by contract construction and application configuration.

Before public use: implement real mail delivery/verification, durable/reorg-aware chain indexing, abuse monitoring/reporting, backups, key rotation, complete rare chess adjudication, distributed ownership if scaling, independent contract review and a deployment smoke test with real wallet extensions. Review actual host pricing and persistent-process limits at deployment time; no free-tier promise is made.
