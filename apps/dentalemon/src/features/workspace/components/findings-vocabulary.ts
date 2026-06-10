/**
 * findings-vocabulary — the curated v1 clinical findings vocabulary (P0-C).
 *
 * Mirrors the backend `ConditionCode` enum. Keeps `state` (the odontogram visual
 * layer) separate from structured diagnoses so common findings don't collapse
 * into generic notes. `other` requires a free-text note.
 */
import type { ConditionCode } from '@monobase/sdk-ts/generated';

export interface FindingVocabEntry {
  code: ConditionCode;
  label: string;
  group: string;
}

export const FINDINGS_VOCABULARY: readonly FindingVocabEntry[] = [
  { code: 'caries', label: 'Caries', group: 'Hard tissue' },
  { code: 'fracture_crack', label: 'Fracture / crack', group: 'Hard tissue' },
  { code: 'wear_erosion', label: 'Wear / erosion', group: 'Hard tissue' },
  { code: 'retained_root', label: 'Retained root', group: 'Hard tissue' },
  { code: 'developmental_anomaly', label: 'Developmental anomaly', group: 'Hard tissue' },
  { code: 'sensitive_dentin', label: 'Sensitive dentin', group: 'Symptom' },
  { code: 'abscess', label: 'Abscess', group: 'Endo / Perio' },
  { code: 'calculus', label: 'Calculus', group: 'Perio' },
  { code: 'gingival_recession', label: 'Gingival recession', group: 'Perio' },
  { code: 'impacted_unerupted', label: 'Impacted / unerupted', group: 'Eruption' },
  { code: 'other', label: 'Other (note required)', group: 'Other' },
] as const;

/** Codes that require a free-text note before they can be saved. */
export const NOTE_REQUIRED_CODES = new Set<ConditionCode>(['other']);

export function findingLabel(code: ConditionCode): string {
  return FINDINGS_VOCABULARY.find((e) => e.code === code)?.label ?? code;
}

/** Group the vocabulary for a sectioned picker (stable order). */
export function findingsByGroup(): Array<{ group: string; entries: FindingVocabEntry[] }> {
  const order: string[] = [];
  const map = new Map<string, FindingVocabEntry[]>();
  for (const e of FINDINGS_VOCABULARY) {
    if (!map.has(e.group)) { map.set(e.group, []); order.push(e.group); }
    map.get(e.group)!.push(e);
  }
  return order.map((group) => ({ group, entries: map.get(group)! }));
}
