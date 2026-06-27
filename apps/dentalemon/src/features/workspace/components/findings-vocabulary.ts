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

/**
 * Small ICD-10 prefix → curated-finding map. Treatments carry ICD-10
 * `conditionCode`s (e.g. K02.1) that are NOT in the curated `ConditionCode` vocab,
 * so the breakdown panel would otherwise print a raw "K02.1". Cover only the dental
 * ranges that actually occur (K02–K08), not all of ICD-10 — keep it small.
 */
const ICD10_PREFIX_TO_FINDING: Record<string, ConditionCode> = {
  K02: 'caries', // dental caries
  K03: 'wear_erosion', // other diseases of hard tissues (attrition/erosion/abrasion)
  K04: 'abscess', // diseases of pulp & periapical tissues (incl. periapical abscess)
  K08: 'retained_root', // other disorders of teeth & supporting structures (retained root)
};

/** Matches a leading ICD-10 letter+2-digit prefix, e.g. "K02.1" → "K02". */
const ICD10_CODE = /^([A-Z]\d{2})/;

export function findingLabel(code: ConditionCode | string): string {
  const direct = FINDINGS_VOCABULARY.find((e) => e.code === code)?.label;
  if (direct) return direct;

  // Resolve an ICD-10 code to its curated finding label via the prefix map.
  const icdPrefix = ICD10_CODE.exec(code)?.[1];
  if (icdPrefix) {
    const mapped = ICD10_PREFIX_TO_FINDING[icdPrefix];
    if (mapped) return findingLabel(mapped);
    // Unknown ICD code — never surface the raw "K99.9"; fall back to a clean value.
    return 'Other';
  }

  return code;
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
