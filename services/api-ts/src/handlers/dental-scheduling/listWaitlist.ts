/**
 * listWaitlist — GET /dental/branches/:branchId/waitlist
 *
 * Lists a branch's waitlist entries. Defaults to `active` (fillable) entries;
 * an optional ?status= query returns scheduled/cancelled history instead.
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalWaitlistEntryRepository } from './repos/waitlist-entry.repo';
import type { WaitlistEntryStatus } from './repos/waitlist-entry.schema';
import type { User } from '@/types/auth';
import type { ListWaitlistParams, ListWaitlistQuery } from '@/generated/openapi/validators';

export async function listWaitlist(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { branchId } = ctx.req.valid('param') as ListWaitlistParams;
  const query = ctx.req.valid('query') as ListWaitlistQuery;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  await assertBranchAccess(db, user.id, branchId);

  // RLS P1b activation: the waitlist read goes through withTenantTx so the
  // app_rls policy on dental_waitlist_entry scopes it to the branch. Authz stays on db.
  const entries = await withTenantTx(db, { branchIds: [branchId] }, (tx) =>
    new DentalWaitlistEntryRepository(tx, logger).listForBranch(branchId, query.status as WaitlistEntryStatus | undefined),
  );

  return ctx.json(entries);
}
