import { useState } from 'react'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'
import {
  useImageLibrary,
  useImageLinks,
  type ImageLinkType,
  type ImageModality,
} from '@/features/imaging/hooks/use-image-library'
import {
  buildMetadataBody,
  tagsToInput,
  isValidLinkTarget,
  type MetadataForm,
} from '@/features/imaging/lib/image-metadata-form'
import { LINK_TYPE_LABELS } from '@/features/imaging/lib/image-library-filter'

interface ImageMetadataEditorProps {
  item: PatientImageItem
  patientId: string
  branchId: string
  /** Called after a successful metadata save (e.g. to close a Sheet). */
  onSaved?: () => void
}

const LINK_TYPES: ImageLinkType[] = ['treatment_plan', 'ortho_case', 'report']

// Reclassify targets. Mirrors DentalImagingModuleModalityEnum; CBCT volumes are
// edited via their own card, so 'cbct' is intentionally absent from this 2-D
// library editor's choices.
const MODALITY_OPTIONS: { value: ImageModality; label: string }[] = [
  { value: 'periapical', label: 'Periapical' },
  { value: 'bitewing', label: 'Bitewing' },
  { value: 'panoramic', label: 'Panoramic' },
  { value: 'cephalometric', label: 'Cephalometric' },
  { value: 'intraoral_photo', label: 'Intraoral photo' },
  { value: 'extraoral_photo', label: 'Extraoral photo' },
  { value: 'other', label: 'Other' },
]

/**
 * G5 write UI — edit an image's library metadata (diagnostic flag, acquisition
 * quality / retake reason, tags) and manage its context links (treatment plan /
 * ortho case / report). Mutations live in useImageLibrary; the per-image links
 * query is the fresh source for the link list.
 */
