import { useId } from 'react';

// Original vector silhouettes: consistent bases, readable crowns, metallic materials.
function Sculpture({ kind, white }: { kind: string; white: boolean }) {
  const id = useId().replace(/:/g, '');
  const shapes: Record<string, React.ReactNode> = {
    P: (
      <>
        <circle cx="32" cy="17" r="8" />
        <path d="M26 25h12l-2 6c0 7 2 12 7 16H21c5-4 7-9 7-16Z" />
      </>
    ),
    R: (
      <>
        <path d="M18 10h7v7h4v-7h6v7h4v-7h7v14l-6 5 2 18H22l2-18-6-5Z" />
        <path d="M23 28h18M23 32h18" fill="none" />
      </>
    ),
    N: (
      <>
        <path d="m19 45 4-12 13-10-9 1-8 6-6-5 8-13 9-3 4-6 4 8c13 5 14 20 9 36H19Z" />
        <path d="m38 17 6 8-2 15M22 18l7-3" fill="none" />
        <circle cx="29" cy="18" r="1.8" fill={white ? '#34404b' : '#edf0ed'} stroke="none" />
      </>
    ),
    B: (
      <>
        <path d="M32 5c-3 5-13 11-13 20 0 6 6 10 13 10s13-4 13-10C45 16 35 10 32 5Z" />
        <path d="m35 13-7 14" fill="none" strokeWidth="3" />
        <path d="M26 35h12l-2 5 8 7H20l8-7Z" />
      </>
    ),
    Q: (
      <>
        <path d="m17 17 8 9 7-14 7 14 8-9-5 23H22Z" />
        <circle cx="16" cy="14" r="3" />
        <circle cx="32" cy="9" r="3" />
        <circle cx="48" cy="14" r="3" />
        <path d="M23 40h18l3 7H20Z" />
        <path d="M24 34h16" fill="none" />
      </>
    ),
    K: (
      <>
        <path d="M29 5h6v5h6v5h-6v7h-6v-7h-6v-5h6Z" />
        <path d="M23 38c-3-5-8-9-6-15 2-5 10-4 15 1 5-5 13-6 15-1 2 6-3 10-6 15l2 9H21Z" />
        <path d="M24 38h16M32 25v10" fill="none" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      className={`sculpted-piece ${white ? 'pearl' : 'graphite'}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2=".35">
          {(white
            ? ['#929fa7', '#fffef5', '#e4e8e5', '#a5b1b8']
            : ['#101923', '#526575', '#18232e', '#080e15']
          ).map((color, i) => (
            <stop key={i} offset={`${(i * 100) / 3}%`} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="57" rx="22" ry="3.5" fill="#071018" opacity=".22" />
      <g
        fill={`url(#${id})`}
        stroke={white ? '#475865' : '#a7bbc7'}
        strokeWidth="1.35"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {shapes[kind]}
        <path d="M20 47h24l4 5v4H16v-4Z" />
        <path d="M19 52h26" fill="none" opacity=".7" />
      </g>
    </svg>
  );
}
export const sculptedPieces = Object.fromEntries(
  ['w', 'b'].flatMap((color) =>
    ['P', 'R', 'N', 'B', 'Q', 'K'].map((kind) => [
      color + kind,
      () => <Sculpture kind={kind} white={color === 'w'} />,
    ]),
  ),
);
