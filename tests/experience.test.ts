import { describe, it, expect } from 'vitest';
import {
  boardThemes,
  pieceSets,
  appearanceSchema,
  defaultAppearance,
  squareContrast,
  chatPrefsSchema,
} from '../packages/shared/experience';
import { controlValues } from '../packages/shared/types';
describe('appearance and time-control boundaries', () => {
  it('ships complete distinct catalogs with readable square separation', () => {
    expect(new Set(boardThemes.map((t) => t.id)).size).toBe(16);
    expect(new Set(pieceSets.map((p) => p.id)).size).toBe(8);
    for (const t of boardThemes) expect(squareContrast(t.light, t.dark)).toBeGreaterThan(1.5);
  });
  it('rejects malformed colors, collections and unbounded feedback settings', () => {
    for (const patch of [
      { customLightSquare: 'url(https://bad)' },
      { pieceSetId: 'missing' },
      { soundVolume: 3 },
      { animationSpeed: 'infinite' },
    ])
      expect(appearanceSchema.safeParse({ ...defaultAppearance, ...patch }).success).toBe(false);
    expect(chatPrefsSchema.safeParse({ visibility: 'public-world' }).success).toBe(false);
  });
  it('bounds custom clocks and increments without changing presets', () => {
    expect(controlValues('3+2')).toEqual([180, 2]);
    expect(controlValues('12+7')).toEqual([720, 7]);
    for (const value of ['0+0', '181+1', '1+181', '-1+0', '1.5+0', 'evil'])
      expect(controlValues(value)).toBeNull();
  });
});
