/**
 * CephReportView — frozen snapshot-driven print layout (D-I).
 *
 * This component renders only from the `snapshot` prop. It never reads
 * live query state. An existing report row cannot silently change (D-I);
 * re-editing landmarks after export produces a new version.
 */
import { useState } from 'react'
import { getPopulationLabel } from '@monobase/ceph-math'

// Tracing lines drawn over the radiograph when both endpoints are placed.
// Reference overlay only — D-N: not to scale, no scale bar.
const TRACING_LINES: [string, string][] = [
  ['S', 'N'],   // SN
  ['N', 'A'],   // NA
  ['N', 'B'],   // NB
  ['Go', 'Me'], // mandibular plane
  ['N', 'Pog'], // facial line
]

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
  // G2: reproducibility provenance — analysis actually used + pinned versions.
  analysis_type?: string
  norm_population?: string
  norm_version?: string
  formula_version?: string
  calibration: {
    value: number | null
    method: string
    at?: string | null
    by?: string | null
    // G2: px/mm + snapshot-schema version.
    pixels_per_mm?: number | null
    version?: number
    // G6: the pinned versioned calibration record (2 ruler points + known distance).
    point_a?: { x: number; y: number } | null
    point_b?: { x: number; y: number } | null
    known_distance_mm?: number | null
    record_version?: number | null
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
  // G1-B: explicit revision lineage. `revisionOf` is the prior report version's
  // id (null for v1); `revisionReason` records why this trace was re-finalized.
  revisionOf?: string | null
  revisionReason?: string | null
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

export function CephReportView({ snapshot, version, imageUrl, revisionOf, revisionReason }: CephReportViewProps) {
  const missing = snapshot.missing ?? []
  const uncalibrated = snapshot.uncalibrated ?? false
  const placedCodes = Object.keys(snapshot.landmarks)
  // Natural image dimensions (captured on load) so the SVG tracing overlay aligns.
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)

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
          {/* G1-B: revision lineage — version chain is linear, so a report with a
              prior version (revisionOf set) revises v{version-1}. */}
          {revisionOf && (
            <p className="text-sm text-amber-700 mt-1" data-testid="ceph-report-revision">
              Revises v{version - 1}
              {revisionReason && (
                <>
                  {' · '}
                  Reason: <span className="font-medium">{revisionReason}</span>
                </>
              )}
            </p>
          )}
          {/* G2: reproducibility provenance — what the report can be reproduced against.
              Provenance only (not a normative comparison; D-H still holds). */}
          {(snapshot.norm_population || snapshot.norm_version || snapshot.formula_version) && (
            <p className="text-xs text-zinc-500 mt-1" data-testid="ceph-report-provenance">
              {snapshot.norm_population && (
                <>
                  Reference norms:{' '}
                  <span className="font-medium text-zinc-700">{getPopulationLabel(snapshot.norm_population)}</span>
                </>
              )}
              {snapshot.norm_version && <> · Norms v{snapshot.norm_version}</>}
              {snapshot.formula_version && <> · Engine v{snapshot.formula_version}</>}
            </p>
          )}
        </div>
        {/* D-G: analysis label badge */}
        <span
          data-testid="analysis-label-badge"
          className="text-xs px-2 py-1 rounded bg-zinc-800 text-lemon font-medium whitespace-nowrap print:bg-transparent print:text-zinc-900 print:border print:border-zinc-800"
        >
          {snapshot.analysis_label}
        </span>
      </div>

      {/* ── Composite: radiograph + tracing overlay (D-N: reference only, not to scale) ── */}
      {imageUrl && (
        <div className="mb-6">
          <div className="relative inline-block max-w-full">
            <img
              src={imageUrl}
              alt="Cephalometric radiograph with landmark tracing"
              className="max-w-full max-h-[480px] border border-zinc-300"
              onLoad={(e) =>
                setImgDims({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
            />
            {imgDims && (
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                {TRACING_LINES.map(([a, b]) => {
                  const p1 = snapshot.landmarks[a]
                  const p2 = snapshot.landmarks[b]
                  if (!p1 || !p2) return null
                  return (
                    <line
                      key={`${a}-${b}`}
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke="#86efac" strokeWidth={Math.max(imgDims.w, imgDims.h) / 400}
                      opacity={0.85}
                    />
                  )
                })}
                {Object.entries(snapshot.landmarks).map(([code, p]) => (
                  <circle
                    key={code}
                    cx={p.x} cy={p.y} r={Math.max(imgDims.w, imgDims.h) / 220}
                    fill="#FFE97D" stroke="#7c6f1a" strokeWidth={Math.max(imgDims.w, imgDims.h) / 800}
                  />
                ))}
              </svg>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Tracing overlay — for reference, not to scale.
          </p>
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
            {/* G6: when a versioned ruler record is pinned, the report is exactly
                reproducible against it — surface the known distance + record version. */}
            {snapshot.calibration.record_version != null &&
              snapshot.calibration.known_distance_mm != null && (
                <>
                  {' '}2-point ruler: {snapshot.calibration.known_distance_mm} mm (calibration v
                  {snapshot.calibration.record_version}).
                </>
              )}
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
