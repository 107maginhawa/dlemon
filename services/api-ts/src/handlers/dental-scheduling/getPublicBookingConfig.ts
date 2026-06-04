/**
 * getPublicBookingConfig (P1-25)
 *
 * GET /dental/public/branches/:branchId/booking-config  (public)
 *
 * Returns the per-branch online-booking policy + bookable providers that drive
 * the public booking form. PII-free. 404 if the branch does not exist or is
 * inactive; returns enabled:false (rather than 404) when booking is simply not
 * turned on so the UI can render a "not available online" state.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, RateLimitError } from '@/core/errors';
import type { GetPublicBookingConfigParams } from '@/generated/openapi/validators';
import { getBranchOnlineBookingContext } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { parseOnlineBookingConfig } from './online-booking-config';
import { availabilityLimiter, clientIp } from './public-booking-ratelimit';

export async function getPublicBookingConfig(
  ctx: ValidatedContext<never, never, GetPublicBookingConfigParams>,
): Promise<Response> {
  const { branchId } = ctx.req.valid('param');

  const rl = availabilityLimiter.check(`${clientIp(ctx.req.raw.headers)}:config:${branchId}`);
  if (!rl.allowed) throw new RateLimitError('Too many requests');

  const db = ctx.get('database') as DatabaseInstance;
  const branch = await getBranchOnlineBookingContext(db, branchId);
  if (!branch || !branch.active) throw new NotFoundError('Branch');

  const config = parseOnlineBookingConfig(branch.settings);

  const providers = config.bookableProviderMemberIds === 'all'
    ? branch.providers
    : branch.providers.filter((p) => (config.bookableProviderMemberIds as string[]).includes(p.providerId));

  return ctx.json({
    branchId: branch.id,
    branchName: branch.name,
    timezone: branch.timezone,
    enabled: config.enabled,
    bookableVisitTypes: config.bookableVisitTypes,
    leadTimeMinutes: config.leadTimeMinutes,
    horizonDays: config.horizonDays,
    slotStepMinutes: config.slotStepMinutes,
    requirePatientAuth: config.requirePatientAuth,
    providers: providers.map((p) => ({ providerId: p.providerId, displayName: p.displayName })),
  }, 200);
}
