import type { TripOptions } from '@traveldiary/core';

type NumericOption = 'homeRadiusKm' | 'maxGapDays' | 'stopRadiusKm' | 'minPhotosPerTrip';

const SLIDERS: { key: NumericOption; label: string; min: number; max: number; step: number; unit: string; hint: string }[] = [
  { key: 'homeRadiusKm', label: 'Home radius', min: 5, max: 300, step: 5, unit: 'km', hint: 'Photos closer to home than this don’t count as travel.' },
  { key: 'maxGapDays', label: 'Split trips after', min: 1, max: 14, step: 1, unit: 'days', hint: 'A gap this long without photos starts a new trip.' },
  { key: 'stopRadiusKm', label: 'Stop size', min: 2, max: 150, step: 1, unit: 'km', hint: 'Photos within this distance are grouped into one stop.' },
  { key: 'minPhotosPerTrip', label: 'Min photos per trip', min: 1, max: 20, step: 1, unit: '', hint: 'Ignore trips with fewer photos (e.g. one stray picture).' },
];

interface Props {
  options: TripOptions;
  onChange: (o: TripOptions) => void;
  geocode: boolean;
  onGeocodeChange: (on: boolean) => void;
  homeOverridden: boolean;
  onResetHome: () => void;
}

export function Settings({ options, onChange, geocode, onGeocodeChange, homeOverridden, onResetHome }: Props) {
  return (
    <details className="settings">
      <summary>⚙️ Settings</summary>
      {SLIDERS.map((s) => (
        <label key={s.key} className="slider" title={s.hint}>
          <span>
            {s.label} <b>{options[s.key]} {s.unit}</b>
          </span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={options[s.key]}
            onChange={(e) => onChange({ ...options, [s.key]: Number(e.target.value) })}
          />
          <small>{s.hint}</small>
        </label>
      ))}
      <label className="check">
        <input type="checkbox" checked={geocode} onChange={(e) => onGeocodeChange(e.target.checked)} />
        Look up place names (sends stop coordinates to OpenStreetMap)
      </label>
      {homeOverridden && (
        <button className="link" onClick={onResetHome}>
          Detect home automatically again
        </button>
      )}
    </details>
  );
}
