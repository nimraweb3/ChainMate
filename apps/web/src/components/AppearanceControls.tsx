import { useState } from 'react';
import {
  boardThemes,
  pieceSets,
  squareContrast,
  type Appearance,
} from '../../../../packages/shared/experience';
import { Sculpture } from './ChessPieces';
export default function AppearanceControls({
  value,
  onChange,
  compact = false,
}: {
  value: Appearance;
  onChange: (v: Appearance) => void;
  compact?: boolean;
}) {
  const [tab, setTab] = useState('Boards'),
    [category, setCategory] = useState('All');
  const update = (p: Partial<Appearance>) => onChange({ ...value, ...p });
  const check = (key: keyof Appearance, label: string) => (
    <label className="pref-check">
      <input
        type="checkbox"
        checked={!!value[key]}
        onChange={(e) => update({ [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <div className="appearance-controls">
      <nav className="studio-tabs" aria-label="Appearance sections">
        {['Boards', 'Pieces', 'Highlights', 'Sounds', 'Advanced'].map((t) => (
          <button key={t} aria-pressed={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === 'Boards' && (
        <>
          <label>
            Collection
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {['All', 'Classic', 'Minimal', 'Luxury', 'Nature', 'Modern', 'Experimental'].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <div className={'theme-gallery ' + (compact ? 'compact' : '')}>
            {boardThemes
              .filter((t) => category === 'All' || category === t.category)
              .map((t) => (
                <button
                  className="theme-option"
                  key={t.id}
                  aria-pressed={!value.customColors && t.id === value.boardThemeId}
                  onClick={() => update({ boardThemeId: t.id, customColors: false })}
                >
                  <span
                    className="theme-swatch"
                    style={{
                      background: `conic-gradient(${t.dark} 25%,${t.light} 0 50%,${t.dark} 0 75%,${t.light} 0)`,
                      backgroundSize: '50% 50%',
                    }}
                  />
                  <span>{t.name}</span>
                </button>
              ))}
          </div>
        </>
      )}
      {tab === 'Pieces' && (
        <div className="piece-gallery">
          {pieceSets.map((s) => (
            <button
              key={s.id}
              aria-pressed={value.pieceSetId === s.id}
              onClick={() => update({ pieceSetId: s.id })}
            >
              <span>
                <Sculpture kind="N" white collection={s.id} />
                <Sculpture kind="K" white={false} collection={s.id} />
              </span>
              {s.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'Highlights' && (
        <div className="studio-fields">
          {check('showCoordinates', 'Coordinates')}
          {check('showLegalMoves', 'Legal move indicators')}
          {check('highlightLastMove', 'Last move')}
          {check('highlightCheck', 'Check warning')}
          {['highlightColor', 'selectionColor', 'legalColor'].map((key, i) => (
            <label key={key}>
              {['Last-move color', 'Selection color', 'Legal-move color'][i]}
              <input
                type="color"
                value={value[key as keyof Appearance] as string}
                onChange={(e) => update({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
      {tab === 'Sounds' && (
        <div className="studio-fields">
          {check('soundEnabled', 'Sound effects')}
          <label>
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={value.soundVolume}
              onChange={(e) => update({ soundVolume: +e.target.value })}
            />
          </label>
          {check('reducedFeedback', 'Reduced feedback')}
          <p>Quiet, original synthesized tones. Audio starts only after you interact.</p>
        </div>
      )}
      {tab === 'Advanced' && (
        <div className="studio-fields">
          <label>
            Orientation
            <select
              value={value.boardOrientation}
              onChange={(e) =>
                update({ boardOrientation: e.target.value as Appearance['boardOrientation'] })
              }
            >
              <option value="auto">My side</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label>
            Move animation
            <select
              value={value.animationSpeed}
              onChange={(e) =>
                update({ animationSpeed: e.target.value as Appearance['animationSpeed'] })
              }
            >
              {['off', 'fast', 'normal', 'smooth'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Board border
            <select
              value={value.border}
              onChange={(e) => update({ border: e.target.value as Appearance['border'] })}
            >
              {['soft', 'slim', 'none'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Surroundings
            <select
              value={value.background}
              onChange={(e) => update({ background: e.target.value as Appearance['background'] })}
            >
              {['mist', 'charcoal', 'sand'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {check('texture', 'Subtle board texture')}
          {check('highContrast', 'Stronger piece outlines')}
          {check('customColors', 'Custom square colors')}
          {value.customColors && (
            <>
              {['customLightSquare', 'customDarkSquare'].map((key, i) => (
                <label key={key}>
                  {i ? 'Dark squares' : 'Light squares'}
                  <input
                    type="color"
                    value={value[key as keyof Appearance] as string}
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                </label>
              ))}
              {squareContrast(value.customLightSquare, value.customDarkSquare) < 1.5 && (
                <p role="alert">
                  These squares are difficult to distinguish. Increase contrast before applying.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
