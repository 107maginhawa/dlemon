/**
 * Declarative tracing geometry for the cephalometric workspace.
 *
 * Pure data — no DOM, no canvas, no math. Canvas components use this to
 * decide which lines and angle-arc indicators to render based on which
 * landmarks the user has placed. Measurement VALUES come from the backend
 * CephAnalysis object; this module only describes positions/structure.
 */

import { LANDMARK_CODES as MATH_CODES } from '@monobase/ceph-math'

// Re-export for consumers that only need the frontend geometry lib
export { LANDMARK_CODES } from '@monobase/ceph-math'

export type CephLandmarkCode = typeof MATH_CODES[number]

// ---------------------------------------------------------------------------
// Landmark labels
// ---------------------------------------------------------------------------

export const LANDMARK_LABELS: Record<CephLandmarkCode, string> = {
  S: 'Sella',
  N: 'Nasion',
  A: 'A Point',
  B: 'B Point',
  ANS: 'Ant. Nasal Spine',
  PNS: 'Post. Nasal Spine',
  Go: 'Gonion',
  Po: 'Porion',
  Me: 'Menton',
  Or: 'Orbitale',
  Pog: 'Pogonion',
  Gn: 'Gnathion',
  U1T: 'U1 Tip',
  U1A: 'U1 Apex',
  L1T: 'L1 Tip',
  L1A: 'L1 Apex',
}

// ---------------------------------------------------------------------------
// Line definitions
// ---------------------------------------------------------------------------

export interface CephLine {
  id: string
  label: string
  from: CephLandmarkCode
  to: CephLandmarkCode
}

export const CEPH_LINES: CephLine[] = [
  { id: 'sn',    label: 'SN Reference',     from: 'S',   to: 'N'   },
  { id: 'go-me', label: 'Mandibular Plane',  from: 'Go',  to: 'Me'  },
  { id: 'n-a',   label: 'NA Line',           from: 'N',   to: 'A'   },
  { id: 'n-b',   label: 'NB Line',           from: 'N',   to: 'B'   },
  { id: 'n-pog', label: 'Facial Line',       from: 'N',   to: 'Pog' },
  { id: 'u1',    label: 'Upper Incisor Axis', from: 'U1A', to: 'U1T' },
  { id: 'l1',    label: 'Lower Incisor Axis', from: 'L1A', to: 'L1T' },
]

/**
 * Returns the subset of CEPH_LINES whose both endpoints appear in `placed`.
 * Components call this each render to skip lines with unplaced endpoints.
 */
export function activeLinesForLandmarks(placed: Set<string>): CephLine[] {
  return CEPH_LINES.filter((l) => placed.has(l.from) && placed.has(l.to))
}

// ---------------------------------------------------------------------------
// Angle arc definitions (position only — value comes from CephAnalysis)
// ---------------------------------------------------------------------------

export interface CephAngleArc {
  id: string          // matches measurement key in CephAnalysis
  metricKey: string   // key in CephAnalysis.measurements
  label: string
  vertex: CephLandmarkCode   // arc center landmark
  ray1: CephLandmarkCode     // first ray endpoint
  ray2: CephLandmarkCode     // second ray endpoint
}

export const CEPH_ANGLE_ARCS: CephAngleArc[] = [
  { id: 'sna',         metricKey: 'sna',         label: 'SNA',        vertex: 'N',   ray1: 'S',   ray2: 'A'   },
  { id: 'snb',         metricKey: 'snb',         label: 'SNB',        vertex: 'N',   ray1: 'S',   ray2: 'B'   },
  { id: 'u1_sn',       metricKey: 'u1_sn',       label: 'U1-SN',      vertex: 'U1A', ray1: 'S',   ray2: 'U1T' },
  { id: 'impa',        metricKey: 'impa',        label: 'IMPA',       vertex: 'L1A', ray1: 'Go',  ray2: 'L1T' },
  { id: 'interincisal',metricKey: 'interincisal',label: 'Interincisal',vertex: 'U1T', ray1: 'U1A', ray2: 'L1T' },
]

/**
 * Returns the subset of CEPH_ANGLE_ARCS whose vertex and both ray landmarks
 * appear in `placed`.
 */
export function activeArcsForLandmarks(placed: Set<string>): CephAngleArc[] {
  return CEPH_ANGLE_ARCS.filter(
    (a) => placed.has(a.vertex) && placed.has(a.ray1) && placed.has(a.ray2),
  )
}
