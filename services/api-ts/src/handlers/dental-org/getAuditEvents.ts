/**
 * getAuditEvents — GET /dental/admin/audit
 *
 * Admin-only endpoint to query the dental_audit log.
 * Supports filtering by personId, tenantId, resourceType, action, from/to dates.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { DentalAuditRepository } from '@/db/audit.repo';
import type { User } from '@/types/auth';

export async function getAuditEvents(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  // Admin role only
  const userRole: string = (user as any).role ?? '';
  const roles = userRole.split(',').map((r: string) => r.trim());
  if (!roles.includes('admin')) {
    throw new ForbiddenError('Admin role required to access audit log');
  }

  const db = ctx.get('database') as DatabaseInstance;

  const personId = ctx.req.query('personId');
  const tenantId = ctx.req.query('tenantId');
  const resourceType = ctx.req.query('resourceType');
  const resourceId = ctx.req.query('resourceId');
  const action = ctx.req.query('action');
  const from = ctx.req.query('from');
  const to = ctx.req.query('to');
  const limit = Math.min(Number(ctx.req.query('limit') ?? 50), 200);
  const offset = Number(ctx.req.query('offset') ?? 0);

  const repo = new DentalAuditRepository(db);
  const { entries, total } = await repo.query(
    {
      personId: personId ?? undefined,
      tenantId: tenantId ?? undefined,
      resourceType: resourceType ?? undefined,
      resourceId: resourceId ?? undefined,
      action: action ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    },
    { limit, offset },
  );

  return ctx.json({ data: entries, meta: { total, limit, offset } });
}
