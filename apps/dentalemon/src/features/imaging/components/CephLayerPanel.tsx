export interface LayerState {
  landmarks: boolean
  tracing: boolean
  arcs: boolean
}

export interface CephLayerPanelProps {
  layers: LayerState
  onChange: (key: keyof LayerState, value: boolean) => void
}

const LAYER_BUTTONS: { key: keyof LayerState; label: string }[] = [
  { key: 'landmarks', label: 'Landmarks' },
  { key: 'tracing', label: 'Tracing' },
  { key: 'arcs', label: 'Arcs' },
]

export function CephLayerPanel({ layers, onChange }: CephLayerPanelProps) {
  return (
    <div className="flex gap-1 px-4 py-3 border-b border-zinc-700">
      {LAYER_BUTTONS.map(({ key, label }) => {
        const active = layers[key]
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key, !active)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              active
                ? 'bg-zinc-700 text-lemon'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
