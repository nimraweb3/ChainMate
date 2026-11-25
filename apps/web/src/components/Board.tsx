import { useState, type CSSProperties } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { sculptedPieces } from './ChessPieces';
export default function Board({
  chess,
  onMove,
  disabled = false,
  flipped = false,
  lastMove,
  warm = false,
}: {
  chess: Chess;
  onMove: (from: string, to: string, promotion: string) => boolean;
  disabled?: boolean;
  flipped?: boolean;
  lastMove?: { from: string; to: string };
  warm?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null),
    [notation, setNotation] = useState(''),
    [message, setMessage] = useState('');
  const styles: Record<string, CSSProperties> = {};
  if (lastMove) {
    styles[lastMove.from] = {
      boxShadow: 'inset 0 0 0 3px #c3e1e88a',
      backgroundColor: warm ? '#b39c75' : '#849fa7',
    };
    styles[lastMove.to] = {
      boxShadow: 'inset 0 0 0 3px #d5edf0bb',
      backgroundColor: warm ? '#b39c75' : '#849fa7',
    };
  }
  if (selected) {
    styles[selected] = { backgroundColor: '#8eafb8', boxShadow: 'inset 0 0 0 3px #e2f4f3' };
    for (const m of chess.moves({ square: selected as Square, verbose: true }))
      styles[m.to] = {
        backgroundImage: chess.get(m.to)
          ? 'radial-gradient(circle, transparent 58%, #b0dce5b0 60%, #b0dce5b0 69%, transparent 71%)'
          : 'radial-gradient(circle, #213d4b80 17%, #d9f0ed70 19%, transparent 23%)',
      };
  }
  if (chess.isCheck()) {
    for (const rank of chess.board())
      for (const p of rank)
        if (p?.type === 'k' && p.color === chess.turn())
          styles[p.square] = { backgroundColor: '#b85f53' };
  }
  function attempt(from: string, to: string) {
    if (disabled) return false;
    const options = chess
      .moves({ square: from as Square, verbose: true })
      .filter((m) => m.to === to);
    if (!options.length) return false;
    if (options.some((m) => m.promotion)) {
      setPromotion({ from, to });
      return false;
    }
    const ok = onMove(from, to, 'q');
    if (ok) setSelected(null);
    return ok;
  }
  function click(square: string) {
    if (disabled) return;
    if (selected && attempt(selected, square)) return;
    setSelected(chess.get(square as Square)?.color === chess.turn() ? square : null);
  }
  return (
    <>
      <div className={`chessboard-wrap atelier-board ${warm ? 'walnut-board' : ''}`}>
        <Chessboard
          options={{
            position: chess.fen(),
            boardOrientation: flipped ? 'black' : 'white',
            pieces: sculptedPieces,
            darkSquareStyle: {
              backgroundColor: warm ? '#8b6c53' : '#596e7b',
              backgroundImage: 'linear-gradient(135deg, #ffffff0a, #07101916)',
              boxShadow: 'inset 0 0 0 .5px #ffffff0a',
            },
            lightSquareStyle: {
              backgroundColor: warm ? '#e2d5ba' : '#dce1dc',
              backgroundImage: 'linear-gradient(135deg, #ffffff25, #758b9810)',
              boxShadow: 'inset 0 0 0 .5px #0000000a',
            },
            darkSquareNotationStyle: { color: '#edf2ef', fontSize: '10px', fontWeight: 600 },
            lightSquareNotationStyle: { color: '#425761', fontSize: '10px', fontWeight: 600 },
            squareStyles: styles,
            allowDragging: !disabled,
            allowAutoScroll: false,
            animationDurationInMs: 150,
            showAnimations: !matchMedia('(prefers-reduced-motion: reduce)').matches,
            onPieceDrop: ({ sourceSquare, targetSquare }) =>
              !!targetSquare && attempt(sourceSquare, targetSquare),
            onSquareClick: ({ square }) => click(square),
          }}
        />
      </div>
      {promotion && (
        <div className="promotion-panel" role="group" aria-label="Choose promotion piece">
          <strong>Promote your pawn</strong>
          {['q', 'r', 'b', 'n'].map((p, i) => (
            <button
              autoFocus={i === 0}
              key={p}
              onClick={() => {
                onMove(promotion.from, promotion.to, p);
                setPromotion(null);
                setSelected(null);
              }}
            >
              {['Queen', 'Rook', 'Bishop', 'Knight'][i]}
            </button>
          ))}
        </div>
      )}
      <form
        className="keyboard-move"
        onSubmit={(e) => {
          e.preventDefault();
          const match = notation.toLowerCase().match(/^([a-h][1-8])\s*([a-h][1-8])([qrbn])?$/);
          if (match && !disabled && onMove(match[1], match[2], match[3] || 'q')) {
            setNotation('');
            setMessage('Move played.');
          } else setMessage('Enter a legal move such as e2e4.');
        }}
      >
        <label htmlFor="keyboard-move">Keyboard move</label>
        <input
          id="keyboard-move"
          placeholder="e2e4"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          maxLength={8}
          disabled={disabled}
        />
        <button disabled={disabled}>Move</button>
        <span className="sr-only" aria-live="polite">
          {message}
        </span>
      </form>
    </>
  );
}
