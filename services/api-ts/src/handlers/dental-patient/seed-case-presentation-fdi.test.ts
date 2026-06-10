/**
 * Regression guard: the case-presentation demo seed must use FDI tooth numbers.
 *
 * The whole app (odontogram, seed-demo, chart layers) is FDI (ISO 3950: 11–18,
 * 21–28, 31–38, 41–48). The case-presentation supplement once used Universal /
 * American numbering (1–32), which silently orphaned teeth on the FDI chart —
 * e.g. a plan listing a crown on "#30" rendered nothing on the odontogram (there
 * is no FDI #30), so the flagship patient's cumulative chart dropped proposed
 * teeth the treatment plan still listed (a chart↔plan coherence gap).
 *
 * This pins every seeded case-presentation tooth number to a valid FDI number so
 * the chart can always render what the plan proposes.
 */
import { describe, test, expect } from 'bun:test';
import { cpPlanSpecs } from '../../../scripts/seed-shared';
import { isValidFdiToothNumber } from '@/handlers/dental-perio/utils/perio-validation';

describe('case-presentation seed tooth numbering', () => {
  test('every seeded case-presentation treatment uses a valid FDI tooth number', () => {
    const invalid: Array<{ plan: string; tooth: number; desc: string }> = [];
    for (const spec of cpPlanSpecs) {
      for (const item of spec.items) {
        if (!isValidFdiToothNumber(item.tooth)) {
          invalid.push({ plan: spec.key, tooth: item.tooth, desc: item.desc });
        }
      }
    }
    expect(invalid).toEqual([]);
  });
});
