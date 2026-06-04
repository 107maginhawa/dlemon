/**
 * SuperimpositionPanel (P1-11, v1) — controls + deltas table for cephalometric
 * superimposition over time.
 *
 * CLINICAL HONESTY (plan §2/§8): v1 is a TWO-POINT (S–N) cranial-base
 * registration — a SIMPLIFIED superimposition, NOT ABO-grade structural
 * superimposition. The backend's `label` is surfaced verbatim; mm deltas are
 * shown ONLY when both timepoints are calibrated; tracings/labels never rely on
 * color alone (each carries a date/vN label); no green "normal".
 */

import { useId } from 'react'
import type {
  CephSuperimposition,
  SuperimpositionReference,
} from '../hooks/use-ceph-superimposition'

export interface SuperimpositionPanelProps {
  /** computed superimposition (preview or persisted), or null before compute. */
  result: CephSuperimposition | null
  isLoading?: boolean
  error?: string | null
  /** selected registration reference (segmented control). */
  reference: SuperimpositionReference
  onReferenceChange: (r: SuperimpositionReference) => void
  /** B-layer opacity 0..100 (synced overlay onion-skin slider). */
  opacityPct: number
  onOpacityChange: (pct: number) => void
  /** onion-skin animated crossfade toggle. */
  onionSkin: boolean
  onOnionSkinChange: (on: boolean) => void
  /** labels for each timepoint tracing (date/vN) — never color-only. */
  fromLabel: string
  toLabel: string
}

const REFERENCES: { value: SuperimpositionReference; label: string; v1: boolean }[] = [
  { value: 'cranial_base', label: 'Cranial base (S–N)', v1: true },
  { value: 'maxillary', label: 'Maxillary (ANS–PNS)', v1: false },
  { value: 'mandibular', label: 'Mandibular (symphysis)', v1: false },
]

export function SuperimpositionPanel({
  result,
  isLoading = false,
  error = null,
  reference,
  onReferenceChange,
  opacityPct,
  onOpacityChange,
  onionSkin,
  onOnionSkinChange,
  fromLabel,
  toLabel,
}: SuperimpositionPanelProps) {
  const opacityId = useId()
  const onionId = useId()

  return (
    <div className="flex flex-col gap-4 p-4 text-sm" data-testid="superimposition-panel">
      {/* Registration reference — segmented control. Non-v1 disabled. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
          Registration reference
        </legend>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Registration reference">
          {REFERENCES.map((r) => {
            const selected = r.value === reference
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={r.v1 ? r.label : `${r.label} (coming in v2)`}
                disabled={!r.v1}
                onClick={() => r.v1 && onReferenceChange(r.value)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium border transition-colors',
                  selected
                    ? 'bg-lemon text-lemon-foreground border-lemon'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50',
                  !r.v1 ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {r.label}
                {!r.v1 && <span className="ml-1 text-[10px] text-zinc-400">v2</span>}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* v1 honesty label — surfaced verbatim from the backend. */}
      {result && (
        <p
          className="rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600"
          role="note"
          data-testid="superimposition-label"
        >
          {result.label}
        </p>
      )}

      {/* Overlay controls — opacity slider + onion-skin toggle. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={opacityId} className="text-xs font-medium text-zinc-600">
            Later timepoint opacity ({opacityPct}%)
          </label>
          <input
            id={opacityId}
            type="range"
            min={0}
            max={100}
            value={opacityPct}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-full accent-lemon"
            data-testid="superimposition-opacity"
          />
        </div>
        <label htmlFor={onionId} className="flex items-center gap-2 text-xs text-zinc-600">
          <input
            id={onionId}
            type="checkbox"
            checked={onionSkin}
            onChange={(e) => onOnionSkinChange(e.target.checked)}
            className="accent-lemon"
            data-testid="superimposition-onion-skin"
          />
          Onion-skin crossfade (respects reduced-motion)
        </label>
      </div>

      {/* Timepoint legend — never color-only; each tracing carries a label. */}
      <div className="flex items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-zinc-400" aria-hidden="true" />
          <span data-testid="superimposition-from-label">{fromLabel} (earlier)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-lemon" aria-hidden="true" />
          <span data-testid="superimposition-to-label">{toLabel} (later)</span>
        </span>
      </div>

      {/* State */}
      {isLoading && <p className="text-xs text-zinc-400">Computing superimposition…</p>}
      {error && (
        <p className="text-xs text-red-600" role="alert" data-testid="superimposition-error">
          {error}
        </p>
      )}

      {/* Metric deltas table */}
      {result && (
        <MetricDeltasTable result={result} />
      )}

      {/* Landmark displacement table */}
      {result && (
        <LandmarkDeltasTable result={result} />
      )}
    </div>
  )
}

function MetricDeltasTable({ result }: { result: CephSuperimposition }) {
  const rows = result.metricDeltas.filter((d) => d.from != null || d.to != null)
  if (rows.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Metric change</h4>
      <table className="w-full text-xs" data-testid="metric-deltas-table">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="py-1 font-medium">Metric</th>
            <th className="py-1 font-medium">{result.reportFromId ? 'From' : 'From'}</th>
            <th className="py-1 font-medium">To</th>
            <th className="py-1 font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.metric} className="border-t border-zinc-100">
              <td className="py-1 text-zinc-700">{d.metric}</td>
              <td className="py-1 text-zinc-500">{fmt(d.from)}</td>
              <td className="py-1 text-zinc-500">{fmt(d.to)}</td>
              <td className="py-1 font-medium text-zinc-800">{fmtSigned(d.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LandmarkDeltasTable({ result }: { result: CephSuperimposition }) {
  const rows = result.landmarkDeltas
  if (rows.length === 0) return null
  // mm gated on calibration of BOTH timepoints (plan §3.3); else px only.
  const showMm = !result.uncalibrated
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        Landmark displacement{showMm ? ' (mm)' : ' (px — uncalibrated)'}
      </h4>
      {!showMm && (
        <p className="text-[11px] text-zinc-400" data-testid="superimposition-uncalibrated">
          One or both timepoints are uncalibrated — showing pixel displacement only.
        </p>
      )}
      <table className="w-full text-xs" data-testid="landmark-deltas-table">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="py-1 font-medium">Landmark</th>
            <th className="py-1 font-medium">Displacement</th>
            <th className="py-1 font-medium">Direction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.landmarkCode} className="border-t border-zinc-100">
              <td className="py-1 text-zinc-700">{d.landmarkCode}</td>
              <td className="py-1 text-zinc-800">
                {showMm && d.magnitudeMm != null ? `${d.magnitudeMm} mm` : `${d.magnitudePx} px`}
              </td>
              <td className="py-1 text-zinc-500">{d.directionDeg}°</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmt(n: number | null): string {
  return n == null ? '—' : String(n)
}
function fmtSigned(n: number | null): string {
  if (n == null) return '—'
  return n > 0 ? `+${n}` : String(n)
}
