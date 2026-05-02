/**
 * useDentalChart — tooth selection state management
 *
 * Manages which tooth is selected and which surfaces are active.
 * Implemented as a plain object (not React state) for testability.
 * The React version wraps this with useState.
 */

export type ToothSurface = 'mesial' | 'distal' | 'buccal' | 'lingual' | 'occlusal' | 'incisal' | 'cervical';

export interface DentalChartState {
  selectedTooth: number | null;
  selectedSurfaces: ToothSurface[];
  selectTooth: (toothNumber: number) => void;
  clearSelection: () => void;
  toggleSurface: (surface: ToothSurface) => void;
  clearSurfaces: () => void;
}

/**
 * Returns a mutable chart state object.
 * Intended for unit testing without React; in components use useDentalChartState().
 */
export function useDentalChart(): DentalChartState {
  let selectedTooth: number | null = null;
  let selectedSurfaces: ToothSurface[] = [];

  const state: DentalChartState = {
    get selectedTooth() { return selectedTooth; },
    get selectedSurfaces() { return selectedSurfaces; },

    selectTooth(toothNumber: number) {
      if (selectedTooth === toothNumber) {
        selectedTooth = null;
      } else {
        selectedTooth = toothNumber;
      }
    },

    clearSelection() {
      selectedTooth = null;
    },

    toggleSurface(surface: ToothSurface) {
      const idx = selectedSurfaces.indexOf(surface);
      if (idx >= 0) {
        selectedSurfaces = selectedSurfaces.filter(s => s !== surface);
      } else {
        selectedSurfaces = [...selectedSurfaces, surface];
      }
    },

    clearSurfaces() {
      selectedSurfaces = [];
    },
  };

  return state;
}
