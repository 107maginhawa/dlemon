import { Skeleton } from '@/components/skeleton'
import type { CephAnalysis } from '../hooks/use-ceph-analysis'

export interface CephMeasurementsPanelProps {
  analysis: CephAnalysis | null
  isLoading?: boolean
}

// D-F labels — SN-referenced naming. NOT Frankfort (no FMA, no Mandibular Plane Angle).
const METRIC_ROWS: { key: string; label: string; mm?: boolean }[] = [
  { key: 'sna', label: 'SNA' },
  { key: 'snb', label: 'SNB' },
  { key: 'anb', label: 'ANB' },
  { key: 'convexity_napog', label: 'N-A-Pog Convexity' },
  { key: 'sn_gome', label: 'SN-GoMe' },
  { key: 'facial_angle_sn', label: 'Facial Angle (SN)' },
  { key: 'y_axis_sn', label: 'Y-Axis (S-Me / SN)' },
  { key: 'u1_sn', label: 'U1-SN' },
  { key: 'impa', label: 'IMPA (L1-GoMe)' },
  { key: 'u1_na_angle', label: 'U1-NA°' },
  { key: 'l1_nb_angle', label: 'L1-NB°' },
  { key: 'interincisal', label: 'Interincisal' },
  { key: 'u1_na_mm', label: 'U1-NA (mm)', mm: true },
  { key: 'l1_nb_mm', label: 'L1-NB (mm)', mm: true },
  { key: 'overjet', label: 'Overjet (mm)', mm: true },
  { key: 'overbite', label: 'Overbite (mm)', mm: true },
]

// Landmarks each metric depends on — used to surface "missing: {code}".
const METRIC_LANDMARKS: Record<string, string[]> = {
  sna: ['S', 'N', 'A'],
  snb: ['S', 'N', 'B'],
  anb: ['S', 'N', 'A', 'B'],
  convexity_napog: ['N', 'A', 'Pog'],
  sn_gome: ['S', 'N', 'Go', 'Me'],
  facial_angle_sn: ['S', 'N', 'Pog'],
  y_axis_sn: ['S', 'N', 'Me'],
  u1_sn: ['S', 'N', 'U1A', 'U1T'],
  impa: ['Go', 'Me', 'L1A', 'L1T'],
  u1_na_angle: ['N', 'A', 'U1A', 'U1T'],
  l1_nb_angle: ['N', 'B', 'L1A', 'L1T'],
  interincisal: ['U1A', 'U1T', 'L1A', 'L1T'],
  u1_na_mm: ['N', 'A', 'U1T'],
  l1_nb_mm: ['N', 'B', 'L1T'],
  overjet: ['U1T', 'L1T'],
  overbite: ['U1T', 'L1T'],
}

function valueText(
  row: { key: string; mm?: boolean },
  analysis: CephAnalysis,
): string {
  const value = analysis.measurements[row.key]
  if (typeof value === 'number') return value.toFixed(2)
  // null → diagnose why
  const missing = (METRIC_LANDMARKS[row.key] ?? []).find((code) =>
    analysis.missing.includes(code),
  )
  if (missing) return `missing: ${missing}`
  if (row.mm && analysis.uncalibrated) return 'calibrate for mm'
  return '—'
}

export function CephMeasurementsPanel({
  analysis,
  isLoading = false,
}: CephMeasurementsPanelProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-zinc-700">
        <Skeleton className="h-5 w-32 bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="px-4 py-3 border-b border-zinc-700">
        <p className="text-xs text-zinc-500">No analysis data</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-zinc-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Measurements
        </span>
        {/* D-G: analysis type badge */}
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-[#FFE97D] font-medium">
          {analysis.analysisType}
        </span>
      </div>

      <table className="w-full text-xs">
        <tbody>
          {METRIC_ROWS.map((row) => (
            <tr key={row.key} className="border-b border-zinc-800/60">
              <td className="py-1 text-zinc-300">
                {row.label}
                {row.mm && <sup className="text-zinc-500">¹</sup>}
              </td>
              <td className="py-1 text-right text-white tabular-nums">
                {valueText(row, analysis)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* D-J: linear magnification footnote */}
      <p className="text-[10px] text-zinc-500 leading-snug">
        ¹ Lateral cephs have ~7-13% magnification; linear values are uncorrected
        estimates.
      </p>

      {/* D-F: SN reference footnote */}
      <p className="text-[10px] text-zinc-500 leading-snug">
        All planes referenced to Sella-Nasion. Published Frankfort norms do not
        apply directly.
      </p>
    </div>
  )
}
