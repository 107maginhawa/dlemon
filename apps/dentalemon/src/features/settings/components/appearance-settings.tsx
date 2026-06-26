import { useState } from 'react';
import { isWhiteTheme, setWhiteTheme } from '@/lib/appearance';

/**
 * Appearance panel — pick the app theme. Client-only (per-device), no backend.
 * Default = the standard lemon/Apple look; White = white surfaces, black
 * soft-line outlines, Shantell/Nunito type.
 */
export function AppearanceSettings() {
  const [white, setWhite] = useState(isWhiteTheme());

  function choose(on: boolean) {
    setWhiteTheme(on);
    setWhite(on);
  }

  const options = [
    { label: 'Default', on: false },
    { label: 'White', on: true },
  ] as const;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          Theme
        </label>
        <div className="flex gap-2">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => choose(o.on)}
              aria-pressed={white === o.on}
              className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                white === o.on
                  ? 'bg-lemon text-lemon-foreground'
                  : 'border border-border hover:bg-secondary'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          White uses crisp white surfaces with black outlines and a hand-lettered
          display font. Saved on this device.
        </p>
      </div>
    </div>
  );
}
