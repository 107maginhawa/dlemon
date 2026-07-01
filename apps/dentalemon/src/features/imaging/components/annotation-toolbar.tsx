import { Check } from 'lucide-react'
import type { ToolMode } from './measurement-toolbar'

// Inline cursor glyph — lucide's MousePointer* icons aren't resolvable under the
// bun-test CJS interop, and this component is unit-tested; inline SVG renders in
// both the browser and tests with no import risk.
function CursorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="m13 13 6 6" />
    </svg>
  )
}

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

const btnBase =
  'min-h-[44px] px-2.5 py-1.5 text-xs rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lemon/50'

export function AnnotationToolbar({ toolMode, onToolChange }: AnnotationToolbarProps) {
  const handleClick = (mode: AnnotationToolMode) => {
    onToolChange(toolMode === mode ? 'none' : mode)
  }

  const selectActive = toolMode === 'select'

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border-b border-zinc-700" data-testid="annotation-toolbar">
      {/* Select tool: pick an existing annotation to edit/remove without arming a
          draw tool. Kept distinct from the draw tools by a divider. */}
      <button
        aria-pressed={selectActive}
        aria-label="Select"
        data-testid="tool-select"
        onClick={() => onToolChange(selectActive ? 'none' : 'select')}
        className={`${btnBase} flex items-center gap-1 ${
          selectActive
            ? 'bg-zinc-600 text-white ring-1 ring-white'
            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white'
        }`}
      >
        <CursorIcon className="h-3.5 w-3.5" />
        Select
      </button>

      <span className="mx-1 h-6 w-px bg-zinc-700" aria-hidden />

      {ANNOTATION_TOOLS.map(({ mode, label }) => {
        const isActive = toolMode === mode
        return (
          <button
            key={mode}
            aria-pressed={isActive}
            aria-label={label}
            data-testid={`tool-${mode}`}
            onClick={() => handleClick(mode)}
            className={`${btnBase} ${
              isActive
                ? 'bg-zinc-600 text-white ring-1 ring-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white'
            }`}
          >
            {label}
          </button>
        )
      })}

      {/* Autosave is the model — there is no Save button. State this plainly so
          staff stop hunting for one (quiet ambient status, not an alert colour). */}
      <span
        className="ml-auto flex items-center gap-1 text-xs text-zinc-400"
        data-testid="autosave-hint"
        role="status"
      >
        <Check className="h-3 w-3" aria-hidden />
        Saved automatically
      </span>
    </div>
  )
}
