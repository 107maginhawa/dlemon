import { describe, test, expect } from 'bun:test'
import { isDicomMimeType, parseDicomPixelSpacing, DICOM_MIME_TYPE } from './dicom'

/**
 * Build a minimal little-endian explicit-VR DICOM byte buffer containing a
 * PixelSpacing element (0028,0030) with a DS value "rowSpacing\colSpacing".
 * Layout: 128-byte preamble + "DICM" magic + the element. This mirrors the
 * tag/VR/length framing the parser scans for; no full dataset needed.
 */
function buildDicomWithPixelSpacing(value: string): ArrayBuffer {
  const enc = new TextEncoder()
  const valueBytes = enc.encode(value.length % 2 === 0 ? value : value + ' ') // even length (DS pad)
  // preamble(128) + DICM(4) + group(2)+element(2)+VR(2)+len(2)+value
  const total = 128 + 4 + 2 + 2 + 2 + 2 + valueBytes.length
  const buf = new ArrayBuffer(total)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  let off = 128
  bytes.set(enc.encode('DICM'), off)
  off += 4
  // tag (0028,0030) little-endian: group then element, each 16-bit LE
  view.setUint16(off, 0x0028, true); off += 2
  view.setUint16(off, 0x0030, true); off += 2
  bytes.set(enc.encode('DS'), off); off += 2 // VR
  view.setUint16(off, valueBytes.length, true); off += 2 // length
  bytes.set(valueBytes, off)
  return buf
}

describe('DICOM MIME detection (P1-9)', () => {
  test('recognises application/dicom', () => {
    expect(isDicomMimeType(DICOM_MIME_TYPE)).toBe(true)
    expect(isDicomMimeType('application/dicom')).toBe(true)
  })

  test('does not flag ordinary image mime types', () => {
    expect(isDicomMimeType('image/jpeg')).toBe(false)
    expect(isDicomMimeType('image/png')).toBe(false)
    expect(isDicomMimeType('')).toBe(false)
  })
})

describe('parseDicomPixelSpacing (P1-9)', () => {
  test('extracts the row spacing from PixelSpacing (0028,0030)', () => {
    const buf = buildDicomWithPixelSpacing('0.20\\0.20')
    const result = parseDicomPixelSpacing(buf)
    expect(result).not.toBeNull()
    expect(result!.pixelSpacingMm).toBeCloseTo(0.2, 5)
    expect(result!.rowSpacingMm).toBeCloseTo(0.2, 5)
    expect(result!.colSpacingMm).toBeCloseTo(0.2, 5)
  })

  test('handles anisotropic spacing (row != col)', () => {
    const buf = buildDicomWithPixelSpacing('0.30\\0.25')
    const result = parseDicomPixelSpacing(buf)!
    expect(result.rowSpacingMm).toBeCloseTo(0.3, 5)
    expect(result.colSpacingMm).toBeCloseTo(0.25, 5)
  })

  test('returns null when no DICM magic is present (not a DICOM file)', () => {
    const buf = new TextEncoder().encode('this is not dicom').buffer
    expect(parseDicomPixelSpacing(buf)).toBeNull()
  })

  test('returns null when PixelSpacing is absent', () => {
    const enc = new TextEncoder()
    const buf = new ArrayBuffer(128 + 4)
    new Uint8Array(buf).set(enc.encode('DICM'), 128)
    expect(parseDicomPixelSpacing(buf)).toBeNull()
  })

  test('returns null for an implausible spacing (guards bad parses)', () => {
    const buf = buildDicomWithPixelSpacing('999\\999')
    expect(parseDicomPixelSpacing(buf)).toBeNull()
  })
})
