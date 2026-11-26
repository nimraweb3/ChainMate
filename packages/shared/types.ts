export type User = {
  id: string;
  username: string;
  rating: number;
  bio: string;
  joined: string;
  wallet?: string | null;
  display_name?: string;
  country?: string;
  avatar?: string | null;
  banner?: string | null;
  private?: number;
  wallet_public?: number;
  email_verified?: number;
  email?: string;
  settings?: { board: 'slate' | 'warm'; muted: boolean; notifications: boolean; network: string };
};
export type Outcome = 'white' | 'black' | 'draw';
export type GameState = {
  id: string;
  white: string;
  black: string | null;
  whiteName: string;
  blackName: string;
  fen: string;
  pgn: string;
  moves: string[];
  revision: number;
  status: 'waiting' | 'active' | 'finished';
  outcome: Outcome | null;
  reason: string | null;
  whiteMs: number;
  blackMs: number;
  lastTick: number;
  increment: number;
  control: string;
  rated: boolean;
  drawOffer: string | null;
  created: number;
  expires: number;
  chainMatch?: string;
};
export const controls = {
  '1+0': [60, 0],
  '3+2': [180, 2],
  '5+0': [300, 0],
  '10+0': [600, 0],
  '15+10': [900, 10],
} as const;
export type Control = keyof typeof controls;
export function controlValues(value: string): readonly [number, number] | null {
  if (value in controls) return controls[value as Control];
  const m = /^(\d{1,3})\+(\d{1,3})$/.exec(value);
  if (!m) return null;
  const minutes = Number(m[1]),
    increment = Number(m[2]);
  return minutes >= 1 && minutes <= 180 && increment <= 180 ? [minutes * 60, increment] : null;
}
export const bots = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    title: 'The OG',
    difficulty: 'Beginner',
    description: 'Patient, traditional, and always up for another game.',
    skill: 0,
    depth: 2,
    time: 120,
    color: '#d6a158',
    symbol: '₿',
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    title: 'The Strategist',
    difficulty: 'Intermediate',
    description: 'A calculated mind. A tactical eye. Think two moves ahead.',
    skill: 8,
    depth: 8,
    time: 450,
    color: '#a9b7d2',
    symbol: '◇',
  },
  {
    id: 'solana',
    name: 'Solana',
    title: 'The Speedster',
    difficulty: 'Advanced',
    description: 'Fast development. Relentless pressure. Bring your best.',
    skill: 18,
    depth: 15,
    time: 1200,
    color: '#83b5a3',
    symbol: '≋',
  },
] as const;
