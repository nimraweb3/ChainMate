# Test-token escrow

`MockToken` is a six-decimal ERC20 with an unrestricted test faucet. Its tokens have no value. `ChessEscrow` accepts exactly that configured token and fixes two distinct participant addresses and a bounded stake at creation.

States: None → Open → Active → Pending → Settled. Pending may become Disputed; the arbiter may resolve it to Settled. Open may be recovered after its funding deadline; Active or Disputed after recovery deadline, transitioning to Cancelled. Pending stays publicly settleable after the dispute window. No arbitrary administrator withdrawal exists.

Fund transfers exactly one stake. Token balance deltas reject fee-on-transfer behavior. The initial deployment is a known fixed-balance mock token; rebasing tokens are unsupported. `SafeERC20`, `ReentrancyGuard` and checks-effects-interactions protect transfers. New actions can be paused by the authority; refunds and settlement remain available.

Result EIP-712 domain: `ChainMate`, version `1`, chain ID and verifying contract. Struct: match ID, white, black, outcome, canonical record hash, per-match nonce and expiry. Outcome 1=white, 2=black, 3=draw. Used results cannot be replayed in the same match, another match, chain or contract.

The server produces canonical JSON in fixed field order: version, game ID, chain match ID, white user ID, black user ID, PGN, final FEN, outcome, reason. Keccak256 of UTF-8 bytes is signed and stored on-chain. The attestation endpoint returns the canonical string for independent recomputation.

The same trusted authority signs outcomes and resolves disputes. This is explicit centralization. A real-value product would need independent audit, operational key management, appropriate dispute duration/evidence workflows and legal review. No such product is enabled here.
