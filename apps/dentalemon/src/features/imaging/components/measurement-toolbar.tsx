import { Badge } from '@monobase/ui'

export type ToolMode = 'none' | 'calibration' | 'distance' | 'angle' | 'area' | 'label' | 'arrow' | 'freehand' | 'shape' | 'tooth' | 'ceph'

interface MeasurementToolbarProps {
  toolMode: ToolMode
  onToolChange: (mode: ToolMode) => void
  isCalibrated: boolean
  modality?: string
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
}: MeasurementToolbarProps) {
  const handleClick = (mode: Exclude<ToolMode, 'none'>) => {
    onToolChange(toolMode === mode ? 'none' : mode)
  }

  const showPanoramicWarning = modality === 'panoramic' && toolMode !== 'none'

  return (
    <div className="flex flex-col gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700">
      <div className="flex items-center gap-1">
        {TOOLS.map(({ mode, label }) => {
          const isActive = toolMode === mode
          return (
            <button
              key={mode}
              aria-pressed={isActive}
              onClick={() => handleClick(mode)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isActive
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
      {showPanoramicWarning && (
        <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded" role="alert">
          Measurements on panoramic images may be less accurate due to distortion.
        </div>
      )}
    </div>
  )
}
