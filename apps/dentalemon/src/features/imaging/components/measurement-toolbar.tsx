import { Badge } from '@monobase/ui'

export type ToolMode = 'none' | 'calibration' | 'distance' | 'angle' | 'area' | 'label' | 'arrow' | 'freehand' | 'shape' | 'tooth' | 'ceph'

/**
 * Tools that produce linear or area measurements in physical units (mm / mm²).
 * These require a mm-per-pixel calibration before use.
 */
const CALIBRATION_REQUIRED_TOOLS = new Set<ToolMode>(['distance', 'area'])

interface MeasurementToolbarProps {
  toolMode: ToolMode
  onToolChange: (mode: ToolMode) => void
  isCalibrated: boolean
  modality?: string
  /** Called when the user clicks the "Calibrate now" CTA in the uncalibrated banner. */
  onRequestCalibrate?: () => void
}

const TOOLS: { mode: Exclude<ToolMode, 'none'>; label: string }[] = [
  { mode: 'calibration', label: 'Calibrate' },
  { mode: 'distance', label: 'Distance' },
  { mode: 'angle', label: 'Angle' },
  { mode: 'area', label: 'Area' },
]

export function MeasurementToolbar({
  toolMode,
  onToolChange,
  isCalibrated,
  modality,
  onRequestCalibrate,
}: MeasurementToolbarProps) {
  const handleClick = (mode: Exclude<ToolMode, 'none'>) => {
    // Block mm-dependent tools when not calibrated — never silently fall back to px.
    if (!isCalibrated && CALIBRATION_REQUIRED_TOOLS.has(mode)) return
    onToolChange(toolMode === mode ? 'none' : mode)
  }

  const showPanoramicWarning = modality === 'panoramic' && toolMode !== 'none'
  const showCalibrationWarning = !isCalibrated

  return (
    <div className="flex flex-col gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700">
      <div className="flex items-center gap-1">
        {TOOLS.map(({ mode, label }) => {
          const isActive = toolMode === mode
          const needsCalibration = !isCalibrated && CALIBRATION_REQUIRED_TOOLS.has(mode)
          return (
            <button
              key={mode}
              aria-pressed={isActive}
              aria-disabled={needsCalibration}
              disabled={needsCalibration}
              title={needsCalibration ? 'Calibrate first to enable mm measurements' : undefined}
              onClick={() => handleClick(mode)}
              className={`min-h-[40px] px-2.5 py-1.5 text-xs rounded transition-colors ${
                needsCalibration
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                  : isActive
                    ? 'bg-zinc-600 text-white ring-1 ring-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white'
              }`}
            >
              {label}
            </button>
          )
        })}
        {isCalibrated && (
          <Badge className="ml-2 bg-green-700 text-green-100 border-green-600 text-xs">
            Calibrated
          </Badge>
        )}
      </div>
      {showCalibrationWarning && (
        <div
          className="flex items-center gap-2 bg-amber-950 border border-amber-700 text-amber-300 text-xs px-2 py-1 rounded"
          role="status"
          aria-label="Calibration required for distance and area measurements"
        >
          <span>Distance &amp; area tools require calibration.</span>
          <button
            onClick={() => {
              onRequestCalibrate?.()
              onToolChange('calibration')
            }}
            className="underline text-amber-200 hover:text-white focus:outline-none focus:ring-1 focus:ring-amber-400 rounded"
            aria-label="Switch to calibration tool"
          >
            Calibrate now
          </button>
        </div>
      )}
      {showPanoramicWarning && (
        <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded" role="alert">
          Measurements on panoramic images may be less accurate due to distortion.
        </div>
      )}
    </div>
  )
}
