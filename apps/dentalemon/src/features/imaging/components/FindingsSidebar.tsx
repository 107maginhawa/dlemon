import { useState } from 'react'
import { X, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { useImagingFindings, type ImagingFinding, type ImagingFindingType, type ImagingFindingStatus } from '@/features/imaging/hooks/use-imaging-findings'

// ── Type map ──────────────────────────────────────────────────────────────────

const FINDING_TYPE_LABELS: Record<ImagingFindingType, string> = {
  caries: 'Caries',
  secondary_caries: 'Secondary Caries',
  bone_loss: 'Bone Loss',
  furcation_involvement: 'Furcation Involvement',
  periapical_lesion: 'Periapical Lesion',
  root_resorption: 'Root Resorption',
  calculus: 'Calculus',
  crown_fracture: 'Crown Fracture',
  root_fracture: 'Root Fracture',
  impacted_tooth: 'Impacted Tooth',
  over_eruption: 'Over-Eruption',
  open_contact: 'Open Contact',
  overhang: 'Overhang',
  crown_needed: 'Crown Needed',
  implant_needed: 'Implant Needed',
}

// CIMG-05: 5 quick-select chips
const QUICK_CHIPS: { label: string; value: ImagingFindingType }[] = [
  { label: 'Caries', value: 'caries' },
  { label: 'Bone Loss', value: 'bone_loss' },
  { label: 'Periapical Lesion', value: 'periapical_lesion' },
  { label: 'Calculus', value: 'calculus' },
  { label: 'Root Fracture', value: 'root_fracture' },
]

// V-IMG-007: SM-01 is forward-only draft → confirmed → resolved (no back-edge / wrap).
const STATUS_CYCLE: ImagingFindingStatus[] = ['draft', 'confirmed', 'resolved']

function nextStatus(current: ImagingFindingStatus): ImagingFindingStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  // Forward-only: `resolved` is terminal, so advancing it is a no-op (avoids a 422).
  return STATUS_CYCLE[Math.min(idx + 1, STATUS_CYCLE.length - 1)]!
}

