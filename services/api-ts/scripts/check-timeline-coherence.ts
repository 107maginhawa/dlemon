/**
 * check-timeline-coherence — seed-coherence guard for the carousel timeline.
 *
 * For every patient + permanent tooth, asserts the invariants documented in
 * docs/product/CAROUSEL_TIMELINE.md §5:
 *
 *   I1  no disappearing teeth — once a tooth has a non-healthy snapshot, it must
 *       not go ABSENT on a later charted visit (the flicker bug).
 *   I2  Treated is sticky — once a tooth is `completed` as-of, later visits must keep
 *       it completed OR proposed (re-proposal) OR terminal; never silently dropped.
 *   I3  no active disease after a tooth is gone — after missing/extracted, no later
 *       snapshot may chart caries/watchlist/fractured (restorations are allowed).
 *
 * Reuses the real repos + deriveLayerSetsAsOf/resolveTerminalTeeth (no duplicated
 * precedence) and reads RAW per-visit snapshots via chartRepo.findByVisit — NOT the
 * per-tooth ledger, which synthesises states and would mask snapshot gaps. Strictly
 * read-only. Exits non-zero with a per-violation report so QA can prove the data is
 * coherent and any remaining surprise is logic, not data.
 *
 *   bun scripts/check-timeline-coherence.ts
 */
import { sql } from 'drizzle-orm';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { DentalChartRepository } from '@/handlers/dental-visit/repos/dental-chart.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { deriveLayerSetsAsOf, resolveTerminalTeeth, type AsOfTreatment } from '@/handlers/dental-visit/chart/chart-export';
import type { ToothChartState } from '@/handlers/dental-visit/repos/dental-chart.schema';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase';

const TERMINAL = new Set(['missing', 'extracted']);
const ACTIVE_DISEASE = new Set(['caries', 'watchlist', 'fractured']);

// FDI permanent dentition only: quadrants 1-4 (11-48). Primary teeth (quadrants 5-8)
// legitimately exfoliate, which would false-trip I1/I3 — out of scope (see doc §5).
const isPermanent = (n: number) => n >= 11 && n <= 48 && Math.floor(n / 10) <= 4;

interface Violation {
  patient: string;
  tooth: number;
  invariant: 'I1' | 'I2' | 'I3';
  detail: string;
}

async function main() {
  const db: DatabaseInstance = createDatabase({ url: DATABASE_URL });
  const visitRepo = new VisitRepository(db);
  const chartRepo = new DentalChartRepository(db);
  const treatmentRepo = new TreatmentRepository(db);

  const patientsRes = await db.execute(sql`
    SELECT pat.id, (per.first_name || ' ' || per.last_name) AS name
    FROM patient pat JOIN person per ON per.id = pat.person_id
  `);
  const patients = patientsRes.rows as Array<{ id: string; name: string }>;

  const violations: Violation[] = [];
  let patientsChecked = 0;
  let teethChecked = 0;

  for (const patient of patients) {
    const all = await visitRepo.findMany({ patientId: patient.id });
    const charted = all
      .filter(v => v.status === 'completed' || v.status === 'locked' || v.status === 'active')
      .map(v => ({ ...v, date: v.completedAt ?? v.createdAt }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (charted.length === 0) continue;
    patientsChecked++;

    const visitDateById = new Map<string, Date>(charted.map(v => [v.id, v.date]));

    // Prefetch each visit's raw chart once (avoids re-querying per tooth).
    const teethByVisit = new Map<string, ToothChartState[]>();
    for (const v of charted) {
      const chart = await chartRepo.findByVisit(v.id);
      teethByVisit.set(v.id, chart?.teeth ?? []);
    }

    const allTreatments = await treatmentRepo.findByPatientCharted(patient.id);
    const asOfInput: AsOfTreatment[] = allTreatments.map(t => ({
      toothNumber: t.toothNumber ?? null,
      status: t.status,
      performedAt: t.performedAt ?? null,
      visitId: t.visitId,
      sourceVisitId: t.sourceVisitId ?? null,
      carriedOver: t.carriedOver ?? false,
    }));

    // Tooth universe: every permanent tooth that appears in any snapshot or treatment.
    const toothSet = new Set<number>();
    for (const teeth of teethByVisit.values()) for (const t of teeth) if (isPermanent(t.toothNumber)) toothSet.add(t.toothNumber);
    for (const t of allTreatments) if (t.toothNumber != null && isPermanent(t.toothNumber)) toothSet.add(t.toothNumber);

    for (const tooth of toothSet) {
      teethChecked++;
      let seenNonHealthy = false;        // I1: tooth currently carries a standing state
      let lastSeenDate: Date | null = null;
      let i1Reported = false;            // report the first gap per tooth, not every absent visit
      let terminalSince: Date | null = null; // I3
      let completedSince = false;        // I2

      for (const v of charted) {
        const dateStr = v.date.toISOString().slice(0, 10);
        const snapshot = teethByVisit.get(v.id)!.find(t => t.toothNumber === tooth);
        const { proposed, completed } = deriveLayerSetsAsOf(asOfInput, v.date, visitDateById);
        const terminalNow = resolveTerminalTeeth(teethByVisit.get(v.id)!).has(tooth);

        // ── I1: disappearance ──────────────────────────────────────────────
        if (snapshot) {
          if (snapshot.state === 'healthy') {
            seenNonHealthy = false;      // explicit cure — absence allowed afterwards
          } else {
            seenNonHealthy = true;
            lastSeenDate = v.date;
          }
        } else if (seenNonHealthy && !i1Reported) {
          violations.push({
            patient: patient.name, tooth, invariant: 'I1',
            detail: `snapshot ABSENT on ${dateStr} after being charted on ${lastSeenDate?.toISOString().slice(0, 10)} (standing condition vanished — flicker)`,
          });
          i1Reported = true;
        }

        // ── I3: active disease after terminal ──────────────────────────────
        if (snapshot && TERMINAL.has(snapshot.state)) {
          terminalSince = terminalSince ?? v.date;
        } else if (terminalSince && snapshot && ACTIVE_DISEASE.has(snapshot.state)) {
          violations.push({
            patient: patient.name, tooth, invariant: 'I3',
            detail: `active disease '${snapshot.state}' charted on ${dateStr} after tooth went terminal on ${terminalSince.toISOString().slice(0, 10)}`,
          });
        }

        // ── I2: Treated stickiness ─────────────────────────────────────────
        if (completed.has(tooth)) {
          completedSince = true;
        } else if (completedSince && !proposed.has(tooth) && !terminalNow) {
          violations.push({
            patient: patient.name, tooth, invariant: 'I2',
            detail: `tooth left the completed (Treated) layer on ${dateStr} without a re-proposal (as-of dropped Treated)`,
          });
          completedSince = false; // report the transition once
        }
      }
    }
  }

  console.log(`\nTimeline coherence — ${patientsChecked} patients, ${teethChecked} permanent teeth checked`);
  console.log('═'.repeat(72));
  if (violations.length === 0) {
    console.log('✓ No violations. Demo data obeys I1/I2/I3 — any surprise is logic, not data.\n');
    process.exit(0);
  }

  const byInvariant = { I1: 0, I2: 0, I3: 0 };
  for (const v of violations) {
    byInvariant[v.invariant]++;
    console.log(`✗ [${v.invariant}] ${v.patient} — tooth #${v.tooth}: ${v.detail}`);
  }
  console.log('─'.repeat(72));
  console.log(`${violations.length} violation(s): I1=${byInvariant.I1} I2=${byInvariant.I2} I3=${byInvariant.I3}\n`);
  process.exit(1);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
