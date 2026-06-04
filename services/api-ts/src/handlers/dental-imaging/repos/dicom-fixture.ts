/**
 * Synthetic DICOM fixture builder (test support, P2-7 / P1-9).
 *
 * Constructs a minimal but VALID explicit-VR-little-endian DICOM byte buffer
 * (128-byte preamble + "DICM" magic + file-meta group with TransferSyntaxUID
 * + the volume-descriptor dataset tags) so tests can exercise the real
 * `dicom-parser` path without committing a binary .dcm blob. Exported from the
 * repos dir so both backend unit tests and the integration suite can reuse it.
 */

function le16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}
function le32(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}
function padEven(s: string): string {
  return s.length % 2 === 1 ? s + '\0' : s;
}
function strBytes(s: string): number[] {
  return [...padEven(s)].map((c) => c.charCodeAt(0));
}

// Short-form explicit VRs use a 2-byte length; long VRs (OB/OW/UN/SQ/UT) use
// 2 reserved bytes + 4-byte length. The fixture only emits short VRs.
const SHORT_VR = new Set([
  'AE', 'AS', 'AT', 'CS', 'DA', 'DS', 'DT', 'FL', 'FD', 'IS', 'LO', 'LT', 'PN',
  'SH', 'SL', 'SS', 'ST', 'TM', 'UI', 'UL', 'US',
]);

function elem(group: number, el: number, vr: string, value: number[]): number[] {
  const out = [...le16(group), ...le16(el), vr.charCodeAt(0), vr.charCodeAt(1)];
  if (SHORT_VR.has(vr)) out.push(...le16(value.length));
  else out.push(0, 0, ...le32(value.length));
  return [...out, ...value];
}

export interface DicomFixtureOptions {
  modality?: string;
  manufacturer?: string;
  sliceThickness?: string;
  studyUid?: string;
  seriesUid?: string;
  numberOfFrames?: string;
  rows?: number;
  columns?: number;
  /** PixelSpacing as DICOM DS "row\\col" (mm). */
  pixelSpacing?: string;
}

/** Build a valid synthetic multi-frame CT/CBCT DICOM buffer. */
export function buildSyntheticDicom(opts: DicomFixtureOptions = {}): Uint8Array {
  const o = {
    modality: 'CT',
    manufacturer: 'TestVendor',
    sliceThickness: '0.30',
    studyUid: '1.2.3.4.5',
    seriesUid: '1.2.3.4.6',
    numberOfFrames: '128',
    rows: 512,
    columns: 512,
    pixelSpacing: '0.25\\0.25',
    ...opts,
  };

  // File-meta group (always explicit VR LE). TransferSyntaxUID = Explicit VR LE.
  const tsuid = '1.2.840.10008.1.2.1';
  const sopClass = '1.2.840.10008.5.1.4.1.1.2'; // CT Image Storage
  const metaElems = [
    ...elem(0x0002, 0x0002, 'UI', strBytes(sopClass)),
    ...elem(0x0002, 0x0003, 'UI', strBytes('1.2.3.4.7')),
    ...elem(0x0002, 0x0010, 'UI', strBytes(tsuid)),
  ];
  const metaGroupLen = elem(0x0002, 0x0000, 'UL', le32(metaElems.length));

  const dataset = [
    ...elem(0x0008, 0x0060, 'CS', strBytes(o.modality)),
    ...elem(0x0008, 0x0070, 'LO', strBytes(o.manufacturer)),
    ...elem(0x0018, 0x0050, 'DS', strBytes(o.sliceThickness)),
    ...elem(0x0020, 0x000d, 'UI', strBytes(o.studyUid)),
    ...elem(0x0020, 0x000e, 'UI', strBytes(o.seriesUid)),
    ...elem(0x0028, 0x0008, 'IS', strBytes(o.numberOfFrames)),
    ...elem(0x0028, 0x0010, 'US', le16(o.rows)),
    ...elem(0x0028, 0x0011, 'US', le16(o.columns)),
    ...elem(0x0028, 0x0030, 'DS', strBytes(o.pixelSpacing)),
  ];

  const preamble = new Array(128).fill(0);
  const magic = strBytes('DICM');
  return new Uint8Array([...preamble, ...magic, ...metaGroupLen, ...metaElems, ...dataset]);
}
