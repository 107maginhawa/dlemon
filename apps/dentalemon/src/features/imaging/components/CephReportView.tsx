/**
 * CephReportView — frozen snapshot-driven print layout (D-I).
 *
 * This component renders only from the `snapshot` prop. It never reads
 * live query state. An existing report row cannot silently change (D-I);
 * re-editing landmarks after export produces a new version.
 */

// D-F labels — SN-referenced naming. NOT Frankfort.
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

export interface CephReportSnapshotLandmark {
  x: number
  y: number
  status: string
  source: string
}

export interface CephReportSnapshot {
  landmarks: Record<string, CephReportSnapshotLandmark>
  measurements: Record<string, number | null>
  analysis_label: string
  calibration: {
    value: number | null
    method: string
    at: string | null
    by: string | null
  }
  software_version: string
  operator: string
  generated_at: string
  // D4: context fields frozen at report creation
  study_date: string
  patient_display_id: string
  branch_name: string
  missing?: string[]
  uncalibrated?: boolean
}

export interface CephReportViewProps {
  snapshot: CephReportSnapshot
  version: number
  imageUrl?: string
}

function valueText(
  row: { key: string; mm?: boolean },
  measurements: Record<string, number | null>,
  missing: string[],
  uncalibrated: boolean,
): string {
  const v = measurements[row.key]
  if (typeof v === 'number') return v.toFixed(2)
  if (row.mm && uncalibrated) return 'calibrate for mm'
  if (missing.length > 0) {
    const needed = missing[0]
    if (needed) return `missing: ${needed}`
  }
  return '—'
}

export function CephReportView({ snapshot, version, imageUrl }: CephReportViewProps) {
  const missing = snapshot.missing ?? []
  const uncalibrated = snapshot.uncalibrated ?? false
  const placedCodes = Object.keys(snapshot.landmarks)

  return (
    <div className="bg-white text-zinc-900 min-h-screen p-8 font-sans print:p-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b-2 border-zinc-800 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold">Cephalometric Analysis Report</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Patient: <span className="font-medium text-zinc-900">{snapshot.patient_display_id}</span>
            {' · '}
            Branch: <span className="font-medium text-zinc-900">{snapshot.branch_name}</span>
          </p>
          <p className="text-sm text-zinc-600">
            Study date: <span className="font-medium text-zinc-900">{snapshot.study_date}</span>
            {' · '}
            Generated: <span className="font-medium text-zinc-900">{new Date(snapshot.generated_at).toLocaleDateString()}</span>
            {' · '}
            Version: <span className="font-medium text-zinc-900">{version}</span>
          </p>
          <p className="text-sm text-zinc-600">
            Operator: <span className="font-medium text-zinc-900">{snapshot.operator}</span>
            {' · '}
            Software: <span className="font-medium text-zinc-900">{snapshot.software_version}</span>
          </p>
        </div>
        {/* D-G: analysis label badge */}
        <span
          data-testid="analysis-label-badge"
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-yellow-300 font-medium whitespace-nowrap"
        >
          {snapshot.analysis_label}
        </span>
      </div>

      {/* ── Composite image placeholder ── */}
      {imageUrl && (
        <div className="mb-6">
          {/* Image renders at natural resolution; no scale bar (D-N) */}
        </div>
      )}

      {/* ── Measurements table ── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-zinc-700">
          Measurements
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-zinc-100">
              <th className="text-left py-1 px-2 font-medium text-zinc-700 border border-zinc-300">
                Metric
              </th>
              <th className="text-right py-1 px-2 font-medium text-zinc-700 border border-zinc-300">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map((row) => (
              <tr key={row.key} className="even:bg-zinc-50">
                <td className="py-1 px-2 text-zinc-800 border border-zinc-300">
                  {row.label}
                  {row.mm && <sup className="text-zinc-400">¹</sup>}
                </td>
                <td className="py-1 px-2 text-right tabular-nums border border-zinc-300">
                  {valueText(row, snapshot.measurements, missing, uncalibrated)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Landmark list ── */}
      {placedCodes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-zinc-700">
            Landmarks placed ({placedCodes.length})
          </h2>
          <p className="text-xs text-zinc-600">
            {placedCodes.join(', ')}
          </p>
          {missing.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              Missing from analysis: {missing.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* ── Disclaimers ── */}
      <div className="border border-zinc-300 rounded p-4 mb-4 text-xs text-zinc-700 space-y-2">
        <p className="font-semibold text-zinc-900">Clinical Notices</p>

        {/* D-H: no norm comparison */}
        <p>
          <strong>No normative comparison:</strong> Values are raw measurements.
          Cephalometric norms vary by ethnicity, age, and sex; no normative
          comparison is provided in this report. Interpretation requires clinical
          judgment.
        </p>

        {/* D-J: magnification disclosure */}
        <p>
          <sup>¹</sup> <strong>Linear measurements:</strong> Lateral cephs have
          ~7–13% magnification; linear values are uncorrected estimates. True
          magnification correction is not applied.
        </p>

        {/* D-N: no physical ruler/mm-grid; any tracing overlay is not to scale */}
        <p>
          <strong>Scale:</strong> Tracing overlays in any attached image are
          shown for reference — not to scale. No ruler or mm grid is displayed.
          Linear values appear only as numbers in the table above.
        </p>

        {/* D-F / D-G: SN vs Frankfort */}
        <p>
          All planes are referenced to Sella-Nasion (SN), not Frankfort
          horizontal. Published Frankfort norms do not apply directly. The
          analysis type is <strong>{snapshot.analysis_label}</strong>.
        </p>

        {/* Calibration */}
        {snapshot.calibration.value != null && (
          <p>
            Calibration: {snapshot.calibration.value.toFixed(3)} mm/px via{' '}
            {snapshot.calibration.method}
            {snapshot.calibration.at ? ` on ${new Date(snapshot.calibration.at).toLocaleDateString()}` : ''}.
          </p>
        )}
      </div>

      {/* ── D-O: Out-of-scope block ── */}
      <div className="border border-zinc-200 rounded p-4 mb-4 bg-zinc-50 text-xs text-zinc-600">
        <p className="font-semibold text-zinc-800 mb-1">Not included in this report (v1.4)</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>SND / D-point analysis</li>
          <li>Soft-tissue analysis</li>
          <li>Serial superimposition / growth tracking</li>
          <li>DICOM tag calibration</li>
          <li>True magnification correction</li>
          <li>Anisotropic pixel correction</li>
        </ul>
        <p className="mt-1 text-zinc-500">These features are deferred to v1.5 / v2.</p>
      </div>
    </div>
  )
}
