# ChainMate implementation plan

1. Foundation: React/TypeScript, original ivory/gold/green design, accessible navigation, four connected scroll scenes, light/dark themes. Accept when mobile and desktop render with no overflow.
2. Play: chess.js validation, react-chessboard, worker Stockfish, clocks, promotion, replay and PGN. Accept when legal/illegal moves and three bot configurations pass browser checks.
3. Accounts and competition: persistent PostgreSQL, password sessions, private challenges, queues, authoritative moves/clocks, atomic results and ratings. Accept with two isolated sessions and reconnect tests.
4. Arena: test-only ERC20 and EIP-712 escrow, wallet auth, two-player funding, server verification, dispute/recovery and transaction UI. Accept through local two-wallet tests and security tests.
5. Review: meaningful tests, responsive review, setup, architecture, licensing and limitations.

The provided lets-scroll SKILL.md guides continuous camera composition, pacing, reduced motion and future frame-handoff assets. Its supporting references were not supplied. The brief explicitly prioritizes a no-cost original CSS/SVG experience; no paid rendering is authorized. Four forward scenes are specified already, so no redundant creative interview is needed.

Local adaptation: Docker and native PostgreSQL are absent. Use PGlite (real embedded PostgreSQL) for zero-service local development and the same parameterized SQL migrations with pg for external PostgreSQL. Avoid a second schema/ORM representation for this first implementation. A single API process owns matchmaking and serializes game mutations; multi-instance operation is not supported.
