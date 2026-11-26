import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chess, type PieceSymbol } from 'chess.js';
import { Sculpture } from '../components/ChessPieces';
import Board from '../components/Board';
import { useAppearance } from '../appearance';
import { api, useAuth } from '../lib';
export const lessons = [
  {
    id: 'k',
    name: 'King',
    text: 'One square in any direction. Your king may never move into check. The rook controls the d-file: step out of danger.',
    target: 'e4',
  },
  {
    id: 'q',
    name: 'Queen',
    text: 'Any number of clear squares along a rank, file or diagonal. The queen cannot jump over another piece.',
    target: 'g7',
  },
  {
    id: 'r',
    name: 'Rook',
    text: 'Move along a rank or file, as far as the clear path allows. Castling is a special move with your king.',
    target: 'd7',
  },
  {
    id: 'b',
    name: 'Bishop',
    text: 'Travel along diagonals. A bishop stays on the same color of square for the entire game.',
    target: 'g7',
  },
  {
    id: 'n',
    name: 'Knight',
    text: 'Two squares in one direction and one to the side. The knight can jump over other pieces.',
    target: 'f5',
  },
  {
    id: 'p',
    name: 'Pawn',
    text: 'Move one square forward into an empty square; capture diagonally forward. From its starting square a pawn may advance two. On the last rank, choose a promotion.',
    target: 'e5',
  },
] as const;
function position(id: PieceSymbol) {
  const c = new Chess();
  c.clear();
  c.put({ type: 'k', color: 'b' }, 'a8');
  if (id !== 'k') c.put({ type: 'k', color: 'w' }, 'h1');
  c.put({ type: id, color: 'w' }, 'd4');
  if (id === 'k') c.put({ type: 'r', color: 'b' }, 'd8');
  if (id === 'p') c.put({ type: 'p', color: 'b' }, 'e5');
  return new Chess(c.fen());
}
export default function LearnPieces() {
  const { user } = useAuth(),
    { appearance } = useAppearance();
  const [lesson, setLesson] = useState(0),
    [chess, setChess] = useState(() => position('k')),
    [feedback, setFeedback] = useState(''),
    [progress, setProgress] = useState<string[]>([]);
  const item = lessons[lesson];
  useEffect(() => {
    if (user)
      api('/experience')
        .then((r) => setProgress(r.progress))
        .catch(() => {});
    else {
      try {
        setProgress(JSON.parse(localStorage.getItem('cm-lessons') || '[]'));
      } catch {}
    }
  }, [user?.id]);
  function choose(i: number) {
    setLesson(i);
    setChess(position(lessons[i].id));
    setFeedback('');
  }
  function move(from: string, to: string, promotion: string) {
    try {
      const c = new Chess(chess.fen());
      const moved = c.move({ from, to, promotion });
      if (moved.piece !== item.id) {
        setFeedback('Try moving the featured piece.');
        return false;
      }
      setChess(c);
      if (to === item.target) {
        const next = [...new Set([...progress, item.id])];
        setProgress(next);
        setFeedback('Beautifully played. Lesson complete.');
        if (user)
          api('/experience', { lesson: item.id }, 'PATCH').catch(() =>
            setFeedback('Correct move. Progress could not sync; try again.'),
          );
        else
          try {
            localStorage.setItem('cm-lessons', JSON.stringify(next));
          } catch {}
      } else setFeedback('Legal move. Reset to try the target square.');
      return true;
    } catch {
      setFeedback('That move is not legal. Look for a highlighted square.');
      return false;
    }
  }
  return (
    <div className="learn-page">
      <header className="studio-heading">
        <div>
          <p className="eyebrow">THE CHAINMATE ACADEMY</p>
          <h1>
            Every piece.
            <br />
            <em>A possibility.</em>
          </h1>
        </div>
        <Link to="/settings/board">Open Board Studio ↗</Link>
      </header>
      <div className="learn-layout">
        <section className="piece-exhibit">
          <div className="exhibit-sculpture">
            <Sculpture kind={item.id.toUpperCase()} white collection={appearance.pieceSetId} />
            <h2>{item.name}</h2>
          </div>
          <nav aria-label="Piece lessons">
            {lessons.map((l, i) => (
              <button
                key={l.id}
                aria-label={l.name + ' lesson'}
                aria-pressed={i === lesson}
                onClick={() => choose(i)}
              >
                <Sculpture kind={l.id.toUpperCase()} white collection={appearance.pieceSetId} />
                <span>
                  {l.name}
                  {progress.includes(l.id) ? ' ✓' : ''}
                </span>
              </button>
            ))}
          </nav>
          <h3>How to move the {item.name.toLowerCase()}</h3>
          <p>{item.text}</p>
          <p className="eyebrow">{progress.length} OF 6 LESSONS COMPLETE</p>
        </section>
        <section className="lesson-board">
          <p className="eyebrow">YOUR TURN TO DISCOVER</p>
          <h2>Find your way to {item.target}.</h2>
          <p>Select the {item.name.toLowerCase()} on d4 to reveal legal moves.</p>
          <Board
            chess={chess}
            onMove={move}
            arrows
            disabled={chess.turn() === 'b'}
            lastMove={chess.history({ verbose: true }).at(-1)}
          />
          <p role="status">{feedback}</p>
          <div className="studio-preview-actions">
            <button onClick={() => choose(lesson)}>Reset exercise</button>
            <button onClick={() => choose((lesson + 1) % 6)}>Next lesson →</button>
          </div>
        </section>
      </div>
    </div>
  );
}
