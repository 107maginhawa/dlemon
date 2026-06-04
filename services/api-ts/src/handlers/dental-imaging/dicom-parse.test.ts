/**
 * P1-9 server-side DICOM parser unit tests.
 *
 * Uses the synthetic fixture builder (no committed binary .dcm). Verifies the
 * volume-descriptor tags are parsed, calibration provenance is derived, and a
 * malformed / non-DICOM payload clean-fails with DicomParseError (no partial result).
 */

import { describe, test, expect } from 'bun:test';
import { parseDicomBuffer, DicomParseError } from './repos/dicom-parse';
import { buildSyntheticDicom } from './repos/dicom-fixture';

describe('parseDicomBuffer', () => {
  test('parses all volume-descriptor tags from a valid CBCT DICOM', () => {
    const buf = buildSyntheticDicom();
    const parsed = parseDicomBuffer(buf, 'cbct.dcm');

    expect(parsed.modality).toBe('CT');
    expect(parsed.manufacturer).toBe('TestVendor');
    expect(parsed.sliceThicknessMm).toBeCloseTo(0.3, 5);
    expect(parsed.studyInstanceUid).toBe('1.2.3.4.5');
    expect(parsed.seriesInstanceUid).toBe('1.2.3.4.6');
    expect(parsed.frameCount).toBe(128);
    expect(parsed.rows).toBe(512);
    expect(parsed.columns).toBe(512);
    expect(parsed.pixelSpacingMm).toBeCloseTo(0.25, 5);
    expect(parsed.isVolume).toBe(true);
  });

  test('populates typed dicomMetadata (spacing[x,y,z], fov, uids, calibrationMethod)', () => {
    const parsed = parseDicomBuffer(buildSyntheticDicom(), 'cbct.dcm');
    const m = parsed.metadata;
    expect(m.isDicom).toBe(true);
    expect(m.mimeType).toBe('application/dicom');
    expect(m.calibrationMethod).toBe('dicom_tag');
    expect(m.pixelSpacingMm).toBeCloseTo(0.25, 5);
    expect(m.spacing).toEqual([0.25, 0.25, 0.3]);
    expect(m.frameCount).toBe(128);
    expect(m.studyInstanceUid).toBe('1.2.3.4.5');
    expect(m.seriesInstanceUid).toBe('1.2.3.4.6');
    // FOV = dim * spacing = 512 * 0.25 = 128 mm
    expect(m.fovMm?.[0]).toBeCloseTo(128, 3);
    expect(m.fovMm?.[1]).toBeCloseTo(128, 3);
  });

  test('single-frame non-CT object is not a volume', () => {
    const parsed = parseDicomBuffer(
      buildSyntheticDicom({ modality: 'DX', numberOfFrames: '1' }),
      'pano.dcm',
    );
    expect(parsed.isVolume).toBe(false);
    expect(parsed.frameCount).toBe(1);
  });

  test('multi-frame object is a volume even for non-CT modality', () => {
    const parsed = parseDicomBuffer(
      buildSyntheticDicom({ modality: 'XA', numberOfFrames: '60' }),
      'series.dcm',
    );
    expect(parsed.isVolume).toBe(true);
  });

  test('implausible PixelSpacing is not adopted as calibration', () => {
    const parsed = parseDicomBuffer(
      buildSyntheticDicom({ pixelSpacing: '99\\99' }),
      'bad.dcm',
    );
    expect(parsed.pixelSpacingMm).toBeNull();
    expect(parsed.metadata.calibrationMethod).toBeUndefined();
  });

  test('malformed / non-DICOM payload throws DicomParseError (no partial result)', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => parseDicomBuffer(junk, 'junk.bin')).toThrow(DicomParseError);
  });

  test('a buffer missing the DICM magic clean-fails', () => {
    const buf = buildSyntheticDicom();
    // Corrupt the "DICM" magic at offset 128
    buf[128] = 0x00;
    expect(() => parseDicomBuffer(buf, 'corrupt.dcm')).toThrow(DicomParseError);
  });
});
