// Ported from monobase-mycure packages/ui/src/components/emr/dental/types.ts
// Pediatric teeth (A-T) omitted for MVP.

export type ToothType = 'molar' | 'pre-molar' | 'incisor' | 'canine';

export interface SurfaceStatus {
  surface: string;
  colorCoding: string;
  statusDesc: string;
  surfaceName: string;
}

export interface SurfaceMapping {
  left: string;
  right: string;
  top: string;
  bottom: string;
  center: string;
}

export interface UniversalToothInfo {
  type: ToothType;
  arch: 'upper' | 'lower';
  quadrant: 1 | 2 | 3 | 4;
  name: string;
  surfaces: string[];
}

export const UNIVERSAL_TOOTH_MAP: Record<number, UniversalToothInfo> = {
  // Quadrant 1: Upper Right
  1:  { type: 'molar',     arch: 'upper', quadrant: 1, name: 'Upper Right 3rd Molar',         surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  2:  { type: 'molar',     arch: 'upper', quadrant: 1, name: 'Upper Right 2nd Molar',         surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  3:  { type: 'molar',     arch: 'upper', quadrant: 1, name: 'Upper Right 1st Molar',         surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  4:  { type: 'pre-molar', arch: 'upper', quadrant: 1, name: 'Upper Right 2nd Premolar',      surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  5:  { type: 'pre-molar', arch: 'upper', quadrant: 1, name: 'Upper Right 1st Premolar',      surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  6:  { type: 'canine',    arch: 'upper', quadrant: 1, name: 'Upper Right Canine',            surfaces: ['incisal',  'mesial', 'distal', 'labial',  'palatal', 'cervicallabial', 'cervicalpalatal'] },
  7:  { type: 'incisor',   arch: 'upper', quadrant: 1, name: 'Upper Right Lateral Incisor',   surfaces: ['incisal',  'mesial', 'distal', 'labial',  'palatal', 'cervicallabial', 'cervicalpalatal'] },
  8:  { type: 'incisor',   arch: 'upper', quadrant: 1, name: 'Upper Right Central Incisor',   surfaces: ['incisal',  'mesial', 'distal', 'labial',  'palatal', 'cervicallabial', 'cervicalpalatal'] },
  // Quadrant 2: Upper Left
  9:  { type: 'incisor',   arch: 'upper', quadrant: 2, name: 'Upper Left Central Incisor',    surfaces: ['incisal',  'mesial', 'distal', 'labial',  'palatal', 'cervicallabial', 'cervicalpalatal'] },
  10: { type: 'incisor',   arch: 'upper', quadrant: 2, name: 'Upper Left Lateral Incisor',    surfaces: ['incisal',  'mesial', 'distal', 'labial',  'palatal', 'cervicallabial', 'cervicalpalatal'] },
  11: { type: 'canine',    arch: 'upper', quadrant: 2, name: 'Upper Left Canine',             surfaces: ['incisal',  'mesial', 'distal', 'labial',  'palatal', 'cervicallabial', 'cervicalpalatal'] },
  12: { type: 'pre-molar', arch: 'upper', quadrant: 2, name: 'Upper Left 1st Premolar',       surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  13: { type: 'pre-molar', arch: 'upper', quadrant: 2, name: 'Upper Left 2nd Premolar',       surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  14: { type: 'molar',     arch: 'upper', quadrant: 2, name: 'Upper Left 1st Molar',          surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  15: { type: 'molar',     arch: 'upper', quadrant: 2, name: 'Upper Left 2nd Molar',          surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  16: { type: 'molar',     arch: 'upper', quadrant: 2, name: 'Upper Left 3rd Molar',          surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'palatal', 'cervicalbuccal', 'cervicalpalatal'] },
  // Quadrant 3: Lower Left
  17: { type: 'molar',     arch: 'lower', quadrant: 3, name: 'Lower Left 3rd Molar',          surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  18: { type: 'molar',     arch: 'lower', quadrant: 3, name: 'Lower Left 2nd Molar',          surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  19: { type: 'molar',     arch: 'lower', quadrant: 3, name: 'Lower Left 1st Molar',          surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  20: { type: 'pre-molar', arch: 'lower', quadrant: 3, name: 'Lower Left 2nd Premolar',       surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  21: { type: 'pre-molar', arch: 'lower', quadrant: 3, name: 'Lower Left 1st Premolar',       surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  22: { type: 'canine',    arch: 'lower', quadrant: 3, name: 'Lower Left Canine',             surfaces: ['incisal',  'mesial', 'distal', 'labial',  'lingual', 'cervicallabial', 'cervicallingual'] },
  23: { type: 'incisor',   arch: 'lower', quadrant: 3, name: 'Lower Left Lateral Incisor',    surfaces: ['incisal',  'mesial', 'distal', 'labial',  'lingual', 'cervicallabial', 'cervicallingual'] },
  24: { type: 'incisor',   arch: 'lower', quadrant: 3, name: 'Lower Left Central Incisor',    surfaces: ['incisal',  'mesial', 'distal', 'labial',  'lingual', 'cervicallabial', 'cervicallingual'] },
  // Quadrant 4: Lower Right
  25: { type: 'incisor',   arch: 'lower', quadrant: 4, name: 'Lower Right Central Incisor',   surfaces: ['incisal',  'mesial', 'distal', 'labial',  'lingual', 'cervicallabial', 'cervicallingual'] },
  26: { type: 'incisor',   arch: 'lower', quadrant: 4, name: 'Lower Right Lateral Incisor',   surfaces: ['incisal',  'mesial', 'distal', 'labial',  'lingual', 'cervicallabial', 'cervicallingual'] },
  27: { type: 'canine',    arch: 'lower', quadrant: 4, name: 'Lower Right Canine',            surfaces: ['incisal',  'mesial', 'distal', 'labial',  'lingual', 'cervicallabial', 'cervicallingual'] },
  28: { type: 'pre-molar', arch: 'lower', quadrant: 4, name: 'Lower Right 1st Premolar',      surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  29: { type: 'pre-molar', arch: 'lower', quadrant: 4, name: 'Lower Right 2nd Premolar',      surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  30: { type: 'molar',     arch: 'lower', quadrant: 4, name: 'Lower Right 1st Molar',         surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  31: { type: 'molar',     arch: 'lower', quadrant: 4, name: 'Lower Right 2nd Molar',         surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
  32: { type: 'molar',     arch: 'lower', quadrant: 4, name: 'Lower Right 3rd Molar',         surfaces: ['occlusal', 'mesial', 'distal', 'buccal',  'lingual', 'cervicalbuccal', 'cervicallingual'] },
};

export function getSurfaceMapping(toothNumber: number): SurfaceMapping {
  const toothInfo = UNIVERSAL_TOOTH_MAP[toothNumber];
  if (!toothInfo) throw new Error(`Invalid tooth number: ${toothNumber}`);

  const { type, arch, quadrant } = toothInfo;
  const isAnterior = type === 'canine' || type === 'incisor';
  const isUpper = arch === 'upper';
  const isRightSide = quadrant === 1 || quadrant === 4;

  return {
    left:   isRightSide ? 'distal' : 'mesial',
    right:  isRightSide ? 'mesial' : 'distal',
    top:    isAnterior ? 'labial' : 'buccal',
    bottom: isUpper ? 'palatal' : 'lingual',
    center: isAnterior ? 'incisal' : 'occlusal',
  };
}

export function getCervicalMapping(toothNumber: number): { front: string; back: string } {
  const toothInfo = UNIVERSAL_TOOTH_MAP[toothNumber];
  if (!toothInfo) return { front: 'cervicalbuccal', back: 'cervicalpalatal' };

  const { type, arch } = toothInfo;
  const isAnterior = type === 'canine' || type === 'incisor';
  const isUpper = arch === 'upper';

  return {
    front: isAnterior ? 'cervicallabial' : 'cervicalbuccal',
    back:  isUpper ? 'cervicalpalatal' : 'cervicallingual',
  };
}

export function transformSvgIds(svgContent: string, toothNumber: number): string {
  const mapping = getSurfaceMapping(toothNumber);
  const cervicalMapping = getCervicalMapping(toothNumber);
  const toothInfo = UNIVERSAL_TOOTH_MAP[toothNumber];
  const isLower = toothInfo?.arch === 'lower';

  return svgContent
    // Front view BASE SHAPE → buccal/labial
    .replace(/id="tooth-\d+-front-base-shape"/g, `id="tooth-${toothNumber}_${mapping.top}"`)
    // Front view status paths
    .replace(/id="front-left"/g,   `id="tooth-${toothNumber}_${mapping.left}"`)
    .replace(/id="front-right"/g,  `id="tooth-${toothNumber}_${mapping.right}"`)
    .replace(/id="front-top"/g,    `id="tooth-${toothNumber}_${isLower ? mapping.center + '4' : cervicalMapping.front}"`)
    .replace(/id="front-bottom"/g, `id="tooth-${toothNumber}_${isLower ? cervicalMapping.front : mapping.center + '4'}"`)
    // Back view BASE SHAPE → palatal/lingual
    .replace(/id="tooth\d+-back-view-base-shape"/g, `id="tooth-${toothNumber}_${mapping.bottom}"`)
    // Back view status paths
    .replace(/id="back-left"/g,   `id="tooth-${toothNumber}_${mapping.left}1"`)
    .replace(/id="back-right"/g,  `id="tooth-${toothNumber}_${mapping.right}1"`)
    .replace(/id="back-top"/g,    `id="tooth-${toothNumber}_${isLower ? cervicalMapping.back : mapping.center + '5'}"`)
    .replace(/id="back-bottom"/g, `id="tooth-${toothNumber}_${isLower ? mapping.center + '5' : cervicalMapping.back}"`)
    // Top view: tooth{N}-top-{position}
    .replace(/id="tooth\d+-top-left"/g,   `id="tooth-${toothNumber}_${mapping.left}2"`)
    .replace(/id="tooth\d+-top-right"/g,  `id="tooth-${toothNumber}_${mapping.right}2"`)
    .replace(/id="tooth\d+-top-top"/g,    `id="tooth-${toothNumber}_${mapping.top}2"`)
    .replace(/id="tooth\d+-top-bottom"/g, `id="tooth-${toothNumber}_${mapping.bottom}2"`)
    .replace(/id="tooth\d+-top-center"/g, `id="tooth-${toothNumber}_${mapping.center}"`)
    // Surfacemap view
    .replace(/id="tooth-surfacemap-left"/g,   `id="tooth-${toothNumber}_${mapping.left}3"`)
    .replace(/id="tooth-surfacemap-right"/g,  `id="tooth-${toothNumber}_${mapping.right}3"`)
    .replace(/id="tooth-surfacemap-top"/g,    `id="tooth-${toothNumber}_${mapping.top}3"`)
    .replace(/id="tooth-surfacemap-bottom"/g, `id="tooth-${toothNumber}_${mapping.bottom}3"`)
    .replace(/id="tooth-surfacemap-center"/g, `id="tooth-${toothNumber}_${mapping.center}3"`)
    // Legacy patterns
    .replace(/id="[Rr]ight(\d*)"/g,  `id="tooth-${toothNumber}_${mapping.right}$1"`)
    .replace(/id="[Ll]eft(\d*)"/g,   `id="tooth-${toothNumber}_${mapping.left}$1"`)
    .replace(/id="[Uu]p(\d*)"/g,     `id="tooth-${toothNumber}_${mapping.top}$1"`)
    .replace(/id="[Dd]own(\d*)"/g,   `id="tooth-${toothNumber}_${mapping.bottom}$1"`)
    .replace(/id="[Mm]iddle(\d*)"/g, `id="tooth-${toothNumber}_${mapping.center}$1"`)
    .replace(/id="Curves(\d*)"/g,    `id="tooth-${toothNumber}_${mapping.center}$1"`)
    .replace(/id="Cruves"/g,         `id="tooth-${toothNumber}_${mapping.center}"`)
    .replace(/id="[Cc]ervical"/g,    `id="tooth-${toothNumber}_cervical"`);
}

export function getToothSurfaceId(toothNumber: number, surfaceName: string): string {
  return `tooth-${toothNumber}_${surfaceName}`;
}

export const TOOTH_SIZE_PRESETS = {
  xs:  { width: 28 },
  sm:  { width: 60 },
  md:  { width: 80 },
  lg:  { width: 100 },
  xl:  { width: 160 },
  '2xl': { width: 240 },
} as const;
