# Environment configuration

| Name                                          | Purpose                                             | Exposure                                                     |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| ENVIRONMENT                                   | local, staging or production                        | Wrangler vars                                                |
| CHAIN_ID                                      | 31337 locally, 84532 publicly                       | Wrangler vars                                                |
| MAINNET_FINANCIAL_ENABLED                     | Must be false                                       | Wrangler vars, enforced                                      |
| RPC_URL                                       | Configured testnet RPC                              | Runtime secret if provider key included                      |
| ESCROW_ADDRESS / TOKEN_ADDRESS                | Actual deployed testnet contracts                   | Public values, runtime bindings                              |
| RESULT_SIGNER_KEY                             | Testnet result authority                            | Worker secret only                                           |
| INDEX_START_BLOCK                             | Escrow deployment block                             | Runtime binding                                              |
| BASE_RPC_URL / BASE_SEPOLIA_RPC_URL           | SIWE verification RPCs for other supported networks | Runtime secrets if keyed                                     |
| VITE_BASE_RPC_URL / VITE_BASE_SEPOLIA_RPC_URL | Optional browser RPC endpoints                      | Public build-time values; never private provider credentials |
| VITE_WALLETCONNECT_PROJECT_ID                 | Optional WalletConnect connector                    | Public project identifier, restrict allowed origins          |
| EMAIL_API_KEY / EMAIL_FROM                    | Resend key and verified sender                      | Worker secrets                                               |
| DB / MEDIA / ROOMS / LOBBY / ASSETS           | D1, R2, Durable Objects and static assets           | Wrangler resource bindings                                   |

Sessions are opaque database-backed random tokens; no JWT/session-signing secret is needed. Origin is derived from the deployed request origin and compared exactly, so a custom domain is not required. `.dev.vars` and `.env` are ignored local files; production values must be configured independently. No signer key belongs in a `VITE_` variable.
