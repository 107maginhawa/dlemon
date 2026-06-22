/**
 * perio-erasure.facade.ts (PR-B / V-DG-002, G3c)
 *
 * Facade exposing dental-perio free-text PHI scrub to the `erasure` module
 * (Phase 10 boundary lint). Scrubs the DATA_GOVERNANCE §3.1(a) perio free-text:
 *   - dental_perio_chart.notes          → null (by patientId)
 *   - dental_perio_tooth_reading.notes  → null (by chartId, scoped to the subject)
 * The coded perio readings (depths/BOP/CAL/diagnosis) are retained. Idempotent.
 */

import { eq, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalPerioCharts } from './perio-chart.schema';
import { dentalPerioToothReadings } from './perio-reading.schema';
import { patients } from '../../patient/repos/patient.schema';

export async function anonymizePerioNotesByPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<number> {
  const pts = await db.select({ id: patients.id }).from(patients).where(eq(patients.person, personId));
  if (pts.length === 0) return 0;
  const patientIds = pts.map((p) => p.id);
  const now = new Date();

  const charts = await db
    .update(dentalPerioCharts)
    .set({ notes: null, updatedAt: now })
    .where(inArray(dentalPerioCharts.patientId, patientIds))
    .returning({ id: dentalPerioCharts.id });
  let count = charts.length;
  const chartIds = charts.map((c) => c.id);

  if (chartIds.length > 0) {
    const readings = await db
      .update(dentalPerioToothReadings)
      .set({ notes: null, updatedAt: now })
      .where(inArray(dentalPerioToothReadings.chartId, chartIds))
      .returning({ id: dentalPerioToothReadings.id });
    count += readings.length;
  }

  return count;
}
