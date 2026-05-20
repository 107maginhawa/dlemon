/**
 * FiveSurfaceSelector — interactive 5-surface tooth diagram
 *
 * Shows SVG surfacemap + 5 clickable surface pill toggles for a selected tooth.
 * Switches between "incisal" (anterior) and "occlusal" (posterior).
 *
 * Wireframe: docs/prd/context/wireframes/ws-tooth-slideout.html
 */

import React from 'react';
import { getSurfacesForTooth, isAnteriorTooth } from './five-surface-selector.helpers';
import type { ToothSurface } from './five-surface-selector.helpers';
import { UniversalToothFdi } from './dental/universal-tooth-fdi';

export interface FiveSurfaceSelectorProps {
  toothNumber: number | null;
  selectedSurfaces: ToothSurface[];
  onToggle: (surface: ToothSurface) => void;
  /** When provided, selected surface pills use this color instead of the default lemon yellow. */
  highlightColor?: string;
}

/**
 * Map SVG surface IDs (from UniversalTooth surfacemap) to ToothSurface values.
 * palatal → lingual (upper arch uses palatal, we normalize to lingual)
 * labial → buccal (anterior teeth use labial, we normalize to buccal)
 * cervical* → null (not in ToothSurface type, skip)
 */
function normalizeSurface(svgSurface: string): ToothSurface | null {
  if (svgSurface === 'palatal') return 'lingual';
  if (svgSurface === 'labial') return 'buccal';
  if (svgSurface.startsWith('cervical')) return null;
  const known: ToothSurface[] = ['mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal'];
  return known.includes(svgSurface as ToothSurface) ? (svgSurface as ToothSurface) : null;
}

export function FiveSurfaceSelector({ toothNumber, selectedSurfaces, onToggle, highlightColor }: FiveSurfaceSelectorProps) {
  const surfaces = toothNumber ? getSurfacesForTooth(toothNumber) : ['mesial', 'distal', 'buccal', 'lingual', 'occlusal'] as ToothSurface[];

  const isSelected = (s: ToothSurface) => selectedSurfaces.includes(s);

  function handleSvgClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as SVGElement;
    // Surface elements have IDs like "tooth-8_occlusal" or just "occlusal"
    const id = target.id || target.getAttribute('data-surface') || '';
    // Extract surface name: strip "tooth-N_" prefix if present
    const surfaceName = id.includes('_') ? id.split('_').slice(1).join('_') : id;
    if (!surfaceName) return;
    const normalized = normalizeSurface(surfaceName);
    if (normalized) onToggle(normalized);
  }

  return (
    <div data-testid="five-surface-selector" className="flex flex-col gap-3">
      {toothNumber && (
        <div
          className="flex justify-center cursor-pointer py-2"
          onClick={handleSvgClick}
          aria-label="Click tooth surfaces to select"
        >
          <UniversalToothFdi
            fdiToothNumber={toothNumber}
            variant="surfacemap"
            size="xl"
            interactive={false}
            showLabel={false}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">
        {selectedSurfaces.length === 0
          ? 'Click surfaces to select'
          : `${isAnteriorTooth(toothNumber) ? 'Anterior' : 'Posterior'} tooth surfaces`}
      </p>
      <div className="flex flex-wrap gap-2">
        {surfaces.map((surface) => (
          <button
            key={surface}
            type="button"
            data-testid={`surface-${surface}`}
            onClick={() => onToggle(surface)}
            aria-pressed={isSelected(surface)}
            className={[
              'px-3 py-1.5 rounded-full border text-sm font-medium capitalize transition-colors',
              isSelected(surface)
                ? highlightColor
                  ? 'border-2 text-foreground font-semibold'
                  : 'bg-[#FFE97D] border-[#c8b800] text-foreground font-semibold'
                : 'border-border hover:bg-secondary',
            ].join(' ')}
            style={isSelected(surface) && highlightColor ? { backgroundColor: `${highlightColor}30`, borderColor: highlightColor } : undefined}
          >
            {surface}
          </button>
        ))}
      </div>
    </div>
  );
}
