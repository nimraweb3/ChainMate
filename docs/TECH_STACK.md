# Technical stack and decisions

* React 19 and TypeScript 6: interactive, typed UI. TypeScript 6 is selected because the current typescript-eslint release rejects TypeScript 7. The lockfile pins the resolved versions.
* Vite 8 and React Router 7: fast local development and lazy client routes. The production host must provide SPA fallback and proxy API/WebSocket paths.
* Plain tokenized CSS: deliberate editorial composition and light/dark palettes without a generic component template. Manrope and Instrument Serif are locally bundled OFL fonts.
* chess.js 1.4: maintained BSD-2-Clause chess rules. react-chessboard 5: MIT board renderer, with its current `options` object API. A separate typed move form provides a keyboard alternative.
* Stockfish.js 19 lite single-thread WASM: real UCI engine in a worker, skill/depth/time settings for three opponents. GPL-3.0; worker and license are copied with `pnpm assets`. No engine is loaded in human games.
* Express 5 and Socket.IO 4: persistent Node API, authenticated realtime updates, server clocks and reconnect synchronization.
* PGlite 0.6 / pg: real embedded PostgreSQL for local use; external PostgreSQL via `DATABASE_URL`. Parameterized SQL and transactions keep the small persistence layer inspectable.
* Zod: runtime input validation at HTTP and socket boundaries.
* wagmi 3, viem 2 and TanStack Query: injected-wallet discovery, chain switching, signatures, bigint amounts and confirmed transactions.
* Solidity 0.8.28, OpenZeppelin 5 and Foundry: test-only ERC20, typed-result escrow, reentrancy guard, safe token transfers and fuzz tests. The Solidity compiler is pinned in foundry.toml.
* Vitest and Playwright: rule/API tests, real two-browser multiplayer, and a two-wallet Anvil provider harness. ESLint and Prettier provide mechanical source checks/formatting.

Primary API references checked during implementation:

* https://github.com/Clariity/react-chessboard
* https://github.com/nmrugg/stockfish.js
* https://pglite.dev/docs/
* Installed TypeScript definitions for wagmi/viem/react-chessboard.

Versions were resolved from the npm registry during this build rather than guessed. No dependency is claimed to be permanently vulnerability-free; run the audit command and review advisories before deployment.
