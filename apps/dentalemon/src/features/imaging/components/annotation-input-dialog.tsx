import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@monobase/ui'

export type AnnotationInputKind = 'label' | 'tooth'

interface AnnotationInputDialogProps {
  open: boolean
  kind: AnnotationInputKind
  onConfirm: (raw: string) => void
  onCancel: () => void
}

/**
 * Styled replacement for the native window.prompt() that previously captured
 * label text / tooth numbers. Mirrors CalibrationDialog (same Dialog primitive +
 * styling) so the annotation flow is visually consistent and non-blocking.
 *
 * Label: free text, max 200 chars.
 * Tooth: integer 1–32 — validated inline; an out-of-range / non-numeric value
 * shows an error and keeps the dialog open (Confirm is a no-op until valid).
 */
export function AnnotationInputDialog({
  open,
  kind,
  onConfirm,
  onCancel,
}: AnnotationInputDialogProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setValue('')
    setError(null)
  }

  const handleConfirm = () => {
    if (kind === 'tooth') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1 || n > 32) {
        setError('Enter a whole number between 1 and 32.')
        return
      }
    }
    // Label: free text. An empty / whitespace-only label is rejected by
    // buildLabelMeasurement downstream (returns null → no commit), matching the
    // prior prompt behaviour.
    onConfirm(value)
    reset()
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const isTooth = kind === 'tooth'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isTooth ? 'Tooth Number' : 'Label Text'}</DialogTitle>
          <DialogDescription>
            {isTooth
              ? 'Enter a tooth number (1–32) for this annotation:'
              : 'Enter the label text (max 200 characters):'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <input
            type={isTooth ? 'number' : 'text'}
            {...(isTooth ? { min: 1, max: 32, step: 1 } : { maxLength: 200 })}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            placeholder={isTooth ? 'e.g. 14' : 'e.g. Caries'}
            className="w-full border border-input rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
          />
          {error && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm rounded bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Confirm
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
