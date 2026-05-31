/**
 * Item-level treatment-plan completion (TR-P1-08 / WF-048/049/050)
 *
 * The plan-LEVEL FSM (draft→presented→approved→partially_completed→completed) and
 * the static recompute snapshots are covered in treatment-plan-completion.test.ts.
 *
 * This suite closes the ITEM-level granularity gap: a treatment-plan's "items" are
 * individual `dental_treatment` rows linked via `treatmentPlanId`, each carrying its
 * own status. Completing one item is a per-item status transition; only when ALL
 * active items are done does the parent plan complete. These tests drive a realistic
 * multi-item progression through the SAME trigger the production handler uses
 * (`recomputeForTreatment`, called by updateDentalTreatment), asserting:
 *
 *   WF-048  completing ONE item updates only that item — siblings are untouched
 *   WF-049  the plan aggregate reflects PARTIAL completion while items remain
 *   WF-050  completing the final remaining item permits/transitions plan completion
 *
 * DB-backed via a rolled-back test transaction (no mocks).
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { TreatmentPlanRepository } from './treatment-plan.repo';
import { dentalTreatmentPlans } from './treatment-plan.schema';
import { dentalTreatments } from '../../dental-visit/repos/treatment.schema';
import { TreatmentRepository } from '../../dental-visit/repos/treatment.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

let db: NodePgDatabase;
const PATIENT = CHAIN_IDS.PATIENT_1;
const VISIT = CHAIN_IDS.VISIT_1;

async function seedPlan(status = 'approved') {
  const [p] = await db.insert(dentalTreatmentPlans).values({
    patientId: PATIENT, providerId: CHAIN_IDS.MEMBERSHIP_1, status: status as any,
    totalEstimateCents: 0,
  }).returning();
  return p!;
}

async function seedItem(status: string, planId: string, cdtCode = 'D2140') {
  const [t] = await db.insert(dentalTreatments).values({
    visitId: VISIT, patientId: PATIENT, cdtCode, description: cdtCode,
    priceCents: 10000, status: status as any, carriedOver: false,
    treatmentPlanId: planId,
  }).returning();
  return t!;
}

async function itemStatus(id: string): Promise<string> {
  const [row] = await db
    .select({ status: dentalTreatments.status })
    .from(dentalTreatments)
    .where(eq(dentalTreatments.id, id));
  return row!.status as string;
}

describe('Treatment-plan ITEM-level completion (TR-P1-08 / WF-048/049/050)', () => {
  let planRepo: TreatmentPlanRepository;
  let txRepo: TreatmentRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    planRepo = new TreatmentPlanRepository(db);
    txRepo = new TreatmentRepository(db);
    await seedClinicalChain(db, { visits: 1 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('WF-048: completing one item transitions only that item; siblings untouched', async () => {
    const plan = await seedPlan('approved');
    const itemA = await seedItem('planned', plan.id, 'D2140');
    const itemB = await seedItem('planned', plan.id, 'D2150');

    // Complete ONLY item A (the per-item status transition planned→performed).
    await txRepo.update(itemA.id, { status: 'performed' });
    await planRepo.recomputeForTreatment(itemA.id);

    expect(await itemStatus(itemA.id)).toBe('performed');
    // Sibling must be completely unaffected by completing item A.
    expect(await itemStatus(itemB.id)).toBe('planned');
  });

  test('WF-049: plan aggregate reflects PARTIAL completion while items remain', async () => {
    const plan = await seedPlan('approved');
    const itemA = await seedItem('planned', plan.id, 'D2140');
    await seedItem('planned', plan.id, 'D2150'); // remains incomplete

    await txRepo.update(itemA.id, { status: 'performed' });
    await planRepo.recomputeForTreatment(itemA.id);

    const reloaded = await planRepo.findOneById(plan.id, PATIENT);
    expect(reloaded?.status).toBe('partially_completed');
  });

  test('WF-050: completing the final remaining item permits plan completion', async () => {
    const plan = await seedPlan('approved');
    const itemA = await seedItem('planned', plan.id, 'D2140');
    const itemB = await seedItem('planned', plan.id, 'D2150');

    // Step 1 — finish item A: plan goes partial.
    await txRepo.update(itemA.id, { status: 'performed' });
    await planRepo.recomputeForTreatment(itemA.id);
    expect((await planRepo.findOneById(plan.id, PATIENT))?.status).toBe('partially_completed');

    // Step 2 — finish the LAST remaining item B: plan now completes.
    await txRepo.update(itemB.id, { status: 'performed' });
    await planRepo.recomputeForTreatment(itemB.id);

    const done = await planRepo.findOneById(plan.id, PATIENT);
    expect(done?.status).toBe('completed');
    // Both items are individually marked done.
    expect(await itemStatus(itemA.id)).toBe('performed');
    expect(await itemStatus(itemB.id)).toBe('performed');
  });

  test('WF-050b: a declined item is excluded from the denominator — remaining done items complete the plan', async () => {
    const plan = await seedPlan('approved');
    const itemA = await seedItem('planned', plan.id, 'D2140');
    const itemB = await seedItem('planned', plan.id, 'D2150');

    // Item A performed; item B declined (drops out of the completion math, TP-BR-005).
    await txRepo.update(itemA.id, { status: 'performed' });
    await planRepo.recomputeForTreatment(itemA.id);
    await txRepo.update(itemB.id, { status: 'declined' });
    await planRepo.recomputeForTreatment(itemB.id);

    const done = await planRepo.findOneById(plan.id, PATIENT);
    expect(done?.status).toBe('completed');
    expect(await itemStatus(itemB.id)).toBe('declined');
  });
});
