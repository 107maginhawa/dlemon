/**
 * approveAmendment handler
 *
 * POST /dental/visits/{visitId}/amendments/{amendmentId}/approve
 *
 * V-CLI-001 / TR-P1-05 / BR-019: supervisor approval for clinical amendments is
 * explicitly deferred (feature flag `dental_clinical_amendment_approval`, default
 * false — MODULE_SPEC §18). The endpoint exists so the contract is honest
 * (spec §5/§13/§15 require it to be present), but it returns 501 NOT_IMPLEMENTED
 * until the approval workflow ships in a future phase.
 *
 * This is a minimal stub by design — do NOT implement the approval logic here
 * without first lifting the feature flag and the BR-019 deferral.
 */

import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, AppError } from '@/core/errors';
import type { ApproveAmendmentParams } from '@/generated/openapi/validators';

export async function approveAmendment(
  ctx: ValidatedContext<never, never, ApproveAmendmentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // BR-019: supervisor approval deferred — always 501.
  throw new AppError(
    'Amendment supervisor approval is not yet implemented (BR-019, deferred)',
    'NOT_IMPLEMENTED',
    501,
  );
}
