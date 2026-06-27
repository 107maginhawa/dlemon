import { describe, test, expect } from 'bun:test';
import { FINDINGS_VOCABULARY, NOTE_REQUIRED_CODES, findingLabel, findingsByGroup } from './findings-vocabulary';

describe('findings-vocabulary', () => {
  test('contains the approved v1 vocabulary (11 codes incl. other)', () => {
    const codes = FINDINGS_VOCABULARY.map((e) => e.code);
    expect(codes).toEqual([
      'caries', 'fracture_crack', 'wear_erosion', 'retained_root', 'developmental_anomaly',
      'sensitive_dentin', 'abscess', 'calculus', 'gingival_recession', 'impacted_unerupted', 'other',
    ]);
  });

  test("'other' requires a note", () => {
    expect(NOTE_REQUIRED_CODES.has('other')).toBe(true);
    expect(NOTE_REQUIRED_CODES.has('caries')).toBe(false);
  });

  test('findingLabel resolves a human label', () => {
    expect(findingLabel('gingival_recession')).toBe('Gingival recession');
  });

  test('findingsByGroup groups every code exactly once', () => {
    const groups = findingsByGroup();
    const flat = groups.flatMap((g) => g.entries.map((e) => e.code));
    expect(flat.sort()).toEqual(FINDINGS_VOCABULARY.map((e) => e.code).sort());
  });

  // Fix #4: treatments carry ICD-10 conditionCodes (K02.x = caries family) which are
  // NOT in the curated vocab. findingLabel must resolve a clean curated label for a
  // matched ICD prefix instead of surfacing the raw "K02.1" string.
  test('findingLabel maps ICD-10 caries codes (K02.x) to "Caries"', () => {
    expect(findingLabel('K02.0')).toBe('Caries');
    expect(findingLabel('K02.1')).toBe('Caries');
    expect(findingLabel('K02.9')).toBe('Caries');
  });

  test('findingLabel maps other dental ICD-10 ranges to curated labels', () => {
    expect(findingLabel('K03.0')).toBe('Wear / erosion');
    expect(findingLabel('K04.7')).toBe('Abscess');
  });

  // A truly-unknown code must NOT surface a raw ICD string — it falls back to a clean
  // humanised value, never something like "K99.9".
  test('findingLabel does not surface a raw ICD string for an unknown code', () => {
    expect(findingLabel('K99.9')).not.toBe('K99.9');
    expect(findingLabel('K99.9')).not.toMatch(/^[A-Z]\d/);
  });
});
