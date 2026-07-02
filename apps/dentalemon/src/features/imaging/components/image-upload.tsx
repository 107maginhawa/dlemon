import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Input, Label } from '@monobase/ui'
import { useImagingUpload } from '@/features/imaging/hooks/use-imaging-upload'
import { DICOM_MIME_TYPE, isDicomMimeType, parseDicomAcquisitionDate } from '@/features/imaging/lib/dicom'
import { isoToDateInput, dateInputToIso } from '@/features/imaging/lib/image-metadata-form'

const MODALITY_OPTIONS = [
  { value: 'periapical', label: 'Periapical' },
  { value: 'bitewing', label: 'Bitewing' },
  { value: 'panoramic', label: 'Panoramic' },
  { value: 'cephalometric', label: 'Cephalometric' },
  { value: 'cbct', label: 'CBCT' },
  { value: 'intraoral_photo', label: 'Intraoral Photo' },
  { value: 'extraoral_photo', label: 'Extraoral Photo' },
  { value: 'other', label: 'Other' },
] as const

// P1-9: DICOM joins the allowlist. Browsers often leave .dcm files with an empty
// MIME type, so the extension is treated as a DICOM signal at validation time.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp', DICOM_MIME_TYPE]
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

function isDicomFile(f: File): boolean {
  return isDicomMimeType(f.type) || /\.dcm$/i.test(f.name)
}

interface ImageUploadProps {
  patientId: string
  branchId: string
  visitId?: string
  onSuccess?: (studyId: string) => void
}

// §capture-date: today as a native date-input value (YYYY-MM-DD). Also the max
// allowed capture date — an image can't be taken in the future.
function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ImageUpload({ patientId, branchId, visitId, onSuccess }: ImageUploadProps) {
  const [modality, setModality] = useState('other')
  const [toothNumber, setToothNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  // §capture-date: when the image was TAKEN (not uploaded). Prefilled to today;
  // seeded from the DICOM AcquisitionDate on file-select when present. Source flips
  // to 'manual' the moment the operator edits it.
  const today = todayInput()
  const [captureDate, setCaptureDate] = useState(today)
  const [captureSource, setCaptureSource] = useState<'dicom_tag' | 'manual'>('manual')
  const { progress, upload, isUploading, abort } = useImagingUpload()

  const validateFile = (f: File): string => {
    if (!ALLOWED_TYPES.includes(f.type) && !isDicomFile(f)) {
      return 'Unsupported format. Use JPEG, PNG, TIFF, BMP, or DICOM.'
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum 100 MB.`
    }
    return ''
  }

  // Select a file: validate, and (§capture-date) seed the capture date from the
  // DICOM AcquisitionDate when present, so the operator confirms rather than types.
  const applyFile = async (selected: File | null) => {
    setFile(selected)
    if (!selected) {
      setError('')
      return
    }
    setError(validateFile(selected))
    if (isDicomFile(selected)) {
      try {
        const iso = parseDicomAcquisitionDate(await selected.arrayBuffer())
        if (iso) {
          setCaptureDate(isoToDateInput(iso))
          setCaptureSource('dicom_tag')
        }
      } catch {
        // best-effort — fall back to the current (today / user-entered) date
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void applyFile(e.target.files?.[0] ?? null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    void applyFile(dropped)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    // §capture-date: an image can't have been taken in the future.
    if (captureDate && captureDate > today) {
      setError("Capture date can't be in the future.")
      return
    }
    setError('')
    try {
      const result = await upload(file, {
        patientId,
        branchId,
        visitId,
        modality,
        toothNumbers: toothNumber ? [parseInt(toothNumber, 10)] : [],
        ...(captureDate ? { capturedAt: dateInputToIso(captureDate), capturedAtSource: captureSource } : {}),
      })
      onSuccess?.(result.studyId)
      setFile(null)
      setToothNumber('')
      setCaptureDate(today)
      setCaptureSource('manual')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="image-upload-capture-date">Capture date</Label>
        <Input
          id="image-upload-capture-date"
          type="date"
          aria-label="Capture date"
          data-testid="image-upload-capture-date"
          max={today}
          value={captureDate}
          onChange={(e) => {
            setCaptureDate(e.target.value)
            setCaptureSource('manual')
          }}
          className="coarse:min-h-[44px]"
        />
        <p className="text-xs text-muted-foreground">When the image was taken (not when it was uploaded). Defaults to today.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="image-upload-modality">Modality</Label>
        <select
          id="image-upload-modality"
          name="modality"
          aria-label="Modality"
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {MODALITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="image-upload-tooth">Tooth number (optional)</Label>
        <Input
          id="image-upload-tooth"
          type="number"
          min={1}
          max={32}
          value={toothNumber}
          onChange={(e) => setToothNumber(e.target.value)}
          placeholder="e.g. 14"
        />
        <p className="text-xs text-muted-foreground">Link this image to a tooth (1–32). Leave blank for full-mouth or extraoral.</p>
      </div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-5 text-center"
      >
        <Upload className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
        <Label htmlFor="image-upload-file" className="cursor-pointer text-sm font-medium text-foreground">
          Drag &amp; drop, or choose a file
        </Label>
        <input
          id="image-upload-file"
          type="file"
          accept=".jpg,.jpeg,.png,.tif,.tiff,.bmp,.dcm,application/dicom"
          onChange={handleFileChange}
          className="mx-auto block text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
        />
        {file ? (
          <p className="text-xs font-medium text-foreground">
            {file.name} — {(file.size / 1024).toFixed(0)} KB
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">JPEG, PNG, TIFF, BMP or DICOM · up to 100 MB</p>
        )}
      </div>
      {isUploading && (
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-lemon transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!file || isUploading || Boolean(error)}
          className="flex-1 bg-lemon text-lemon-foreground hover:bg-lemon-hover"
        >
          {isUploading ? `Uploading… ${progress}%` : 'Upload'}
        </Button>
        {isUploading && (
          <Button type="button" variant="outline" onClick={abort}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
