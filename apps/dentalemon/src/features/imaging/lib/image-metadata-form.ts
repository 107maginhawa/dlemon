import type { DentalImagingModuleUpdateImageMetadataBody } from '@monobase/sdk-ts/generated'

const TAG_MAX_LEN = 50
const MAX_TAGS = 30
const RETAKE_REASON_MAX_LEN = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface MetadataForm {
  isDiagnostic: boolean
  qualityStatus: 'ok' | 'retake'
  retakeReason: string
  tagsInput: string
}

/**
 * G5: parse a comma-separated tag input into normalized tags, mirroring the
 * server's `updateImageMetadata` rules — trim, clamp to 50 chars, drop blanks,
 * de-dupe (first occurrence wins, case-sensitive like the server), cap at 30.
 */
export function normalizeTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((t) => t.trim().slice(0, TAG_MAX_LEN))
        .filter((t) => t.length > 0),
    ),
  ].slice(0, MAX_TAGS)
}

/** Round-trip a tag list back into the comma-separated input field value. */
export function tagsToInput(tags: string[]): string {
  return tags.join(', ')
}

/**
 * Build the PATCH /images/{id}/metadata body from editor form state. The retake
 * reason is meaningful only when quality is `retake`; otherwise it is cleared to
 * null so an `ok` image never carries a stale reason.
 */
export function buildMetadataBody(form: MetadataForm): DentalImagingModuleUpdateImageMetadataBody {
  const trimmedReason = form.retakeReason.trim()
  const retakeReason =
    form.qualityStatus === 'retake' && trimmedReason.length > 0
      ? trimmedReason.slice(0, RETAKE_REASON_MAX_LEN)
      : null
  return {
    isDiagnostic: form.isDiagnostic,
    qualityStatus: form.qualityStatus,
    retakeReason,
    tags: normalizeTags(form.tagsInput),
  }
}

/** Mirror the server's targetId validation — a link target must be a UUID. */
export function isValidLinkTarget(targetId: string): boolean {
  return UUID_RE.test(targetId.trim())
}
