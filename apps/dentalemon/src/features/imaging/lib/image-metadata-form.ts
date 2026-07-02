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
  // §capture-date: the date input (YYYY-MM-DD) + the image's original value, so
  // the body only carries capturedAt when the operator actually changed it.
  capturedAtInput?: string
  initialCapturedAtInput?: string
}

/** ISO timestamp → a native <input type="date"> value (YYYY-MM-DD, UTC day). */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** A <input type="date"> value (YYYY-MM-DD) → a midnight-UTC ISO timestamp. */
export function dateInputToIso(day: string): string {
  if (!day) return ''
  return `${day}T00:00:00.000Z`
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
  // §capture-date: include capturedAt only when the operator changed the date
  // (and it's non-blank) — the editor sends full metadata on every save, and any
  // present capturedAt re-stamps source=manual + writes an audit row server-side.
  const capturedAtChanged =
    form.capturedAtInput != null &&
    form.capturedAtInput.length > 0 &&
    form.capturedAtInput !== form.initialCapturedAtInput
  return {
    isDiagnostic: form.isDiagnostic,
    qualityStatus: form.qualityStatus,
    retakeReason,
    tags: normalizeTags(form.tagsInput),
    // The SDK body types utcDateTime as Date (the client serializes it to ISO).
    ...(capturedAtChanged ? { capturedAt: new Date(dateInputToIso(form.capturedAtInput!)) } : {}),
  }
}

/** Mirror the server's targetId validation — a link target must be a UUID. */
export function isValidLinkTarget(targetId: string): boolean {
  return UUID_RE.test(targetId.trim())
}
