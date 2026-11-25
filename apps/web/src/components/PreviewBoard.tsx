import { useState } from 'react';
import { Chess } from 'chess.js';
import { RotateCcw } from 'lucide-react';
import Board from './Board';
function opening() {
  const c = new Chess();
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3'].forEach((m) => c.move(m));
  return c;
}
export default function PreviewBoard() {
  const [chess, setChess] = useState(opening);
  const last = chess.history({ verbose: true }).at(-1);
  return (
    <>
      <div className="preview-top">
        <span>
          <i /> YOUR BOARD. YOUR POSSIBILITIES.
        </span>
        <button onClick={() => setChess(opening())} aria-label="Reset preview board">
          <RotateCcw size={16} />
        </button>
      </div>
      <Board
        chess={chess}
        lastMove={last}
        disabled={chess.isGameOver()}
        onMove={(from, to, promotion) => {
          try {
            const next = new Chess();
            next.loadPgn(chess.pgn());
            next.move({ from, to, promotion });
            setChess(next);
            return true;
          } catch {
            return false;
          }
        }}
      />
      <div className="preview-bottom">
        <span>
          {chess.isCheckmate()
            ? 'Checkmate'
            : chess.isDraw()
              ? 'Draw'
              : chess.turn() === 'w'
                ? 'White to move'
                : 'Black to move'}
          {chess.isCheck() ? ' · Check' : ''}
        </span>
        <span>INTERACTIVE PREVIEW / SICILIAN DEFENCE</span>
      </div>
    </>
  );
}
