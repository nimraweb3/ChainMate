import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useAppearance } from '../appearance';
import { useAuth } from '../lib';
import { defaultAppearance, squareContrast } from '../../../../packages/shared/experience';
import Board from '../components/Board';
import AppearanceControls from '../components/AppearanceControls';
export default function BoardStudio() {
  const { appearance, apply, error, guest, loaded } = useAppearance(),
    { user } = useAuth();
  const [draft, setDraft] = useState(appearance),
    [chess, setChess] = useState(() => new Chess()),
    [flipped, setFlipped] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    setDraft(appearance);
  }, [loaded]);
  function move(from: string, to: string, promotion: string) {
    try {
      const c = new Chess(chess.fen());
      c.move({ from, to, promotion });
      setChess(c);
      return true;
    } catch {
      return false;
    }
  }
  return (
    <div className={'studio-page surface-' + draft.background}>
      <header className="studio-heading">
        <div>
          <p className="eyebrow">YOUR BOARD. YOUR POINT OF VIEW.</p>
          <h1>
            Board <em>Studio.</em>
          </h1>
          <p>A familiar game, made entirely yours.</p>
        </div>
        <Link to="/play">Back to play ↗</Link>
      </header>
      {guest && user && (
        <div className="notice">
          Your account preferences are active. Your guest palette is also available.
          <button
            onClick={() => {
              setDraft(guest);
              setMessage('Guest palette loaded into preview. Apply to save it to your account.');
            }}
          >
            Preview guest palette
          </button>
        </div>
      )}
      <div className="studio-layout">
        <section className="studio-preview">
          <div className="studio-preview-title">
            <span>LIVE PREVIEW</span>
            <button onClick={() => setFlipped((v) => !v)}>Flip preview</button>
          </div>
          <Board
            chess={chess}
            onMove={move}
            flipped={
              draft.boardOrientation === 'auto' ? flipped : draft.boardOrientation === 'black'
            }
            appearance={draft}
            arrows
            lastMove={chess.history({ verbose: true }).at(-1)}
          />
          <div className="studio-preview-actions">
            <button onClick={() => setChess(new Chess())}>Reset position</button>
            <button onClick={() => setChess(new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'))}>
              Try a capture
            </button>
            <button onClick={() => setChess(new Chess('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'))}>
              Try escaping check
            </button>
          </div>
          <p>Move either side. Right-click and drag to draw an analysis arrow.</p>
          <details>
            <summary>Explore special moves</summary>
            <label>
              Practice position
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) setChess(new Chess(e.target.value));
                }}
              >
                <option value="">Choose a position</option>
                <option value="4k3/P7/8/8/8/8/8/4K3 w - - 0 1">Promotion</option>
                <option value="4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1">Castling</option>
                <option value="4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2">En passant</option>
              </select>
            </label>
          </details>
        </section>
        <section className="studio-options">
          <AppearanceControls value={draft} onChange={setDraft} />
          <div className="studio-save">
            <button
              className="button"
              disabled={
                !loaded ||
                (draft.customColors &&
                  squareContrast(draft.customLightSquare, draft.customDarkSquare) < 1.25)
              }
              onClick={() => {
                apply(draft)
                  .then(() => setMessage(user ? 'Saved to your account.' : 'Saved on this device.'))
                  .catch(() => {});
              }}
            >
              Apply appearance
            </button>
            <button
              onClick={() => {
                setDraft(defaultAppearance);
                setMessage('Default palette previewed. Apply to save.');
              }}
            >
              Reset to default
            </button>
          </div>
          <p role="status">{error || message}</p>
        </section>
      </div>
    </div>
  );
}
