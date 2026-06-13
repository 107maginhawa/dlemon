/**
 * seed-shared.ts — small, dependency-light helpers + data shared by the demo
 * seed scripts and their tests.
 *
 * Kept separate from seed-supplement.ts so a unit test can import the
 * case-presentation specs (cpPlanSpecs) without pulling the full seed runtime
 * (DB pool, every schema) into the typecheck/test graph.
 */
import type { TreatmentPlanStatus } from '@/handlers/dental-patient/repos/treatment-plan.schema';

// ─── Deterministic UUID helper (idempotent ids from a stable seed string) ────
// Builds an RFC-4122-shaped v4 UUID deterministically from a label so re-runs
// produce the same id and .onConflictDoNothing() de-dupes on the PK.
export function detUuid(seed: string): string {
  let h = 2166136261 >>> 0;
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    h ^= seed.charCodeAt((i * 7 + 13) % seed.length) || (i + 1);
    h = Math.imul(h, 16777619) >>> 0;
    bytes.push((h >>> ((i % 4) * 8)) & 0xff);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

// ─── Case-presentation plan specs ────────────────────────────────────────────
// Tooth numbers MUST be FDI (ISO 3950: 11–18, 21–28, 31–38, 41–48) to match the
// rest of the app and the odontogram. Universal/American numbers (1–32) silently
// orphan teeth on the FDI chart (there is no #19/#30), breaking chart↔plan
// coherence for the flagship demo. Guarded by seed-case-presentation-fdi.test.ts.
export type CpItem = { tooth: number; cdt: string; desc: string; priceCents: number; phase?: string; status: 'planned' | 'diagnosed'; optionGroupId?: string; recommended?: boolean };
export type CpPlanSpec = {
  key: string; patientIdx: number; status: TreatmentPlanStatus;
  decision?: 'accepted' | 'rejected'; rejectionReason?: string; withPresentation: boolean;
  items: CpItem[];
};

export const cpPlanSpecs: CpPlanSpec[] = [
  {
    key: 'cp-presented', patientIdx: 0, status: 'presented', withPresentation: true,
    // FDI teeth chosen to not collide with this patient's hand-built clinical
    // demo (planned #14, completed #24, declined #46) so each proposed item is
    // a distinct, renderable tooth on the cumulative chart.
    items: [
      { tooth: 25, cdt: 'D2391', desc: 'Resin composite — 1 surface', priceCents: 500000, phase: 'disease_control', status: 'planned' },
      { tooth: 27, cdt: 'D2740', desc: 'Crown — porcelain/ceramic', priceCents: 2000000, phase: 'definitive', status: 'planned' },
      // Alternate option group (implant recommended vs bridge), unphased.
      { tooth: 37, cdt: 'D6010', desc: 'Implant body — Option A (recommended)', priceCents: 4000000, status: 'diagnosed', optionGroupId: detUuid('cp-optgroup:presented'), recommended: true },
      { tooth: 37, cdt: 'D6240', desc: 'Bridge — Option B', priceCents: 3000000, status: 'diagnosed', optionGroupId: detUuid('cp-optgroup:presented'), recommended: false },
    ],
  },
  {
    key: 'cp-accepted', patientIdx: 1, status: 'approved', decision: 'accepted', withPresentation: true,
    items: [
      { tooth: 16, cdt: 'D2750', desc: 'Crown — porcelain fused to metal', priceCents: 1800000, phase: 'definitive', status: 'planned' },
      { tooth: 37, cdt: 'D2392', desc: 'Resin composite — 2 surfaces', priceCents: 600000, phase: 'disease_control', status: 'planned' },
    ],
  },
  {
    key: 'cp-rejected', patientIdx: 2, status: 'rejected', decision: 'rejected',
    rejectionReason: 'Patient wants to defer the implant and seek a second opinion.', withPresentation: true,
    items: [
      { tooth: 47, cdt: 'D6010', desc: 'Implant body placement', priceCents: 4200000, phase: 'definitive', status: 'diagnosed' },
    ],
  },
  {
    key: 'cp-draft', patientIdx: 3, status: 'draft', withPresentation: false,
    items: [
      { tooth: 14, cdt: 'D2391', desc: 'Resin composite — 1 surface', priceCents: 500000, phase: 'disease_control', status: 'planned' },
    ],
  },
];
