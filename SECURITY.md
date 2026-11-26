# Security

The Cloudflare implementation enforces exact-origin writes and WebSockets, hashed opaque sessions, per-message socket session checks, one-use browser-bound SIWE challenges, private wallets by default, bounded decoded/re-encoded images, parameterized SQL, authoritative legal moves, revision checks, exclusive active-player claims and idempotent result application.

Escrow uses SafeERC20, balance-delta validation, reentrancy guards, fixed participants, EIP-712 chain/contract separation, nonces, funding/recovery/dispute deadlines, and a trusted authority. Creator cancellation is permitted only before the opponent deposits and refunds the creator's existing deposit. Pausing cannot prevent expired recovery. Mainnet deployment is rejected.

Open risks: no independent audit, no automated chess anti-cheat, no production identity/financial compliance, no MFA, no managed signing-key custody, no production email retry queue, no operational abuse console, and no load-tested scale guarantee. D1 rate-limit writes themselves consume quota. Password hashing and JPEG processing require CPU measurement on the selected Worker plan. A malicious upload can still consume bounded decode CPU; do not claim complete resource-abuse prevention.

For account deletion, match records are retained for opponents/rating integrity. Do not promise erasure of transactions already published on a blockchain. See the original `docs/THREAT_MODEL.md` for the legacy runtime's assumptions; those do not replace review of the new Worker runtime.
