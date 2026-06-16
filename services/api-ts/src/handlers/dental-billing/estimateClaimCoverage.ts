/**
 * estimateClaimCoverage — POST /dental/billing/estimate
 *
 * P1-26: read-only coverage estimate for a set of planned line items. NO
 * persistence — purely computes the HMO-covered vs patient-portion split via
 * the pure engine. When a patient + active profile + authorization are supplied
 * the estimate is approval-driven; otherwise it falls back to a cash estimate.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, BusinessLogicError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import {
  getInsuranceProfileForBilling,
  getCoverageAuthorizationForBilling,
} from '@/handlers/dental-patient/repos/insurance-billing.facade';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { estimateCoverage, type EstimateLineInput } from './utils/coverage-estimate';

export async function estimateClaimCoverage(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json') as {
    patientId?: string;
    insuranceProfileId?: string;
    authorizationId?: string;
    lines: EstimateLineInput[];
  };

  const db = ctx.get('database') as DatabaseInstance;

  if (!Array.isArray(body.lines)) {
    throw new BusinessLogicError('lines is required', 'INVALID_INPUT');
  }

  let hasActiveProfile = false;
  let approvedAmountCents: number | null | undefined;
  let coveredProcedures: Array<{ cdtCode: string; approvedAmountCents?: number }> | null | undefined;
  let annualLimitRemainingCents: number | null | undefined;

  // Insurance fields are evaluated only when a patient + profile are supplied.
  // A cash request (no profile) yields a fully patient-pay estimate.
  if (body.patientId && body.insuranceProfileId) {
    // P1-4: body.patientId/insuranceProfileId are caller-supplied and the facade
    // reads run on the RLS-bypassing connection, so without this a caller could
    // read ANY tenant's annual-limit / approved-coverage by passing a foreign
    // (patientId, insuranceProfileId) pair. Resolve the patient and require the
    // caller to be a member of its branch before any coverage read.
    const patient = await getPatientForDentalPatient(db, body.patientId);
    if (!patient) throw new NotFoundError('Patient not found');
    await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

    const profile = await getInsuranceProfileForBilling(db, body.insuranceProfileId, body.patientId);
    if (profile && profile.active) {
      hasActiveProfile = true;
      if (profile.annualLimitCents != null) {
        annualLimitRemainingCents = Math.max(0, profile.annualLimitCents - (profile.annualLimitUsedCents ?? 0));
      }
    }

    if (hasActiveProfile && body.authorizationId) {
      const auth = await getCoverageAuthorizationForBilling(db, body.authorizationId, body.patientId);
      if (auth && (auth.status === 'approved' || auth.status === 'partial')) {
        approvedAmountCents = auth.approvedAmountCents ?? undefined;
        coveredProcedures = auth.coveredProcedures ?? undefined;
      }
    }
  }

  const result = estimateCoverage(body.lines, {
    hasActiveProfile,
    approvedAmountCents,
    coveredProcedures,
    annualLimitRemainingCents,
  });

  return ctx.json(result, 200);
}
