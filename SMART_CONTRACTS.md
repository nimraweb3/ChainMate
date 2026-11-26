# Smart contracts

See `packages/contracts/src/ChessEscrow.sol`, `MockToken.sol`, the Foundry suites, and `docs/SMART_CONTRACTS.md` for the original design.

The current escrow adds creator cancellation before the opponent has deposited, with immediate refund of an existing creator deposit. After the opponent funds, normal expiry/recovery and result settlement rules apply. Unauthorized and repeated cancellation are rejected. The shared ABI and Arena action use the actual method.

Local deployment: `pnpm chain` in one terminal, then `pnpm contracts:deploy`; public local addresses are written to ignored `.local/deployment.json`, with a fresh private local result signer in ignored `.env`. Restart the API/Worker after deployment. No public Base Sepolia or Mainnet contract address is claimed by this document.

The Worker checks funded wallet ownership, creates the authoritative match, and signs a typed result only after completion. The scheduled indexer verifies configured contract logs, persists transaction/log identities idempotently, waits for confirmations and detects cursor-block reorganizations. Public rollout still requires independent security review and signer operations.
