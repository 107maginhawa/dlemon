import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@monobase/ui'
import { useImagingStudies, type PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'
import { ImageUpload } from './image-upload'
import { ImageMetadataEditor } from './image-metadata-editor'
import { FmxMount } from './FmxMount'
import { CbctStudyCard } from './CbctStudyCard'
import { BRAND_GOLD_SOFT, BRAND_GOLD_TEXT } from '@/constants/brand'
import { filterImageLibrary, collectTags, LINK_TYPE_LABELS, type ImageLinkType } from '@/features/imaging/lib/image-library-filter'

// P2-7: a CBCT / multi-frame object is a 3-D VOLUME — never render it as a flat
// list row with an <img> thumbnail. The discriminator is server-provided.
function isVolumeItem(item: PatientImageItem): boolean {
  return item.viewerKind === 'volume' || item.isVolume === true || item.modality === 'cbct'
}

interface PatientImageListProps {
  patientId: string
  branchId: string
  onSelectImage?: (item: PatientImageItem) => void
  onCompare?: (items: [PatientImageItem, PatientImageItem]) => void
}

export function PatientImageList({ patientId, branchId, onSelectImage, onCompare }: PatientImageListProps) {
  const { data, isLoading, error, refetch } = useImagingStudies(patientId, branchId)
  const [uploadOpen, setUploadOpen] = useState(false)
  // G5: per-image metadata/links editor (Sheet). Holds the image being edited.
  const [editingItem, setEditingItem] = useState<PatientImageItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // P2-5: list view vs anatomical full-mouth-series mount.
  const [view, setView] = useState<'list' | 'fmx'>('list')
  // G5: client-side library filters over the fetched list (no refetch on toggle).
  const [diagnosticOnly, setDiagnosticOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState<string>('')
  const [linkTypeFilter, setLinkTypeFilter] = useState<'' | ImageLinkType>('')

  const allItems = data?.items ?? []
  const availableTags = collectTags(allItems)
  const hasAnyLinks = allItems.some((i) => i.links.length > 0)
  const visibleItems = filterImageLibrary(allItems, {
    diagnosticOnly,
    tag: tagFilter || undefined,
    linkType: linkTypeFilter || undefined,
  })

  function toggleSelect(item: PatientImageItem, e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else if (next.size < 2) {
        next.add(item.id)
      }
      return next
    })
  }

  return (
    <div className={`flex flex-col h-full border-r border-zinc-200 bg-white ${view === 'fmx' ? 'w-[460px]' : 'w-[280px]'}`}>
      {/* Header with Upload trigger */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-800">Images</span>
          {/* P2-5: list ↔ FMX anatomical mount toggle */}
          <button
            type="button"
            onClick={() => setView((v) => (v === 'list' ? 'fmx' : 'list'))}
            aria-pressed={view === 'fmx'}
            data-testid="fmx-toggle"
            className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-lemon"
          >
            {view === 'fmx' ? 'List view' : 'FMX mount'}
          </button>
        </div>
        {selectedIds.size === 2 && (
          <button
            onClick={() => {
              const selected = (data?.items ?? []).filter(i => selectedIds.has(i.id))
              if (selected.length === 2) {
                onCompare?.([selected[0]!, selected[1]!])
              }
            }}
            className="bg-lemon text-black text-xs font-semibold px-3 py-1.5 rounded-md"
            data-testid="compare-btn"
          >
            Compare ▶
          </button>
        )}
        <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
          <SheetTrigger asChild>
            <button className="bg-lemon text-black text-xs font-semibold px-3 py-1.5 rounded-md">
              Upload Image
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[320px]">
            <SheetHeader>
              <SheetTitle>Upload Image</SheetTitle>
            </SheetHeader>
            <ImageUpload
              patientId={patientId}
              branchId={branchId}
              onSuccess={() => {
                setUploadOpen(false)
                void refetch()
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* G5: library filters (list view only, once there are images) */}
      {!isLoading && !error && allItems.length > 0 && view === 'list' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 text-[11px]">
          <label className="flex items-center gap-1 text-zinc-600">
            <input
              type="checkbox"
              checked={diagnosticOnly}
              onChange={(e) => setDiagnosticOnly(e.target.checked)}
              className="accent-lemon"
              data-testid="filter-diagnostic-only"
            />
            Diagnostic only
          </label>
          {hasAnyLinks && (
            <select
              value={linkTypeFilter}
              onChange={(e) => setLinkTypeFilter(e.target.value as '' | ImageLinkType)}
              data-testid="filter-link-type"
              className="rounded border border-zinc-200 px-1.5 py-0.5 text-zinc-600"
            >
              <option value="">All links</option>
              {(Object.keys(LINK_TYPE_LABELS) as ImageLinkType[]).map((lt) => (
                <option key={lt} value={lt}>{LINK_TYPE_LABELS[lt]}</option>
              ))}
            </select>
          )}
          {availableTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              data-testid="filter-tag"
              className="ml-auto rounded border border-zinc-200 px-1.5 py-0.5 text-zinc-600"
            >
              <option value="">All tags</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Image list */}
      {isLoading && <div className="p-4 text-zinc-400 text-sm">Loading images…</div>}
      {error && <div className="p-4 text-red-400 text-sm">Failed to load images</div>}
      {!isLoading && !error && !data?.items.length && (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <p className="text-sm font-medium text-zinc-800 mb-1">No images yet</p>
          <p className="text-xs text-zinc-500">
            Upload the first X-ray or photo for this patient.
          </p>
        </div>
      )}
      {!isLoading && !error && allItems.length ? (
        view === 'fmx' ? (
          <div className="flex-1 overflow-y-auto">
            <FmxMount images={allItems} onSelectImage={onSelectImage} />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-4 text-xs text-zinc-500" data-testid="no-filter-matches">
            No images match the current filters.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 flex-1 overflow-y-auto">
            {visibleItems.map((item) =>
              isVolumeItem(item) ? (
                // P2-7: CBCT / 3-D volume — volume-aware card + viewer handoff,
                // never a flat <img> row. Not eligible for 2-D pairwise compare.
                <li key={item.id} className="p-3">
                  <CbctStudyCard item={item} />
                </li>
              ) : (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => toggleSelect(item, e)}
                    className="shrink-0 accent-lemon"
                    data-testid={`select-image-${item.id}`}
                  />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectImage?.(item)}>
                    <p className="text-sm text-zinc-900 truncate">{item.fileName}</p>
                    <p className="text-xs text-zinc-400 capitalize">
                      {item.modality.replace('_', ' ')}
                    </p>
                    {/* G5: quality / diagnostic badges + tags + context-link badges */}
                    {(item.qualityStatus === 'retake' || !item.isDiagnostic || item.tags.length > 0 || item.links.length > 0) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {[...new Set(item.links.map((l) => l.linkType))].map((lt) => (
                          <span
                            key={lt}
                            className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                            data-testid={`link-badge-${item.id}-${lt}`}
                          >
                            {LINK_TYPE_LABELS[lt]}
                          </span>
                        ))}
                        {item.qualityStatus === 'retake' && (
                          <span
                            className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
                            data-testid={`badge-retake-${item.id}`}
                            title={item.retakeReason ?? 'Flagged for retake'}
                          >
                            Retake
                          </span>
                        )}
                        {!item.isDiagnostic && (
                          <span
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                            data-testid={`badge-non-diagnostic-${item.id}`}
                          >
                            Non-diagnostic
                          </span>
                        )}
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: BRAND_GOLD_SOFT, color: BRAND_GOLD_TEXT }}
                            data-testid={`tag-${item.id}-${t}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.source === 'legacy' && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: BRAND_GOLD_SOFT, color: BRAND_GOLD_TEXT }}
                    >
                      Legacy
                    </span>
                  )}
                  {/* G5: open the metadata/links editor for this image */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingItem(item)
                    }}
                    data-testid={`edit-image-${item.id}`}
                    aria-label={`Edit ${item.fileName}`}
                    className="shrink-0 rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-lemon"
                  >
                    Edit
                  </button>
                </li>
              ),
            )}
          </ul>
        )
      ) : null}

      {/* G5: metadata + context-link editor for the selected image */}
      <Sheet open={editingItem !== null} onOpenChange={(open) => { if (!open) setEditingItem(null) }}>
        <SheetContent side="right" className="w-[360px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit image{editingItem ? ` — ${editingItem.fileName}` : ''}</SheetTitle>
          </SheetHeader>
          {editingItem && (
            <div className="mt-4">
              <ImageMetadataEditor
                item={editingItem}
                patientId={patientId}
                branchId={branchId}
                onSaved={() => setEditingItem(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
