/**
 * FiveSurfaceSelector — interactive 5-surface tooth diagram
 *
 * Shows 5 clickable surface zones for a selected tooth.
 * Switches between "incisal" (anterior) and "occlusal" (posterior).
 *
 * Wireframe: docs/prd/context/wireframes/ws-tooth-slideout.html
 */

import React from 'react';
import { getSurfacesForTooth, isAnteriorTooth } from './five-surface-selector.helpers';
import type { ToothSurface } from './five-surface-selector.helpers';

export interface FiveSurfaceSelectorProps {
  toothNumber: number | null;
  selectedSurfaces: ToothSurface[];
  onToggle: (surface: ToothSurface) => void;
}

export function FiveSurfaceSelector({ toothNumber, selectedSurfaces, onToggle }: FiveSurfaceSelectorProps) {
  const surfaces = toothNumber ? getSurfacesForTooth(toothNumber) : ['mesial', 'distal', 'buccal', 'lingual', 'occlusal'] as ToothSurface[];

  const isSelected = (s: ToothSurface) => selectedSurfaces.includes(s);

  return (
    <div data-testid="five-surface-selector" className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground font-medium">
        {isAnteriorTooth(toothNumber) ? 'Anterior tooth surfaces' : 'Posterior tooth surfaces'}
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
              'px-3 py-1.5 rounded-lg border text-sm font-medium capitalize transition-colors',
              isSelected(surface)
                ? 'bg-primary/20 border-primary text-primary'
                : 'border-border hover:bg-secondary',
            ].join(' ')}
          >
            {surface}
          </button>
        ))}
      </div>
    </div>
  );
}
