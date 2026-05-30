/**
 * TreatmentPlanRepository — link + recompute (TR-P1-08 / TP-BR-005)
 *
 * DB-backed tests for item linkage and plan-completion derivation.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { TreatmentPlanRepository } from './treatment-plan.repo';
import { dentalTreatmentPlans } from './treatment-plan.schema';
import { dentalTreatments } from '../../dental-visit/repos/treatment.schema';
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

async function seedTreatment(status: string, planId?: string | null) {
  const [t] = await db.insert(dentalTreatments).values({
    visitId: VISIT, patientId: PATIENT, cdtCode: 'D2140', description: 'Amalgam',
    priceCents: 10000, status: status as any, carriedOver: false,
    ...(planId !== undefined ? { treatmentPlanId: planId } : {}),
  }).returning();
  return t!;
}

describe('TreatmentPlanRepository — link + recompute', () => {
  let repo: TreatmentPlanRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new TreatmentPlanRepository(db);
    await seedClinicalChain(db, { visits: 1 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('linkPendingTreatments claims only diagnosed/planned, unlinked rows', async () => {
    const plan = await seedPlan('approved');
    await seedTreatment('diagnosed');
    await seedTreatment('planned');
    await seedTreatment('performed'); // pre-existing done work — not part of the plan

    const linked = await repo.linkPendingTreatments(plan.id, PATIENT);
    expect(linked).toBe(2);
  });

  test('recompute: partially_completed when one of two linked items is done (TP-BR-005)', async () => {
    const plan = await seedPlan('approved');
    await seedTreatment('performed', plan.id);
    await seedTreatment('planned', plan.id);

    const updated = await repo.recomputeStatus(plan.id, PATIENT);
    expect(updated?.status).toBe('partially_completed');
  });

  test('recompute: completed only when all linked items are done', async () => {
    const plan = await seedPlan('approved');
    await seedTreatment('performed', plan.id);
    await seedTreatment('verified', plan.id);

    const updated = await repo.recomputeStatus(plan.id, PATIENT);
    expect(updated?.status).toBe('completed');
  });

  test('recompute: stays approved with no done items', async () => {
    const plan = await seedPlan('approved');
    await seedTreatment('planned', plan.id);

    const updated = await repo.recomputeStatus(plan.id, PATIENT);
    expect(updated?.status).toBe('approved');
  });

  test('recomputeForTreatment recomputes the parent plan', async () => {
    const plan = await seedPlan('approved');
    const t1 = await seedTreatment('performed', plan.id);
    await seedTreatment('verified', plan.id);

    await repo.recomputeForTreatment(t1.id);
    const reloaded = await repo.findOneById(plan.id, PATIENT);
    expect(reloaded?.status).toBe('completed');
  });

  test('createApproval persists a CR-05 record', async () => {
    const plan = await seedPlan('approved');
    const approval = await repo.createApproval({
      treatmentPlanId: plan.id,
      approvedByPersonId: CHAIN_IDS.PERSON_1,
      method: 'signature',
      signatureData: 'data:image/png;base64,xyz',
    });
    expect(approval.id).toBeTruthy();
    expect(approval.method).toBe('signature');

    const all = await repo.findApprovalsByPlanId(plan.id);
    expect(all).toHaveLength(1);
  });
});
