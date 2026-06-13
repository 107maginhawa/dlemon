import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

export type ImageLinkType = 'treatment_plan' | 'ortho_case' | 'report'

export interface ImageLibraryFilter {
  diagnosticOnly?: boolean
  qualityStatus?: 'ok' | 'retake'
  tag?: string
  linkType?: ImageLinkType
}

/** Short human label for a context-link type (badges + filter options). */
export const LINK_TYPE_LABELS: Record<ImageLinkType, string> = {
  treatment_plan: 'Plan',
  ortho_case: 'Ortho',
  report: 'Report',
}

/**
 * G5: client-side library filter mirroring the server's `applyImageLibraryFilters`.
 * Undefined fields are no-ops; tag match is exact (case-insensitive). Applied over
 * the already-fetched list so toggling filters never triggers a refetch.
 */
export function filterImageLibrary(
  items: PatientImageItem[],
  filter: ImageLibraryFilter,
): PatientImageItem[] {
  const tagNeedle = filter.tag?.trim().toLowerCase()
  return items.filter((it) => {
    if (filter.diagnosticOnly && !it.isDiagnostic) return false
    if (filter.qualityStatus && it.qualityStatus !== filter.qualityStatus) return false
    if (tagNeedle && !it.tags.some((t) => t.toLowerCase() === tagNeedle)) return false
    if (filter.linkType && !it.links.some((l) => l.linkType === filter.linkType)) return false
    return true
  })
}

/** Distinct, sorted tag list across the library (for a tag filter dropdown). */
export function collectTags(items: PatientImageItem[]): string[] {
  return [...new Set(items.flatMap((it) => it.tags))].sort((a, b) => a.localeCompare(b))
}
