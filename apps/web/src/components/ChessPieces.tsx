import { useId } from 'react';

// Original vector silhouettes: consistent bases, readable crowns, metallic materials.
export function Sculpture({
  kind,
  white,
  collection = 'pearl',
}: {
  kind: string;
  white: boolean;
  collection?: string;
}) {
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
  const geometric: Record<string, React.ReactNode> = {
    P: (
      <>
        <circle cx="32" cy="18" r="8" />
        <path d="M27 28h10l5 19H22Z" />
      </>
    ),
    R: <path d="M19 10h7v7h4v-7h4v7h4v-7h7v17H40v20H24V27h-5Z" />,
    N: <path d="m20 47 5-18-10-1 7-16 12-7 12 15-5 27ZM26 17h5" />,
    B: (
      <>
        <path d="m32 7 13 17-13 11-13-11Z" />
        <path d="M27 34h10l6 13H21Z" />
        <path d="m35 15-6 13" fill="none" />
      </>
    ),
    Q: <path d="m16 14 9 12 7-17 7 17 9-12-7 33H23Z" />,
    K: (
      <>
        <path d="M29 5h6v6h7v6h-7v8h-6v-8h-7v-6h7Z" />
        <path d="m23 27 9-5 9 5v10l4 10H19l4-10Z" />
      </>
    ),
  };
  const flat = ['minimal', 'neo', 'cyber'].includes(collection);
  const palette =
    collection === 'wood'
      ? white
        ? ['#95734a', '#f5ddb0', '#d3b88b', '#84603b']
        : ['#321c12', '#9b6944', '#5c3824', '#24160e']
      : collection === 'metal'
        ? white
          ? ['#546777', '#ffffff', '#dce4ed', '#5b6c81']
          : ['#04070c', '#86929f', '#1e2732', '#050a10']
        : collection === 'glass'
          ? white
            ? ['#a4d3df', '#f5ffff', '#d9f3f6', '#89bdcc']
            : ['#183f51', '#75a6bd', '#2a637b', '#153d51']
          : white
            ? ['#929fa7', '#fffef5', '#e4e8e5', '#a5b1b8']
            : ['#101923', '#526575', '#18232e', '#080e15'];
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      className={`sculpted-piece collection-${collection} ${white ? 'pearl' : 'graphite'}`}
      aria-hidden="true"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2=".35">
          {palette.map((color, i) => (
            <stop key={i} offset={`${(i * 100) / 3}%`} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="57" rx="22" ry="3.5" fill="#071018" opacity=".22" />
      <g
        fill={flat || collection === 'staunton' ? (white ? '#faf6e8' : '#202c35') : `url(#${id})`}
        stroke={white ? '#475865' : '#a7bbc7'}
        strokeWidth={collection === 'neo' ? 2.6 : collection === 'minimal' ? 1.8 : 1.35}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {flat ? geometric[kind] : shapes[kind]}
        {collection === 'minimal' ? (
          <rect x="20" y="47" width="24" height="8" rx="3" />
        ) : collection === 'neo' ? (
          <path d="m20 47-6 9h36l-6-9Z" />
        ) : (
          <path d="M20 47h24l4 5v4H16v-4Z" />
        )}
        <path d="M19 52h26" fill="none" opacity=".7" />
        {collection === 'cyber' && (
          <path
            d="M23 49h18M28 36v7m8-7v7"
            fill="none"
            stroke={white ? '#287a99' : '#7ad8ef'}
            strokeWidth="2"
          />
        )}
        {collection === 'wood' && (
          <path d="m28 31 2 14m5-15 2 15M22 50h20" fill="none" opacity=".3" />
        )}
        {collection === 'glass' && (
          <path d="M24 30v10m-3 9 3 4h15" fill="none" stroke="#fff" opacity=".85" strokeWidth="2" />
        )}
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
export const pieceCollections = Object.fromEntries(
  ['staunton', 'pearl', 'minimal', 'metal', 'wood', 'neo', 'glass', 'cyber'].map((collection) => [
    collection,
    Object.fromEntries(
      ['w', 'b'].flatMap((color) =>
        ['P', 'R', 'N', 'B', 'Q', 'K'].map((kind) => [
          color + kind,
          () => <Sculpture kind={kind} white={color === 'w'} collection={collection} />,
        ]),
      ),
    ),
  ]),
);
