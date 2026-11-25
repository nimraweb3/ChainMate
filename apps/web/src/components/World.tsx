import { useEffect, useRef } from 'react';
const pieces = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
function Piece({ type, dark = false }: { type: string; dark?: boolean }) {
  return (
    <svg
      className={dark ? 'sculpture dark-piece' : 'sculpture'}
      viewBox="0 0 80 110"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={dark ? 'ebony' : 'ivory'}>
          <stop stopColor={dark ? '#17211e' : '#f7e4bd'} />
          <stop offset=".48" stopColor={dark ? '#647168' : '#fff5dc'} />
          <stop offset="1" stopColor={dark ? '#1b2421' : '#bda172'} />
        </linearGradient>
      </defs>
      <g
        fill={`url(#${dark ? 'ebony' : 'ivory'})`}
        stroke={dark ? '#111b17' : '#c9ae80'}
        strokeWidth="1.2"
      >
        <ellipse cx="40" cy="100" rx="32" ry="7" />
        <path d="M12 98L17 89Q29 87 31 72L34 42H46L49 72Q51 87 63 89L68 98Z" />
        <ellipse cx="40" cy="88" rx="23" ry="5" />
        {type === 'n' ? (
          <path d="M23 57L25 43L19 42L22 27L34 16L37 5L47 12Q68 26 57 65L29 65L36 48Z" />
        ) : type === 'r' ? (
          <path d="M24 50L22 20H17V7H28V18H35V7H45V18H52V7H63V20H58L56 50Z" />
        ) : type === 'k' ? (
          <>
            <path d="M25 47L21 29L33 25V17H27V9H34V2H46V9H53V17H47V25L59 29L55 47Z" />
            <ellipse cx="40" cy="49" rx="19" ry="5" />
          </>
        ) : type === 'q' ? (
          <>
            <path d="M23 45L16 17L29 29L40 8L51 29L64 17L57 45Z" />
            <circle cx="40" cy="7" r="5" />
            <ellipse cx="40" cy="49" rx="19" ry="5" />
          </>
        ) : type === 'b' ? (
          <>
            <path d="M40 6Q12 34 26 45Q40 53 54 45Q68 34 40 6Z" />
            <path d="M46 17L36 34" stroke={dark ? '#121a17' : '#ac8c58'} strokeWidth="4" />
          </>
        ) : (
          <circle cx="40" cy="30" r="16" />
        )}
        <ellipse cx="40" cy="56" rx="19" ry="5" />
      </g>
      {type === 'n' && <circle cx="34" cy="26" r="2.5" fill={dark ? '#c5a46d' : '#4b473a'} />}
    </svg>
  );
}
export default function World({ small = false }: { small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (small || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const p = Math.min(window.scrollY / 1800, 1);
        ref.current?.style.setProperty('--flight', String(p));
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
    };
  }, [small]);
  return (
    <div
      className={'world ' + (small ? 'world-small' : '')}
      ref={ref}
      role="img"
      aria-label="An original sculptural chessboard in ivory and dark green"
    >
      <div className="world-halo" />
      <div className="orbital orbit-one" />
      <div className="orbital orbit-two" />
      <div className="board-stage">
        <div className="board-edge" />
        <div className="world-board">
          {Array.from({ length: 64 }, (_, i) => {
            const row = Math.floor(i / 8),
              col = i % 8;
            let type = row === 0 || row === 7 ? pieces[col] : row === 1 || row === 6 ? 'p' : null;
            if (i === 52) type = null;
            if (i === 36) type = 'p';
            if (i === 12) type = null;
            if (i === 28) type = 'p';
            return (
              <div key={i} className={'world-square ' + ((row + col) % 2 ? 'forest' : 'cream')}>
                {type && (
                  <div className="piece-standing">
                    <Piece type={type} dark={row < 4} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="world-caption">
        <span className="tiny-line" />
        THE BOARD IS YOURS.
      </div>
      {!small && (
        <div className="position-note">
          <span className="note-dot" /> OPENING POSSIBILITIES
          <br />
          <strong>One board. Infinite stories.</strong>
        </div>
      )}
    </div>
  );
}
