/**
 * Full-Mouth Series (FMX) anatomical mount layout (P2-5).
 *
 * A standard FMX is a defined set of intraoral films mounted in anatomical
 * position: periapicals across the maxillary and mandibular arches plus posterior
 * bitewings. This module defines the mount template (positions + the universal
 * tooth numbers each position covers) and a pure assignment function that slots a
 * patient's images into the template by tooth number + modality.
 *
 * Pure + framework-free so it is unit-testable without rendering.
 */

export type FmxRow = 'maxillary' | 'bitewing' | 'mandibular'
export type FmxFilmType = 'periapical' | 'bitewing'

export interface FmxPosition {
  /** Stable position id (used as React key + test selector). */
  id: string
  /** Anatomical row. */
  row: FmxRow
  /** Left→right order within the row (mount orientation). */
  order: number
  /** Short label (e.g. "UR molars", "Bitewing R"). */
  label: string
  /** Expected film type for this slot. */
  filmType: FmxFilmType
  /** Universal tooth numbers this slot anatomically covers. */
  teeth: number[]
}

/**
 * Standard 18-film FMX template (universal numbering, 1–32).
 * Maxillary row 1–16 left→right as mounted (patient's right on viewer's left);
 * mandibular row 32→17. Four posterior bitewings in the middle row.
 */
export const FMX_TEMPLATE: FmxPosition[] = [
  // Maxillary periapicals (patient upper arch)
  { id: 'max-ur-molar', row: 'maxillary', order: 0, label: 'UR molars', filmType: 'periapical', teeth: [1, 2, 3] },
  { id: 'max-ur-premolar', row: 'maxillary', order: 1, label: 'UR premolars', filmType: 'periapical', teeth: [4, 5] },
  { id: 'max-ur-canine', row: 'maxillary', order: 2, label: 'UR canine', filmType: 'periapical', teeth: [6] },
  { id: 'max-incisors', row: 'maxillary', order: 3, label: 'U incisors', filmType: 'periapical', teeth: [7, 8, 9, 10] },
  { id: 'max-ul-canine', row: 'maxillary', order: 4, label: 'UL canine', filmType: 'periapical', teeth: [11] },
  { id: 'max-ul-premolar', row: 'maxillary', order: 5, label: 'UL premolars', filmType: 'periapical', teeth: [12, 13] },
  { id: 'max-ul-molar', row: 'maxillary', order: 6, label: 'UL molars', filmType: 'periapical', teeth: [14, 15, 16] },

  // Posterior bitewings
  { id: 'bw-r-molar', row: 'bitewing', order: 0, label: 'Bitewing R molar', filmType: 'bitewing', teeth: [2, 3, 30, 31] },
  { id: 'bw-r-premolar', row: 'bitewing', order: 1, label: 'Bitewing R premolar', filmType: 'bitewing', teeth: [4, 5, 28, 29] },
  { id: 'bw-l-premolar', row: 'bitewing', order: 2, label: 'Bitewing L premolar', filmType: 'bitewing', teeth: [12, 13, 20, 21] },
  { id: 'bw-l-molar', row: 'bitewing', order: 3, label: 'Bitewing L molar', filmType: 'bitewing', teeth: [14, 15, 18, 19] },

  // Mandibular periapicals (patient lower arch)
  { id: 'man-lr-molar', row: 'mandibular', order: 0, label: 'LR molars', filmType: 'periapical', teeth: [30, 31, 32] },
  { id: 'man-lr-premolar', row: 'mandibular', order: 1, label: 'LR premolars', filmType: 'periapical', teeth: [28, 29] },
  { id: 'man-lr-canine', row: 'mandibular', order: 2, label: 'LR canine', filmType: 'periapical', teeth: [27] },
  { id: 'man-incisors', row: 'mandibular', order: 3, label: 'L incisors', filmType: 'periapical', teeth: [23, 24, 25, 26] },
  { id: 'man-ll-canine', row: 'mandibular', order: 4, label: 'LL canine', filmType: 'periapical', teeth: [22] },
  { id: 'man-ll-premolar', row: 'mandibular', order: 5, label: 'LL premolars', filmType: 'periapical', teeth: [20, 21] },
  { id: 'man-ll-molar', row: 'mandibular', order: 6, label: 'LL molars', filmType: 'periapical', teeth: [17, 18, 19] },
]

/** Minimal shape the mount needs from an image item. */
export interface FmxImageLike {
  id: string
  modality: string
  toothNumbers: number[]
}

export interface FmxAssignment {
  position: FmxPosition
  /** The image slotted here, or null when the series has no film for this slot. */
  image: FmxImageLike | null
}

const PERIAPICAL_MODALITIES = new Set(['periapical'])
const BITEWING_MODALITIES = new Set(['bitewing'])

function modalityMatchesFilm(modality: string, filmType: FmxFilmType): boolean {
  if (filmType === 'bitewing') return BITEWING_MODALITIES.has(modality)
  // periapical slots accept periapical films
  return PERIAPICAL_MODALITIES.has(modality)
}

/**
 * Assign images to FMX positions. An image is slotted into the first matching
 * position whose film type matches the image modality AND which covers one of the
 * image's tooth numbers. Each image is used at most once; positions with no match
 * are returned with image=null (empty mount slot).
 */
export function assignImagesToFmx(images: FmxImageLike[]): FmxAssignment[] {
  const used = new Set<string>()
  return FMX_TEMPLATE.map((position) => {
    const match = images.find(
      (img) =>
        !used.has(img.id) &&
        modalityMatchesFilm(img.modality, position.filmType) &&
        img.toothNumbers.some((t) => position.teeth.includes(t)),
    )
    if (match) used.add(match.id)
    return { position, image: match ?? null }
  })
}

/** Images that could not be placed in any FMX slot (wrong modality or no tooth match). */
export function unmountedImages(images: FmxImageLike[]): FmxImageLike[] {
  const assignments = assignImagesToFmx(images)
  const mounted = new Set(assignments.map((a) => a.image?.id).filter((x): x is string => !!x))
  return images.filter((img) => !mounted.has(img.id))
}
