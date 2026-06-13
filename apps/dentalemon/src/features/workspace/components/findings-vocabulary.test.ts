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
});