export function ImageMetadataEditor({ item, patientId, branchId, onSaved }: ImageMetadataEditorProps) {
  const { updateMetadata, updateModality, deleteImage, createLink, deleteLink, mutationError } =
    useImageLibrary({ patientId, branchId })
  const { links } = useImageLinks(item.id)

  const [form, setForm] = useState<MetadataForm>({
    isDiagnostic: item.isDiagnostic,
    qualityStatus: item.qualityStatus,
    retakeReason: item.retakeReason ?? '',
    tagsInput: tagsToInput(item.tags),
  })

  const [linkType, setLinkType] = useState<ImageLinkType>('treatment_plan')
  const [linkTarget, setLinkTarget] = useState('')
  const canAddLink = isValidLinkTarget(linkTarget) && !createLink.isPending

  // Reclassify: only fires once the modality actually changes from the current.
  const [modality, setModality] = useState<ImageModality>(item.modality)
  const modalityChanged = modality !== item.modality

  // Delete is destructive (soft-delete/archive); require an explicit confirm.
  const [confirmDelete, setConfirmDelete] = useState(false)

  function save() {
    updateMetadata.mutate(
      { imageId: item.id, body: buildMetadataBody(form) },
      { onSuccess: () => onSaved?.() },
    )
  }

  function reclassify() {
    if (!modalityChanged) return
    updateModality.mutate(
      { imageId: item.id, modality },
      { onSuccess: () => onSaved?.() },
    )
  }

  function removeImage() {
    deleteImage.mutate({ imageId: item.id }, { onSuccess: () => onSaved?.() })
  }

  function addLink() {
    if (!canAddLink) return
    createLink.mutate(
      { imageId: item.id, linkType, targetId: linkTarget.trim() },
      { onSuccess: () => setLinkTarget('') },
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm" data-testid="image-metadata-editor">
      {/* Reclassify modality — fix a mis-classified capture (GAP-4 / FIX-003) */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-zinc-600">Modality</span>
        <div className="flex items-center gap-2">
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value as ImageModality)}
            data-testid="meta-modality"
            className="flex-1 rounded border border-zinc-200 px-2 py-1"
          >
            {MODALITY_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={reclassify}
            disabled={!modalityChanged || updateModality.isPending}
            data-testid="reclassify-modality"
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-lemon disabled:opacity-40"
          >
            {updateModality.isPending ? 'Reclassifying…' : 'Reclassify'}
          </button>
        </div>
      </section>

      {/* Metadata */}
      <section className="flex flex-col gap-3 border-t border-zinc-100 pt-3">
        <label className="flex items-center gap-2 text-zinc-700">
          <input
            type="checkbox"
            checked={form.isDiagnostic}
            onChange={(e) => setForm((f) => ({ ...f, isDiagnostic: e.target.checked }))}
            className="accent-lemon"
            data-testid="meta-diagnostic"
          />
          Diagnostic image
        </label>

        <label className="flex flex-col gap-1 text-zinc-700">
          <span className="text-xs font-medium text-zinc-500">Quality</span>
          <select
            value={form.qualityStatus}
            onChange={(e) =>
              setForm((f) => ({ ...f, qualityStatus: e.target.value as 'ok' | 'retake' }))
            }
            data-testid="meta-quality"
            className="rounded border border-zinc-200 px-2 py-1"
          >
            <option value="ok">OK</option>
            <option value="retake">Needs retake</option>
          </select>
        </label>

        {form.qualityStatus === 'retake' && (
          <label className="flex flex-col gap-1 text-zinc-700">
            <span className="text-xs font-medium text-zinc-500">Retake reason</span>
            <input
              type="text"
              value={form.retakeReason}
              onChange={(e) => setForm((f) => ({ ...f, retakeReason: e.target.value }))}
              data-testid="meta-retake-reason"
              placeholder="e.g. overexposed, motion blur"
              className="rounded border border-zinc-200 px-2 py-1"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-zinc-700">
          <span className="text-xs font-medium text-zinc-500">Tags (comma-separated)</span>
          <input
            type="text"
            value={form.tagsInput}
            onChange={(e) => setForm((f) => ({ ...f, tagsInput: e.target.value }))}
            data-testid="meta-tags"
            placeholder="e.g. ortho, pre-op"
            className="rounded border border-zinc-200 px-2 py-1"
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={updateMetadata.isPending}
          data-testid="meta-save"
          className="self-start rounded-md bg-lemon px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {updateMetadata.isPending ? 'Saving…' : 'Save metadata'}
        </button>
      </section>

      {/* Context links */}
      <section className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <span className="text-xs font-semibold text-zinc-600">Context links</span>
        {links.length === 0 ? (
          <p className="text-xs text-zinc-400">No links yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-700">
                  <span className="font-medium">{LINK_TYPE_LABELS[l.linkType]}</span>
                  <span className="ml-1 text-zinc-400">{l.targetId.slice(0, 8)}…</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteLink.mutate({ linkId: l.id, imageId: item.id })}
                  data-testid={`link-remove-${l.id}`}
                  className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
                  aria-label={`Remove ${LINK_TYPE_LABELS[l.linkType]} link`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as ImageLinkType)}
            data-testid="link-type"
            className="rounded border border-zinc-200 px-1.5 py-1 text-xs"
          >
            {LINK_TYPES.map((lt) => (
              <option key={lt} value={lt}>{LINK_TYPE_LABELS[lt]}</option>
            ))}
          </select>
          <input
            type="text"
            value={linkTarget}
            onChange={(e) => setLinkTarget(e.target.value)}
            data-testid="link-target"
            placeholder="target id (uuid)"
            className="min-w-0 flex-1 rounded border border-zinc-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!canAddLink}
            data-testid="link-add"
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </section>

      {/* Delete image — soft-delete/archive, removes a bad capture (FIX-003) */}
      <section className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            data-testid="delete-image"
            className="self-start rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Delete image
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">Remove this image from the library?</span>
            <button
              type="button"
              onClick={removeImage}
              disabled={deleteImage.isPending}
              data-testid="delete-image-confirm"
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {deleteImage.isPending ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              data-testid="delete-image-cancel"
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {mutationError && (
        <p className="text-xs text-red-600" data-testid="image-metadata-error">
          {mutationError instanceof Error ? mutationError.message : 'Something went wrong'}
        </p>
      )}
    </div>
  )
}
