import type { ToolMode } from './measurement-toolbar'

type AnnotationToolMode = 'label' | 'arrow' | 'freehand' | 'shape' | 'tooth'

interface AnnotationToolbarProps {
  toolMode: ToolMode
  onToolChange: (mode: ToolMode) => void
}

export const ANNOTATION_TOOLS: { mode: AnnotationToolMode; label: string }[] = [
  { mode: 'label', label: 'Label' },
  { mode: 'arrow', label: 'Arrow' },
  { mode: 'freehand', label: 'Freehand' },
  { mode: 'shape', label: 'Shape' },
  { mode: 'tooth', label: 'Tooth' },
]

export function AnnotationToolbar({ toolMode, onToolChange }: AnnotationToolbarProps) {
  const handleClick = (mode: AnnotationToolMode) => {
    onToolChange(toolMode === mode ? 'none' : mode)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700" data-testid="annotation-toolbar">
      {ANNOTATION_TOOLS.map(({ mode, label }) => {
        const isActive = toolMode === mode
        return (
          <button
            key={mode}
            aria-pressed={isActive}
            aria-label={label}
            data-testid={`tool-${mode}`}
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
    </div>
  )
}
