# Chess behavior

chess.js owns legal moves, SAN, FEN, PGN, castling rights, en passant, promotion, check/mate, stalemate and basic insufficient material. The API reconstructs from PGN to preserve repetition history. A client submits only source, destination, promotion and expected revision, never a final FEN or declared winner.

Standard time controls: 1+0, 3+2, 5+0, 10+0, 15+10. Server elapsed-time accounting runs on each move/action and at one-second persistence/broadcast intervals. The game starts when a second participant joins. Disconnection does not stop the clock. Local bot clocks begin after the first move and are intentionally noncompetitive; they are never used for ratings or escrow.

Bitcoin uses skill 0/depth 2/120ms; Ethereum skill 8/depth 8/450ms; Solana skill 18/depth 15/1200ms. These are engine limits, not measured Elo ratings. Stockfish runs only in guest practice. Workers terminate on unmount/rematch; human matches never instantiate the engine.

Completed human games can replay and export PGN. Completed bot games support immediate replay/rematch and keep a bounded local record. The board supports tap, drag and UCI-style keyboard entry (`e2e4`, `a7a8n`). Promotion on tap/drag offers queen, rook, bishop and knight. The keyboard form uses queen by default unless a suffix is supplied.

Club draw rules automatically end on threefold repetition or 100 half-moves. These differ from formal claim-based tournament procedures and should be shown in any future rated-event rules. The rules library does not solve arbitrary dead positions. Rare time-forfeit positions that depend on a theoretically possible cooperative mate need a more complete adjudicator before tournament use. This limitation is not hidden behind a claim of complete FIDE adjudication.
