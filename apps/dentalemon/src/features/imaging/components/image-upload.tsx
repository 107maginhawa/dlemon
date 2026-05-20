import { useState } from 'react'
import { useImagingUpload } from '@/features/imaging/hooks/use-imaging-upload'

const MODALITY_OPTIONS = [
  { value: 'periapical', label: 'Periapical' },
  { value: 'bitewing', label: 'Bitewing' },
  { value: 'panoramic', label: 'Panoramic' },
  { value: 'cephalometric', label: 'Cephalometric' },
  { value: 'intraoral_photo', label: 'Intraoral Photo' },
  { value: 'extraoral_photo', label: 'Extraoral Photo' },
  { value: 'other', label: 'Other' },
] as const

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp']
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

interface ImageUploadProps {
  patientId: string
  branchId: string
  visitId?: string
  onSuccess?: (studyId: string) => void
}

export function ImageUpload({ patientId, branchId, visitId, onSuccess }: ImageUploadProps) {
  const [modality, setModality] = useState('other')
  const [toothNumber, setToothNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const { progress, upload, isUploading, abort } = useImagingUpload()

  const validateFile = (f: File): string => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return 'Unsupported format. Use JPEG, PNG, TIFF, or BMP.'
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum 100 MB.`
    }
    return ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    if (selected) {
      setError(validateFile(selected))
    } else {
      setError('')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    setFile(dropped)
    setError(validateFile(dropped))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
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
      })
      onSuccess?.(result.studyId)
      setFile(null)
      setToothNumber('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-zinc-900 rounded-lg">
      <div>
        <label className="text-sm text-zinc-300 block mb-1">Modality</label>
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1 text-sm"
        >
          {MODALITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm text-zinc-300 block mb-1">Tooth Number (optional)</label>
        <input
          type="number"
          min={1}
          max={32}
          value={toothNumber}
          onChange={(e) => setToothNumber(e.target.value)}
          placeholder="1–32"
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1 text-sm"
        />
      </div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-zinc-600 rounded-lg p-4 text-center"
      >
        <label className="text-sm text-zinc-300 block mb-2">Image File</label>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.tif,.tiff,.bmp"
          onChange={handleFileChange}
          className="text-sm text-zinc-300"
        />
        {file && (
          <p className="text-xs text-zinc-400 mt-1">
            {file.name} — {(file.size / 1024).toFixed(0)} KB
          </p>
        )}
        <p className="text-xs text-zinc-500 mt-1">or drag and drop here</p>
      </div>
      {isUploading && (
        <div className="w-full bg-zinc-700 rounded-full h-2">
          <div
            className="bg-[#FFE97D] h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!file || isUploading || Boolean(error)}
          className="flex-1 bg-[#FFE97D] text-black font-semibold py-2 rounded text-sm disabled:opacity-50"
        >
          {isUploading ? `Uploading… ${progress}%` : 'Upload'}
        </button>
        {isUploading && (
          <button
            type="button"
            onClick={abort}
            className="px-3 py-2 text-sm text-zinc-300 bg-zinc-700 rounded"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
