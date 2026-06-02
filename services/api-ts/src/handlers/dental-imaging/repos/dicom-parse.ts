/**
 * P1-9 — server-side DICOM tag parser.
 *
 * Pure-JS, Bun-compatible (Cornerstone's `dicom-parser`). Defensive: a malformed
 * or non-DICOM byte buffer throws a typed `DicomParseError` so callers can clean-
 * fail with NO half-written study row (P2-7 §8 clinical-safety / correctness).
 *
 * Parses the volume-descriptor tags needed for CBCT (plan §3 "Metadata & linkage"):
 *   Modality            (0008,0060)
 *   Manufacturer        (0008,0070)
 *   SliceThickness      (0018,0050)
 *   StudyInstanceUID    (0020,000D)
 *   SeriesInstanceUID   (0020,000E)
 *   NumberOfFrames      (0028,0008)
 *   Rows                (0028,0010)
 *   Columns             (0028,0011)
 *   PixelSpacing        (0028,0030)
 */

import dicomParser from 'dicom-parser';
import type { DicomMetadata } from './imaging.schema';

/** Plausible mm-per-pixel window for a DICOM-tag-derived spacing value (matches createImagingStudy). */
const DICOM_SPACING_MIN = 0.01;
const DICOM_SPACING_MAX = 2.0;

export class DicomParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DicomParseError';
  }
}

/** Structured result of a server-side DICOM parse. */
export interface ParsedDicom {
  metadata: DicomMetadata;
  /** Calibrated mm/px when PixelSpacing is present and plausible; else null. */
  pixelSpacingMm: number | null;
  sliceThicknessMm: number | null;
  frameCount: number | null;
  rows: number | null;
  columns: number | null;
  studyInstanceUid: string | null;
  seriesInstanceUid: string | null;
  modality: string | null;
  manufacturer: string | null;
  /**
   * A DICOM object is a VOLUME when it is multi-frame (NumberOfFrames > 1) or its
   * Modality is a 3-D cross-sectional modality (CT — CBCT is encoded as CT in DICOM).
   */
  isVolume: boolean;
}

function plausibleSpacing(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= DICOM_SPACING_MIN && n <= DICOM_SPACING_MAX
    ? n
    : null;
}

/**
 * Parse a DICOM byte buffer into structured volume metadata. Throws
 * `DicomParseError` on a malformed / non-DICOM payload (no partial result).
 */
export function parseDicomBuffer(bytes: Uint8Array, fileName?: string): ParsedDicom {
  let ds: ReturnType<typeof dicomParser.parseDicom>;
  try {
    ds = dicomParser.parseDicom(bytes);
  } catch (err) {
    throw new DicomParseError(
      `Not a parseable DICOM object: ${(err as Error)?.message ?? 'unknown error'}`,
    );
  }

  const modality = ds.string('x00080060') ?? null;
  const manufacturer = ds.string('x00080070') ?? null;
  const sliceThicknessMm = nullableFloat(ds.floatString('x00180050'));
  const studyInstanceUid = ds.string('x0020000d') ?? null;
  const seriesInstanceUid = ds.string('x0020000e') ?? null;
  const frameCount = nullableInt(ds.intString('x00280008'));
  const rows = safeUint16(ds, 'x00280010');
  const columns = safeUint16(ds, 'x00280011');

  // PixelSpacing is a DS pair "row\col" (mm). Use the first (row spacing) as the
  // calibration scalar; both axes go into spacing[x, y].
  const pixelSpacingRaw = ds.string('x00280030');
  let spacingX: number | null = null;
  let spacingY: number | null = null;
  if (pixelSpacingRaw) {
    const parts = pixelSpacingRaw.split('\\').map((p) => Number.parseFloat(p));
    spacingY = Number.isFinite(parts[0]!) ? parts[0]! : null; // row spacing (Y)
    spacingX = Number.isFinite(parts[1]!) ? parts[1]! : spacingY; // col spacing (X)
  }
  const pixelSpacingMm = plausibleSpacing(spacingX ?? spacingY ?? undefined);

  const frames = frameCount ?? 1;
  const isVolume = frames > 1 || modality === 'CT';

  const fovMm: [number | null, number | null] = [
    columns != null && spacingX != null ? columns * spacingX : null,
    rows != null && spacingY != null ? rows * spacingY : null,
  ];

  const metadata: DicomMetadata = {
    ...(fileName ? { fileName } : {}),
    mimeType: 'application/dicom',
    isDicom: true,
    ...(pixelSpacingMm != null
      ? { pixelSpacingMm, calibrationMethod: 'dicom_tag' as const }
      : {}),
    ...(modality ? { modality } : {}),
    ...(manufacturer ? { manufacturer } : {}),
    ...(rows != null ? { rows } : {}),
    ...(columns != null ? { columns } : {}),
    ...(frameCount != null ? { frameCount } : {}),
    spacing: [spacingX, spacingY, sliceThicknessMm],
    ...(studyInstanceUid ? { studyInstanceUid } : {}),
    ...(seriesInstanceUid ? { seriesInstanceUid } : {}),
    fovMm,
  };

  return {
    metadata,
    pixelSpacingMm,
    sliceThicknessMm,
    frameCount,
    rows,
    columns,
    studyInstanceUid,
    seriesInstanceUid,
    modality,
    manufacturer,
    isVolume,
  };
}

function nullableFloat(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function nullableInt(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
}

function safeUint16(ds: ReturnType<typeof dicomParser.parseDicom>, tag: string): number | null {
  try {
    const v = ds.uint16(tag);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}