function statusBadgeClass(status: ImagingFindingStatus): string {
  switch (status) {
    case 'draft': return 'bg-zinc-700 text-zinc-300'
    case 'confirmed': return 'bg-green-900 text-green-300'
    case 'resolved': return 'bg-zinc-800 text-zinc-500'
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FindingsSidebarProps {
  imageId: string
  isOpen: boolean
  onClose: () => void
  initialAnnotationId?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FindingsSidebar({
  imageId,
  isOpen,
  onClose,
  initialAnnotationId,
}: FindingsSidebarProps) {
  const { findings, isLoading, isError, createFinding, updateFinding, deleteFinding } =
    useImagingFindings(imageId, { enabled: isOpen })

  const [selectedType, setSelectedType] = useState<ImagingFindingType | ''>('')
  const [selectedStatus, setSelectedStatus] = useState<ImagingFindingStatus>('draft')
  const [toothNumber, setToothNumber] = useState('')
  const [surfaces, setSurfaces] = useState('')
  const [note, setNote] = useState('')

  if (!isOpen) return null

  function handleChipClick(value: ImagingFindingType) {
    setSelectedType(value)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType) return

    const surfacesArr = surfaces
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    createFinding.mutate(
      {
        type: selectedType,
        status: selectedStatus,
        toothNumber: toothNumber ? parseInt(toothNumber, 10) : null,
        surfaces: surfacesArr.length > 0 ? surfacesArr : null,
        note: note.trim() || null,
        annotationId: initialAnnotationId ?? null,
      },
      {
        onSuccess: () => {
          setSelectedType('')
          setSelectedStatus('draft')
          setToothNumber('')
          setSurfaces('')
          setNote('')
        },
      },
    )
  }

  function handleCycleStatus(finding: ImagingFinding) {
    updateFinding.mutate({
      findingId: finding.id,
      data: { status: nextStatus(finding.status) },
    })
  }

  function handleDelete(findingId: string) {
    deleteFinding.mutate(findingId)
  }

  return (
    <div className="w-80 min-w-[20rem] flex flex-col border-l border-zinc-700 bg-zinc-900 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <span className="text-sm font-semibold text-white">Findings</span>
        <button
          onClick={onClose}
          aria-label="Close findings panel"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Create form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-3 border-b border-zinc-700">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">New Finding</span>

        {/* CIMG-05: Quick-select type chips */}
        <div className="flex flex-wrap gap-1">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleChipClick(chip.value)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                selectedType === chip.value
                  ? 'border-lemon bg-lemon/20 text-lemon'
                  : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Type select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Type</label>
          <Select
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as ImagingFindingType)}
          >
            <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white text-sm" aria-label="Type">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {(Object.entries(FINDING_TYPE_LABELS) as [ImagingFindingType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value} className="text-white hover:bg-zinc-700">
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Status select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Status</label>
          <Select
            value={selectedStatus}
            onValueChange={(v) => setSelectedStatus(v as ImagingFindingStatus)}
          >
            <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white text-sm" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {STATUS_CYCLE.map((s) => (
                <SelectItem key={s} value={s} className="text-white hover:bg-zinc-700 capitalize">
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tooth number — CIMG-06 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Tooth #</label>
          <Input
            type="number"
            min={1}
            max={32}
            placeholder="Tooth #"
            value={toothNumber}
            onChange={(e) => setToothNumber(e.target.value)}
            aria-label="Tooth number"
            className="bg-zinc-800 border-zinc-600 text-white text-sm"
          />
        </div>

        {/* Surfaces */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Surfaces</label>
          <Input
            type="text"
            placeholder="e.g. occlusal, mesial"
            value={surfaces}
            onChange={(e) => setSurfaces(e.target.value)}
            aria-label="Surfaces"
            className="bg-zinc-800 border-zinc-600 text-white text-sm"
          />
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Note</label>
          <Textarea
            placeholder="Clinical note..."
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Clinical note"
            className="bg-zinc-800 border-zinc-600 text-white text-sm resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={!selectedType || createFinding.isPending}
          className="bg-lemon text-zinc-900 hover:bg-lemon/90 text-sm font-medium"
        >
          {createFinding.isPending ? 'Adding...' : 'Add Finding'}
        </Button>
      </form>

      {/* Findings list */}
      <div className="flex flex-col flex-1 px-4 py-3 gap-2">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Findings List</span>

        {isError ? (
          <p className="text-xs text-red-400 mt-2">
            Failed to load findings. Please try again.
          </p>
        ) : isLoading ? (
          <>
            <Skeleton className="h-14 w-full bg-zinc-800" />
            <Skeleton className="h-14 w-full bg-zinc-800" />
            <Skeleton className="h-14 w-full bg-zinc-800" />
          </>
        ) : findings.length === 0 ? (
          <p className="text-xs text-zinc-500 mt-2">
            No findings yet. Document a finding above.
          </p>
        ) : (
          findings.map((finding) => (
            <div
              key={finding.id}
              className="flex items-start justify-between gap-2 rounded-md bg-zinc-800 px-3 py-2"
            >
              <div className="flex flex-col gap-1 min-w-0">
                {/* Type badge */}
                <span className="text-xs font-medium text-lemon truncate">
                  {FINDING_TYPE_LABELS[finding.type] ?? finding.type}
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {/* Status badge */}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusBadgeClass(finding.status)}`}
                  >
                    {finding.status}
                  </span>
                  {/* Tooth number */}
                  {finding.toothNumber != null && (
                    <span className="text-[10px] text-zinc-400">#{finding.toothNumber}</span>
                  )}
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleCycleStatus(finding)}
                  aria-label="Cycle status"
                  title="Cycle status"
                  className="p-1 text-zinc-400 hover:text-lemon transition-colors"
                  disabled={updateFinding.isPending || deleteFinding.isPending}
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  onClick={() => handleDelete(finding.id)}
                  aria-label="Delete finding"
                  title="Delete finding"
                  className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                  disabled={updateFinding.isPending || deleteFinding.isPending}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
