import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@monobase/ui'

interface CalibrationDialogProps {
  open: boolean
  pixelDistance: number
  onConfirm: (actualMm: number) => void
  onCancel: () => void
}

export function CalibrationDialog({
  open,
  pixelDistance,
  onConfirm,
  onCancel,
}: CalibrationDialogProps) {
  const [value, setValue] = useState('')

  const handleConfirm = () => {
    const mm = parseFloat(value)
    if (!isNaN(mm) && mm > 0) {
      onConfirm(mm)
      setValue('')
    }
  }

  const handleCancel = () => {
    setValue('')
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calibrate Measurement</DialogTitle>
          <DialogDescription>
            You drew a line of {pixelDistance.toFixed(1)} px. Enter the actual length of this
            object in millimeters:
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <input
            type="number"
            min={0.1}
            step={0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 10.0"
            className="w-full border border-input rounded px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
          />
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
            disabled={!value || parseFloat(value) <= 0}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Confirm
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
