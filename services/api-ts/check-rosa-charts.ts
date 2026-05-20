import { db } from './src/core/db';
import { dentalCharts } from './src/handlers/dental-visit/repos/dental-chart.schema';
import { dentalVisits } from './src/handlers/dental-visit/repos/visit.schema';
import { eq, inArray } from 'drizzle-orm';

const visits = await db.select({id: dentalVisits.id, status: dentalVisits.status, activatedAt: dentalVisits.activatedAt})
  .from(dentalVisits)
  .where(eq(dentalVisits.patientId, 'd1000000-0000-1000-8000-000000000002'));

console.log('VISITS:', JSON.stringify(visits.map(v => ({id: v.id.substring(0,8), status: v.status, activatedAt: (v.activatedAt as any)?.toISOString?.()?.substring(0,10)}))));

if (visits.length > 0) {
  const charts = await db.select({visitId: dentalCharts.visitId, teeth: dentalCharts.teeth})
    .from(dentalCharts)
    .where(inArray(dentalCharts.visitId, visits.map(v => v.id)));

  for (const c of charts) {
    const teeth = c.teeth as Array<{toothNumber: number; state: string}>;
    const colored = teeth.filter(t => t.state !== 'healthy');
    console.log('CHART:', c.visitId.substring(0,8), '→', JSON.stringify(colored.map(t => ({n: t.toothNumber, s: t.state}))));
  }
}
process.exit(0);
