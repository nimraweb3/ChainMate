# Third-party notices

The original application code and artwork are MIT. Dependencies retain their original notices and licenses in node_modules and the lockfile identifies exact versions.

## Stockfish.js 19.0.1

GPL-3.0. The unmodified lite single-thread worker and WASM are copied from the installed npm package by `scripts/assets.mjs`. Its GPL license is served at `/engine/COPYING.txt`. This is a separate worker accessed through the UCI protocol, not proprietary engine code. Distribution of Stockfish binaries must preserve GPL notices and provide corresponding source, including build scripts and neural-network source inputs required by that release. Source repository: https://github.com/nmrugg/stockfish.js (release/tag matching npm 19.0.1). Upstream Stockfish: https://github.com/official-stockfish/Stockfish. Do not strip the worker's license header.

Before distributing a modified engine, publish the corresponding modified source and satisfy its GPL terms. The application does not claim that its own MIT notice overrides engine obligations.

## Other principal dependencies

* chess.js: BSD-2-Clause, https://github.com/jhlywa/chess.js
* react-chessboard: MIT, https://github.com/Clariity/react-chessboard
* React, Vite, React Router, Express, Socket.IO, wagmi, viem, OpenZeppelin: their published permissive licenses and notices.
* PGlite: Apache-2.0; embedded PostgreSQL retains its own license.
* Instrument Serif and Manrope: SIL Open Font License 1.1, included in their @fontsource packages.
* Lucide icons: ISC, https://lucide.dev/license
* Foundry: MIT OR Apache-2.0.

No third-party photographs or proprietary chess artwork are used.
