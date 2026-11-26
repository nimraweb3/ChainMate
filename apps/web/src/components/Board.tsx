import { useState, type CSSProperties } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { pieceCollections } from './ChessPieces';
import { useAppearance } from '../appearance';
import { boardThemes, type Appearance } from '../../../../packages/shared/experience';
export default function Board({
  chess,
  onMove,
  disabled = false,
  flipped = false,
  lastMove,
  appearance: override,
  arrows = false,
}: {
  chess: Chess;
  onMove: (from: string, to: string, promotion: string) => boolean;
  disabled?: boolean;
  flipped?: boolean;
  lastMove?: { from: string; to: string };
  warm?: boolean;
  appearance?: Appearance;
  arrows?: boolean;
}) {
  const { appearance: saved } = useAppearance();
  const prefs = override || saved;
  const theme = boardThemes.find((t) => t.id === prefs.boardThemeId) || boardThemes[0];
  const light = prefs.customColors ? prefs.customLightSquare : theme.light,
    dark = prefs.customColors ? prefs.customDarkSquare : theme.dark;
  const [selected, setSelected] = useState<string | null>(null),
    [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null),
    [notation, setNotation] = useState(''),
    [message, setMessage] = useState('');
  const styles: Record<string, CSSProperties> = {};
  if (lastMove && prefs.highlightLastMove) {
    styles[lastMove.from] = {
      boxShadow: 'inset 0 0 0 3px #c3e1e88a',
      backgroundColor: prefs.highlightColor,
    };
    styles[lastMove.to] = {
      boxShadow: 'inset 0 0 0 3px #d5edf0bb',
      backgroundColor: prefs.highlightColor,
    };
  }
  if (selected) {
    styles[selected] = {
      backgroundColor: prefs.selectionColor,
      boxShadow: 'inset 0 0 0 3px #e2f4f3',
    };
    for (const m of prefs.showLegalMoves
      ? chess.moves({ square: selected as Square, verbose: true })
      : [])
      styles[m.to] = {
        backgroundImage: chess.get(m.to)
          ? `radial-gradient(circle, transparent 58%, ${prefs.legalColor}aa 60%, ${prefs.legalColor}aa 69%, transparent 71%)`
          : `radial-gradient(circle, ${prefs.legalColor}99 17%, transparent 21%)`,
      };
  }
  if (chess.isCheck() && prefs.highlightCheck) {
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
      <div
        className={`chessboard-wrap atelier-board border-${prefs.border} ${prefs.highContrast ? 'high-contrast' : ''}`}
        data-theme={prefs.boardThemeId}
        data-pieces={prefs.pieceSetId}
        data-fen={chess.fen()}
      >
        <Chessboard
          options={{
            position: chess.fen(),
            boardOrientation: flipped ? 'black' : 'white',
            pieces: pieceCollections[prefs.pieceSetId],
            showNotation: prefs.showCoordinates,
            allowDrawingArrows: arrows,
            darkSquareStyle: {
              backgroundColor: dark,
              backgroundImage: prefs.texture
                ? 'repeating-linear-gradient(15deg,transparent 0 6px,#00000008 7px 8px)'
                : 'none',
              boxShadow: 'inset 0 0 0 .5px #ffffff0a',
            },
            lightSquareStyle: {
              backgroundColor: light,
              backgroundImage: 'none',
              boxShadow: 'inset 0 0 0 .5px #0000000a',
            },
            darkSquareNotationStyle: { color: '#edf2ef', fontSize: '10px', fontWeight: 600 },
            lightSquareNotationStyle: { color: '#425761', fontSize: '10px', fontWeight: 600 },
            squareStyles: styles,
            allowDragging: !disabled,
            allowAutoScroll: false,
            animationDurationInMs: { off: 0, fast: 100, normal: 180, smooth: 300 }[
              prefs.animationSpeed
            ],
            showAnimations:
              prefs.animationSpeed !== 'off' &&
              !prefs.reducedFeedback &&
              !matchMedia('(prefers-reduced-motion: reduce)').matches,
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
