/**
 * Minimal client-side DICOM PixelSpacing parser (P1-9).
 *
 * The server never sees the image bytes (the client PUTs directly to S3), so the
 * DICOM PixelSpacing tag (0028,0030) must be read in the browser before upload and
 * passed in the create-study body. This is a deliberately small reader: it locates
 * the "DICM" magic, then scans the explicit-VR little-endian stream for the
 * PixelSpacing element and parses its DS value ("rowSpacing\\colSpacing", mm).
 *
 * It is NOT a full DICOM parser — it extracts only the one tag needed for
 * calibration. Anything unparseable returns null and the caller falls back to the
 * manual-ruler calibration workflow (behaviour unchanged for non-DICOM uploads).
 */

export const DICOM_MIME_TYPE = 'application/dicom'

/** mm-per-pixel plausibility window (mirrors the ceph-math calibration guard). */
const MM_PX_MIN = 0.01
const MM_PX_MAX = 2.0

export interface DicomPixelSpacing {
  /** Average (or isotropic) spacing in mm/px — used as the calibration value. */
  pixelSpacingMm: number
  /** Row spacing in mm (DICOM PixelSpacing[0]). */
  rowSpacingMm: number
  /** Column spacing in mm (DICOM PixelSpacing[1]). */
  colSpacingMm: number
}

export function isDicomMimeType(mimeType: string | undefined | null): boolean {
  return mimeType === DICOM_MIME_TYPE
}

const PREAMBLE_LEN = 128
const MAGIC = 'DICM'

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i] ?? 0)
  return s
}

/**
 * Parse the DICOM PixelSpacing (0028,0030) tag from a file's bytes.
 * Returns null if the buffer is not DICOM, the tag is absent, or the value is
 * implausible. Supports explicit-VR little-endian (the common transfer syntax).
 */
export function parseDicomPixelSpacing(buffer: ArrayBuffer): DicomPixelSpacing | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < PREAMBLE_LEN + MAGIC.length) return null
  if (readAscii(bytes, PREAMBLE_LEN, MAGIC.length) !== MAGIC) return null

  const view = new DataView(buffer)
  let off = PREAMBLE_LEN + MAGIC.length

  // Scan elements until the tag is found or the stream ends.
  while (off + 8 <= bytes.length) {
    const group = view.getUint16(off, true)
    const element = view.getUint16(off + 2, true)
    const vr = readAscii(bytes, off + 4, 2)

    // Explicit-VR: VRs OB/OW/OF/SQ/UT/UN use a 4-byte length after 2 reserved bytes;
    // everything else uses a 2-byte length. Implicit-VR has no VR chars — fall back
    // to a 4-byte length read.
    const isVrChars = /^[A-Z]{2}$/.test(vr)
    const longVr = isVrChars && ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN'].includes(vr)

    let valueOffset: number
    let length: number
    if (!isVrChars) {
      // Implicit VR: tag(4) + length(4)
      length = view.getUint32(off + 4, true)
      valueOffset = off + 8
    } else if (longVr) {
      length = view.getUint32(off + 8, true) // skip 2 reserved bytes
      valueOffset = off + 12
    } else {
      length = view.getUint16(off + 6, true)
      valueOffset = off + 8
    }

    if (length < 0 || valueOffset + length > bytes.length) break

    if (group === 0x0028 && element === 0x0030) {
      const raw = readAscii(bytes, valueOffset, length).trim()
      const parts = raw.split('\\').map((p) => parseFloat(p.trim()))
      const rowSpacingMm = parts[0]
      const colSpacingMm = parts.length > 1 && Number.isFinite(parts[1]) ? parts[1] : parts[0]
      if (
        rowSpacingMm == null ||
        !Number.isFinite(rowSpacingMm) ||
        colSpacingMm == null ||
        !Number.isFinite(colSpacingMm)
      ) {
        return null
      }
      const avg = (rowSpacingMm + colSpacingMm) / 2
      if (avg < MM_PX_MIN || avg > MM_PX_MAX) return null
      return { pixelSpacingMm: avg, rowSpacingMm, colSpacingMm }
    }

    // Stop scanning once we pass group 0028 (elements are stored in ascending
    // tag order); avoids walking the whole pixel data for large CBCT files.
    if (group > 0x0028) break

    off = valueOffset + length
  }

  return null
}

/** Parse a DICOM DA value ("YYYYMMDD") into a midnight-UTC ISO string, or null. */
function daToIso(raw: string): string | null {
  const v = raw.trim()
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const iso = `${y}-${mo}-${d}T00:00:00.000Z`
  const parsed = new Date(iso)
  // Guard against impossible dates (e.g. month 13) that Date silently rolls over.
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== iso) return null
  return iso
}

/**
 * §capture-date: parse the acquisition date from a DICOM file's bytes. Reads, in
 * priority order, AcquisitionDate (0008,0022) → ContentDate (0008,0023) →
 * StudyDate (0008,0020), all group-0008 DA-VR tags. Returns a midnight-UTC ISO
 * string, or null if not DICOM / no usable date tag. Deliberately small — mirrors
 * parseDicomPixelSpacing; anything unparseable falls back to the upload-time
 * default at the call site.
 */
export function parseDicomAcquisitionDate(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < PREAMBLE_LEN + MAGIC.length) return null
  if (readAscii(bytes, PREAMBLE_LEN, MAGIC.length) !== MAGIC) return null

  const view = new DataView(buffer)
  let off = PREAMBLE_LEN + MAGIC.length
  const found: Record<number, string> = {}

  while (off + 8 <= bytes.length) {
    const group = view.getUint16(off, true)
    const element = view.getUint16(off + 2, true)
    const vr = readAscii(bytes, off + 4, 2)

    const isVrChars = /^[A-Z]{2}$/.test(vr)
    const longVr = isVrChars && ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN'].includes(vr)

    let valueOffset: number
    let length: number
    if (!isVrChars) {
      length = view.getUint32(off + 4, true)
      valueOffset = off + 8
    } else if (longVr) {
      length = view.getUint32(off + 8, true)
      valueOffset = off + 12
    } else {
      length = view.getUint16(off + 6, true)
      valueOffset = off + 8
    }
    if (length < 0 || valueOffset + length > bytes.length) break

    if (group === 0x0008 && (element === 0x0020 || element === 0x0022 || element === 0x0023)) {
      found[element] = readAscii(bytes, valueOffset, length)
    }

    // Date tags all live in group 0008 — stop once we pass it (ascending tag order).
    if (group > 0x0008) break

    off = valueOffset + length
  }

  // Priority: AcquisitionDate → ContentDate → StudyDate.
  for (const element of [0x0022, 0x0023, 0x0020]) {
    const raw = found[element]
    if (raw !== undefined) {
      const iso = daToIso(raw)
      if (iso) return iso
    }
  }
  return null
}
