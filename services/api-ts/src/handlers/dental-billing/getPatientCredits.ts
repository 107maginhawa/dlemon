/**
 * getPatientCredits — GET /dental/billing/patients/:patientId/credits
 *
 * Phase 4.1: the patient's credit ledger + available balance (sum of the signed
 * rows). Branch-authorized via the patient's preferred branch.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientBranchForBilling } from '@/handlers/patient/repos/patient-billing.facade';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import type { GetPatientCreditsParams } from '@/generated/openapi/validators';

export async function getPatientCredits(
  ctx: ValidatedContext<never, never, GetPatientCreditsParams>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { patientId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const patient = await getPatientBranchForBilling(db, patientId);
  if (!patient) throw new NotFoundError('Patient');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // Credits are a patient-level wallet: the ledger + balance are intentionally
  // patient-global (across branches), not branch-scoped. Branch authz above
  // gates access; the wallet itself follows the patient.
  const repo = new DentalPatientCreditRepository(db);
  const [credits, balanceCents] = await Promise.all([
    repo.listByPatient(patientId),
    repo.getBalance(patientId),
  ]);

  return ctx.json({
    patientId,
    balanceCents,
    credits: credits.map((c) => ({
      id: c.id,
      patientId: c.patientId,
      branchId: c.branchId,
      amountCents: c.amountCents,
      source: c.source,
      invoiceId: c.invoiceId ?? undefined,
      note: c.note ?? undefined,
      createdAt: c.createdAt.toISOString(),
    })),
  }, 200);
}
