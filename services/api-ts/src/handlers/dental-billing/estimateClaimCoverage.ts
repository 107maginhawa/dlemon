/**
 * estimateClaimCoverage — POST /dental/billing/estimate
 *
 * P1-26: read-only coverage estimate for a set of planned line items. NO
 * persistence — purely computes the HMO-covered vs patient-portion split via
 * the pure engine. When a patient + active profile + authorization are supplied
 * the estimate is approval-driven; otherwise it falls back to a cash estimate.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import {
  getInsuranceProfileForBilling,
  getCoverageAuthorizationForBilling,
} from '@/handlers/dental-patient/repos/insurance-billing.facade';
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
