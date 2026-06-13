/**
 * getRetentionStatus handler
 *
 * GET /dental/retention-status
 * Admin-only read of retention enforcement status (FR8.14). Surfaces the
 * audit-derived summary (last run, dry-run-vs-live mode, last run's counts) so a
 * clinic can verify the env-gated/dry-run-by-default retention engine is acting,
 * without DB/env access. Optionally tenant-scoped via the `tenantId` query param.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import type { GetRetentionStatusQuery } from '@/generated/openapi/validators';
import { summarizeRetentionEnforcement } from './retention-status';

export async function getRetentionStatus(
  ctx: ValidatedContext<never, GetRetentionStatusQuery, never>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  // Defense-in-depth: the generated route also gates roles:["admin"], but the
  // handler enforces it too (matches the erasure/legal-hold governance handlers).
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can view retention status');

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;

  const status = await summarizeRetentionEnforcement(db, query.tenantId);
  return ctx.json(status);
}
