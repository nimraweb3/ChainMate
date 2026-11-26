# Wallets and networks

Installed EVM wallets use wagmi's injected/EIP-6963 discovery (MetaMask, Rabby and compatible browser providers). No private key or seed phrase is requested. SIWE is verified in the Worker; account linking is separate from connection. The WalletConnect connector is conditionally enabled when `VITE_WALLETCONNECT_PROJECT_ID` is set before building. No project ID was supplied, so it is absent in the default build and has not been validated against the external relay. Restrict the project's allowed origins to the deployed application.

Base Mainnet (8453) supports native ETH balance reads, address copying, receive QR and explorer links. Base Sepolia (84532) supports the test-token escrow configuration. Anvil (31337) is local-only. Wallet rejection, network switching and RPC errors are surfaced. Mainnet money matches and vault/custodial deposits are disabled at the API/configuration and Solidity deployment boundaries.

The wallet page separates external ETH, external cmUSD and confirmed active escrow. Pending/unconfirmed deposits are not counted as spendable application funds. Activity comes from the server's confirmed event index, not browser-supplied receipts. A free test-token faucet exists only on the demo token. Settlement/recovery actions send actual wallet transactions and wait for successful receipts.

Base public RPC endpoints are rate-limited best-effort infrastructure; use a dedicated provider for a public launch. No Mainnet ERC-20 allowlist has been configured, so the UI does not invent ERC-20 balances. See [Base's official network details](https://docs.base.org/get-started/connect-to-base).
