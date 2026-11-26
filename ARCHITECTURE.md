# Cloudflare architecture

React/Vite static assets and a Hono Worker API share one origin. The existing chess.js game core and browser Stockfish worker are reused. `apps/worker/migrations/` is a new D1 SQLite schema; the original Node/PostgreSQL runtime is retained separately.

Each GameRoom Durable Object owns a match, serializes events, authenticates each socket message against the current session, validates legal moves/turn/revision, persists state, and schedules an alarm at clock expiry. WebSocket attachments survive hibernation. Clients interpolate clock display between authoritative events. No per-second D1 clock writes are needed. A durable dirty marker and retry alarm recover failed D1 projections.

The Lobby Durable Object coordinates matchmaking, exclusive active-player claims and result/ratings updates. A single D1 batch applies each result once, updates category ratings/history and earned achievements, and releases active-player claims. Invitations and game creation are persisted before room initialization, so initialization can be retried from D1. Matchmaking queue entries expire after two minutes; unmatched clients can search again.

R2 stores server-decoded/re-encoded JPEGs under random owner-scoped keys. Worker reads enforce the current profile privacy setting and current image pointer; buckets are not public. D1 stores profile fields, wallet ownership, opaque-session hashes, one-time challenges, history, achievements and chain-index cursors.

Scheduled events invoke a serialized indexer through the Lobby. Only configured testnet contract logs are processed; the cursor resumes after interruptions. A cursor hash mismatch clears the derived chain projection for a rescan. Reorg handling is conservative, not an instant finality guarantee. Base Sepolia uses 12 confirmations; local Anvil uses zero. Cursor batches scan 500 blocks, so set the initial deployment block and monitor lag.

The result authority signs EIP-712 attestations only for completed authoritative matches with the funded wallet participants. Mainnet wallet reads are independent from escrow authorization. See MAINNET_READINESS.md.
