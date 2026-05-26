/**
 * getAuditEvents — GET /dental/admin/audit
 *
 * Admin-only endpoint to query the dental_audit log.
 * Supports filtering by personId, tenantId, resourceType, action, from/to dates.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { AuditLogRepository } from './repos/audit-log.repo';
import type { User } from '@/types/auth';

export async function getAuditEvents(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  // Admin role only
  const userRole: string = user.role ?? '';
  const roles = userRole.split(',').map((r: string) => r.trim());
  if (!roles.includes('admin')) {
    throw new ForbiddenError('Admin role required to access audit log');
  }

  const db = ctx.get('database') as DatabaseInstance;

  // Support both spec-correct names (actorId/targetType/targetId) and legacy aliases
  const actorId     = ctx.req.query('actorId')     ?? ctx.req.query('personId')      ?? undefined;
  const tenantId    = ctx.req.query('tenantId')     ?? undefined;
  const branchId    = ctx.req.query('branchId')     ?? undefined;
  const targetType  = ctx.req.query('targetType')   ?? ctx.req.query('resourceType') ?? undefined;
  const targetId    = ctx.req.query('targetId')     ?? ctx.req.query('resourceId')   ?? undefined;
  const action      = ctx.req.query('action')       ?? undefined;
  const from        = ctx.req.query('from');
  const to          = ctx.req.query('to');
  const limit  = Math.min(Number(ctx.req.query('limit')  ?? 50), 200);
  const offset = Number(ctx.req.query('offset') ?? 0);

  const repo = new AuditLogRepository(db);
  const { entries, total } = await repo.list(
    {
      actorId,
      tenantId,
      branchId,
      targetType,
      targetId,
      action,
      from: from ? new Date(from) : undefined,
      to:   to   ? new Date(to)   : undefined,
    },
    { limit, offset },
  );

  return ctx.json({ data: entries, meta: { total, limit, offset } });
}
