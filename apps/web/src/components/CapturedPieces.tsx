import type { Move } from 'chess.js';
import { useAppearance } from '../appearance';
import { Sculpture } from './ChessPieces';
export default function CapturedPieces({ history }: { history: Move[] }) {
  const { appearance } = useAppearance();
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const score = (color: string) =>
    history
      .filter((m) => m.color === color && m.captured)
      .reduce((s, m) => s + values[m.captured!], 0);
  const advantage = score('w') - score('b');
  return (
    <div className="material-strip" aria-label="Captured material">
      {['w', 'b'].map((color) => (
        <div key={color}>
          <small>{color === 'w' ? 'White' : 'Black'} captured</small>
          <span>
            {history
              .filter((m) => m.color === color && m.captured)
              .sort((a, b) => values[a.captured!] - values[b.captured!])
              .map((m, i) => (
                <span className="captured-vector" key={i} title={m.captured}>
                  <Sculpture
                    kind={m.captured!.toUpperCase()}
                    white={color === 'b'}
                    collection={appearance.pieceSetId}
                  />
                </span>
              ))}
          </span>
          {(color === 'w' ? advantage : -advantage) > 0 && <b>+{Math.abs(advantage)}</b>}
        </div>
      ))}
    </div>
  );
}
