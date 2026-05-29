/**
 * markUncollectible handler
 *
 * POST /dental/billing/invoices/:invoiceId/uncollectible
 *
 * V-BIL-006 / BR-013 / AC-BIL-005: marking an invoice uncollectible (write-off)
 * is explicitly deferred (feature flag `dental_billing_uncollectible`, default
 * false). The endpoint exists so the contract is honest, but it returns
 * 501 NOT_IMPLEMENTED until the write-off workflow ships in a future phase.
 *
 * This is a minimal stub by design — do NOT implement the write-off logic here
 * without first lifting the feature flag and the BR-013 deferral.
 */

import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, AppError } from '@/core/errors';

export async function markUncollectible(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // BR-013: deferred — always 501.
  throw new AppError(
    'Marking an invoice uncollectible is not yet implemented (BR-013, deferred)',
    'NOT_IMPLEMENTED',
    501,
  );
}
