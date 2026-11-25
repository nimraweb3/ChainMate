# Threat model

This is a local/testnet portfolio implementation, not an audited or production-ready wagering service.

## Trust boundaries

The Node server controls chess state and signed results. Its signer is also the dispute arbiter. A compromised signer can submit or resolve an incorrect result, but the contract only sends a match's funds to its named participants. The signer cannot select an arbitrary withdrawal destination. The chain, token, RPC, application host, dependency supply chain and players' wallets are additional trusted components.

An anchored canonical record hash demonstrates consistency with the signed off-chain record; it does not prove fair play or defeat engine assistance. No claim of decentralized chess verification or reliable anti-cheat detection is made.

## Implemented defenses

- Server-side legal moves, participant checks, turn checks and revisions.
- PostgreSQL transactions and one-time rated-result application.
- Random opaque session tokens stored as hashes, HttpOnly SameSite=Strict cookies, expiry and socket revalidation.
- Salted scrypt password hashes; minimum 12-character passwords; input limits and authentication rate limits.
- Exact allowed HTTP/WebSocket origins. The frontend and API are intended to share an origin through a proxy.
- SIWE nonce consumption, domain/URI/chain/expiry/signature checks and unique wallet ownership.
- EIP-712 domain separation, per-match nonce, expiry, fixed participants, fixed allowlisted token, exact transfer balance checks, state guards and reentrancy protection.
- Chain ID restrictions in constructors: only Anvil 31337 and Base Sepolia 84532.
- Recovery remains available when new funding/results are paused.
- Frontend uses bigint for every token amount; private signer remains server-side in ignored `.env`.

## Recovery and authority limits

Unfunded/partially funded challenges refund after 15 minutes. Active matches and unresolved disputes refund after 24 hours. Pending results are publicly settleable after a 120-second dispute window; either named participant can dispute before it closes. The authority may resolve only a disputed match, only to white, black, or a draw, and only before recovery. Settlement/recovery are mutually exclusive terminal states.

The two-minute dispute period is deliberately short for a local demo and unsuitable as a default for a public-value system. Block timestamps are coarse and validator-controlled; do not interpret deadline displays as exact real-time guarantees.

## Remaining risks / unimplemented controls

No independent contract audit, formal verification, robust anti-cheat, moderator report/review tools, email delivery/verification, production password-reset transport, multi-instance synchronization, production observability, backups/recovery drills, key rotation/HSM, finality/reorg-aware event indexer or production abuse controls. A player can still use an external engine. There is no direct user-configurable profile-visibility setting; public data is restricted at query time. Spectating and in-match analysis are absent. The database must remain private.

Local reset mail lives in ignored `.local/mail`, never returned by the API. Production does not deliver reset mail until a proper mail transport is implemented. Never expose the local Anvil RPC publicly. Its test accounts are intentionally unlocked and have no real value. Do not import real private keys into local test tooling.
