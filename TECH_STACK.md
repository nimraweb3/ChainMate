# Platform stack

React 19, TypeScript and Vite preserve the existing premium frontend. Original vector chess pieces use SVG gradients; cinematic still artwork is optimized WebP. chess.js validates moves; Stockfish 19 runs in a browser worker.

Cloudflare Workers hosts a Hono API. Durable Objects serialize game/queue operations and use hibernating WebSockets and alarms. D1 provides SQLite persistence with explicit migrations. R2 stores controlled profile media. jpeg-js validates and re-encodes bounded JPEG uploads in the Worker. No Node process, PostgreSQL server or Socket.IO service is required for the Cloudflare deployment.

wagmi and viem manage EVM wallets, network reads and transactions. Solidity/OpenZeppelin contracts are checked with Foundry. Playwright covers browser journeys; Vitest covers the shared rules and original API. Wrangler runs the actual local Worker runtime and packages production artifacts.

The original Express/Socket.IO/PGlite runtime remains available, with an automatic frontend realtime adapter choosing the matching transport from `/api/health`. This is an intentional migration path, not a claim that Socket.IO runs unchanged in Workers.
