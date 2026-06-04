import { assignImagesToFmx, unmountedImages, type FmxRow } from '@/features/imaging/lib/fmx-layout'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

interface FmxMountProps {
  images: PatientImageItem[]
  onSelectImage?: (item: PatientImageItem) => void
}

const ROW_ORDER: FmxRow[] = ['maxillary', 'bitewing', 'mandibular']
const ROW_LABEL: Record<FmxRow, string> = {
  maxillary: 'Maxillary',
  bitewing: 'Bitewings',
  mandibular: 'Mandibular',
}

/**
 * Anatomical full-mouth-series (FMX) mount (P2-5). Lays out periapicals + posterior
 * bitewings in their standard mounted positions rather than a flat list. Images are
 * slotted by tooth number + modality; non-intraoral films (pano/ceph/photo) that do
 * not belong in an FMX are surfaced beneath the mount.
 */
export function FmxMount({ images, onSelectImage }: FmxMountProps) {
  const assignments = assignImagesToFmx(
    images.map((i) => ({ id: i.id, modality: i.modality, toothNumbers: i.toothNumbers ?? [] })),
  )
  const byId = new Map(images.map((i) => [i.id, i]))
  const leftover = unmountedImages(
    images.map((i) => ({ id: i.id, modality: i.modality, toothNumbers: i.toothNumbers ?? [] })),
  )

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto" data-testid="fmx-mount">
      {ROW_ORDER.map((row) => {
        const slots = assignments
          .filter((a) => a.position.row === row)
          .sort((a, b) => a.position.order - b.position.order)
        return (
          <section key={row} aria-label={ROW_LABEL[row]}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {ROW_LABEL[row]}
            </h3>
            <div className="grid grid-flow-col auto-cols-fr gap-1.5">
              {slots.map((slot) => {
                const item = slot.image ? byId.get(slot.image.id) : null
                return (
                  <button
                    key={slot.position.id}
                    type="button"
                    data-testid={`fmx-slot-${slot.position.id}`}
                    disabled={!item}
                    onClick={() => item && onSelectImage?.(item)}
                    title={slot.position.label}
                    className={
                      item
                        ? 'flex aspect-[3/4] flex-col items-center justify-center rounded border border-zinc-300 bg-zinc-900 text-[10px] text-white hover:border-lemon'
                        : 'flex aspect-[3/4] flex-col items-center justify-center rounded border border-dashed border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400'
                    }
                  >
                    {item && item.downloadUrl ? (
                      <img
                        src={item.downloadUrl}
                        alt={item.fileName}
                        crossOrigin="anonymous"
                        className="h-full w-full rounded object-cover"
                      />
                    ) : (
                      <span className="px-0.5 text-center leading-tight">{slot.position.label}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      {leftover.length > 0 && (
        <section aria-label="Other images">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Other (not in FMX)
          </h3>
          <ul className="flex flex-col gap-1" data-testid="fmx-leftover">
            {leftover.map((img) => {
              const item = byId.get(img.id)!
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => onSelectImage?.(item)}
                    className="w-full truncate rounded px-2 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                  >
                    {item.fileName}
                    <span className="ml-1 capitalize text-zinc-400">
                      {item.modality.replace('_', ' ')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
