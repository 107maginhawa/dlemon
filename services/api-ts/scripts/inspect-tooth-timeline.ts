/**
 * inspect-tooth-timeline — read-only assessment tool for the cumulative carousel.
 *
 * For one patient + tooth, prints (per charted visit, date-ordered): visit status,
 * the tooth's per-visit chart snapshot state, its derived as-of lifecycle layer,
 * every treatment row touching the tooth, and whether the per-tooth ledger
 * (getToothHistory) emits an entry — so you can see at a glance why a tooth shows
 * or omits an entry on each card.
 *
 *   bun scripts/inspect-tooth-timeline.ts <patientId|patientName> <toothNumber>
 *
 * Reuses the real repos + deriveLayerSetsAsOf/resolveTerminalTeeth (no duplicated
 * precedence). Strictly read-only.
 */
import { sql } from 'drizzle-orm';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { DentalChartRepository } from '@/handlers/dental-visit/repos/dental-chart.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { deriveLayerSetsAsOf, resolveTerminalTeeth, type AsOfTreatment } from '@/handlers/dental-visit/chart/chart-export';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePatientId(db: DatabaseInstance, arg: string): Promise<string> {
  if (UUID_RE.test(arg)) return arg;
  // ponytail: name lookup is a raw join (no patient-by-name repo exists); read-only.
  const rows = await db.execute(sql`
    SELECT pat.id, per.first_name, per.last_name
    FROM patient pat JOIN person per ON per.id = pat.person_id
    WHERE (per.first_name || ' ' || per.last_name) ILIKE ${'%' + arg + '%'}
  `);
  const list = rows.rows as Array<{ id: string; first_name: string; last_name: string }>;
  if (list.length === 0) throw new Error(`No patient matching "${arg}"`);
  if (list.length > 1) {
    const names = list.map(r => `  ${r.id}  ${r.first_name} ${r.last_name}`).join('\n');
    throw new Error(`Ambiguous name "${arg}" — pass a patientId:\n${names}`);
  }
  return list[0]!.id;
}

async function main() {
  const [patientArg, toothArg] = process.argv.slice(2);
  if (!patientArg || !toothArg) {
    console.error('Usage: bun scripts/inspect-tooth-timeline.ts <patientId|patientName> <toothNumber>');
    process.exit(1);
  }
  const toothNumber = parseInt(toothArg, 10);
  if (isNaN(toothNumber)) throw new Error('toothNumber must be a number');

  const db = createDatabase({ url: DATABASE_URL });
  const visitRepo = new VisitRepository(db);
  const chartRepo = new DentalChartRepository(db);
  const treatmentRepo = new TreatmentRepository(db);

  const patientId = await resolvePatientId(db, patientArg);

  // Same visit set the timeline uses: active|completed|locked carry a date.
  const all = await visitRepo.findMany({ patientId });
  const charted = all
    .filter(v => v.status === 'completed' || v.status === 'locked' || v.status === 'active')
    .map(v => ({ ...v, date: v.completedAt ?? v.createdAt }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (charted.length === 0) {
    console.log(`Patient ${patientId}: no charted visits.`);
    return;
  }

  const visitDateById = new Map<string, Date>(charted.map(v => [v.id, v.date]));
  const allTreatments = await treatmentRepo.findByPatientCharted(patientId);
  const asOfInput: AsOfTreatment[] = allTreatments.map(t => ({
    toothNumber: t.toothNumber ?? null,
    status: t.status,
    performedAt: t.performedAt ?? null,
    visitId: t.visitId,
    sourceVisitId: t.sourceVisitId ?? null,
    carriedOver: t.carriedOver ?? false,
  }));

  console.log(`\nPatient ${patientId} — tooth #${toothNumber}\n${'═'.repeat(72)}`);

  for (const visit of charted) {
    const dateStr = visit.date.toISOString().slice(0, 10);
    const chart = await chartRepo.findByVisit(visit.id);
    const tooth = chart?.teeth.find(t => t.toothNumber === toothNumber);

    const visitTreatments = (await treatmentRepo.findByVisit(visit.id))
      .filter(t => t.toothNumber === toothNumber && t.status !== 'dismissed');

    // As-of lifecycle layer for this tooth as of this visit's date.
    const { proposed, completed, declined } = deriveLayerSetsAsOf(asOfInput, visit.date, visitDateById);
    const terminal = resolveTerminalTeeth(chart?.teeth ?? []);
    const asOfLayer = terminal.has(toothNumber) ? `terminal(${tooth?.state})`
      : proposed.has(toothNumber) ? 'proposed'
      : completed.has(toothNumber) ? 'completed'
      : declined.has(toothNumber) ? 'declined'
      : '—';

    // ponytail: mirrors getToothHistory.ts emit rule (treatment axis wins, else a
    // flagged tooth emits a finding). Keep in sync if that handler's rule changes.
    let emits: string;
    if (visitTreatments.length > 0) emits = `YES · ${visitTreatments.length} treatment`;
    else if (tooth && (tooth.state !== 'healthy' || tooth.conditionCode)) emits = 'YES · finding';
    else emits = 'no';

    const snap = tooth ? `${tooth.state}${tooth.conditionCode ? ` (${tooth.conditionCode})` : ''}` : 'ABSENT';
    console.log(
      `${dateStr}  [${visit.status.padEnd(9)}]  snapshot=${snap.padEnd(22)} ` +
      `asOf=${asOfLayer.padEnd(10)} ledger=${emits}`,
    );
    for (const t of visitTreatments) {
      console.log(
        `             treatment: ${t.cdtCode} status=${t.status}` +
        ` performedAt=${t.performedAt ? t.performedAt.toISOString().slice(0, 10) : '—'}` +
        ` carriedOver=${t.carriedOver ?? false}` +
        ` sourceVisit=${t.sourceVisitId ? t.sourceVisitId.slice(0, 8) : '—'}`,
      );
    }
  }
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
