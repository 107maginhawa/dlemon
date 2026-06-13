/**
 * getAuditEvents — GET /dental/audit-events
 *
 * Admin-only (dentist_owner) endpoint to query the dental_audit log.
 * Branch-scoped. Filterable by actorId, eventType, action, targetType/targetId,
 * and a from/to date range. Paginated (limit/offset).
 *
 * Contract: docs/product/modules/dental-audit/MODULE_SPEC.md §10
 *   GET /dental/audit-events (branch_id, actor_id?, event_type?, date_range?, page)
 *
 * The response maps DB rows to a stable contract DTO and deliberately OMITS the
 * beforeSnapshot/afterSnapshot columns: those JSONB blobs are not part of the
 * viewer contract and may carry latent PHI (V-AUD-003 / AC-AUD-004).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ValidationError,
  BusinessLogicError,
} from '@/core/errors';
import { AuditLogRepository } from './repos/audit-log.repo';
import type { DentalAuditLog } from './repos/audit-log.schema';
import { listBranchBasePhiReads, type BasePhiReadRow } from './repos/base-phi-reads.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { User } from '@/types/auth';

/**
 * Contract DTO for an audit event in the viewer response.
 * Snapshot columns (beforeSnapshot/afterSnapshot) are intentionally excluded.
 */
interface DentalAuditEventDTO {
  id: string;
  branchId: string | null;
  tenantId: string;
  actorId: string;
  actorRole: string | null;
  eventType: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  timestamp: string;
}

function toDTO(row: DentalAuditLog): DentalAuditEventDTO {
  return {
    id: row.id,
    branchId: row.branchId ?? null,
    tenantId: row.tenantId,
    actorId: row.actorId,
    actorRole: row.actorRole ?? null,
    eventType: row.eventType ?? null,
    action: row.action,
    resourceType: row.targetType,
    resourceId: row.targetId ?? null,
    reason: row.reason ?? null,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    metadata: row.metadata ?? null,
    timestamp:
      row.timestamp instanceof Date
        ? row.timestamp.toISOString()
        : (row.timestamp as unknown as string),
  };
}

/**
 * Map a base-sink (#3) PHI-access read into the same viewer DTO (#18 single pane).
 * The base `details` JSONB is DELIBERATELY DROPPED (it may carry latent PHI, same
 * concern as the snapshot columns / V-AUD-003) and replaced with a `{ source }`
 * provenance marker so the owner can tell platform reads from dental events.
 */
function basePhiReadToDTO(
  row: BasePhiReadRow,
  branchId: string,
  resolvedTenant: string,
): DentalAuditEventDTO {
  return {
    id: row.id,
    branchId,
    tenantId: resolvedTenant,
    actorId: row.user ?? '',
    actorRole: row.userType ?? null,
    eventType: 'data-access',
    action: 'read',
    resourceType: row.resourceType,
    resourceId: row.resource ?? null,
    reason: null,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    metadata: { source: 'base' },
    timestamp: row.createdAt.toISOString(),
  };
}

export async function getAuditEvents(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;

  // Contract params (MODULE_SPEC §10). Legacy aliases retained for back-compat
  // with any existing callers (actorId←personId, targetType←resourceType, ...).
  const branchId = ctx.req.query('branchId') ?? undefined;

  // EM-AUD-002 / AC-AUD-003: branchId is REQUIRED (AUDIT_CONTRACTS.md §5).
  // Without it, AuditLogRepository.list applies no branch/tenant condition and
  // returns audit rows across ALL tenants — a cross-tenant PHI-adjacent leak.
  // The endpoint must always be branch-scoped.
  if (!branchId) {
    throw new ValidationError('branchId query parameter is required');
  }

  const actorId = ctx.req.query('actorId') ?? ctx.req.query('personId') ?? undefined;
  const tenantId = ctx.req.query('tenantId') ?? undefined;
  const eventType = ctx.req.query('eventType') ?? undefined;
  const targetType = ctx.req.query('targetType') ?? ctx.req.query('resourceType') ?? undefined;
  const targetId = ctx.req.query('targetId') ?? ctx.req.query('resourceId') ?? undefined;
  const action = ctx.req.query('action') ?? undefined;
  const from = ctx.req.query('from');
  const to = ctx.req.query('to');

  // V-AUD-002: validate the date range up front (no DB work needed). from>to
  // previously returned an empty set silently, masking a malformed query.
  // Reject with 422 INVALID_DATE_RANGE. Unparseable dates are 400.
  // Done before the role DB lookup so callers get fast input-error feedback.
  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (from) {
    fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) {
      throw new ValidationError('from is not a valid date');
    }
  }
  if (to) {
    toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      throw new ValidationError('to is not a valid date');
    }
  }
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new BusinessLogicError(
      'from date must be on or before to date',
      'INVALID_DATE_RANGE',
    );
  }

  // V-AUD-NEW / AC-AUD-003: dentist_owner only. Use assertBranchRole (checks the
  // dental_membership table) — the same pattern every other dental handler uses.
  // The old check used user.role (Better-Auth session field) which is never set
  // to dentist_owner by the self-service onboarding flow, making this endpoint
  // inaccessible to all legitimately onboarded clinic owners (BUG: EM-AUD-009).
  await assertBranchRole(db, user.id, branchId, ['dentist_owner']);

  const limit = Math.min(Number(ctx.req.query('limit') ?? 50), 200);
  const offset = Number(ctx.req.query('offset') ?? 0);

  const repo = new AuditLogRepository(db);

  // #18 / decision-log Q2 — SINGLE PANE. The viewer unions two sinks at READ time:
  //   sink #1 `dental_audit_log` (every dental event) AND
  //   sink #3 `audit_log_entry` data-access PHI reads attributable to this branch's
  //           active members (base-module reads the owner previously could not see).
  // The base sink is included only when the eventType filter is unset or explicitly
  // 'data-access' (base PHI reads are all data-access). To page a merged-and-sorted
  // result we fetch the top (offset+limit) of each source, merge desc by timestamp,
  // then slice the requested window. total = sum of each source's unpaginated count.
  const includeBaseReads = !eventType || eventType === 'data-access';
  const window = offset + limit;

  const [{ entries, total: dentalTotal }, base] = await Promise.all([
    repo.list(
      {
        actorId,
        tenantId,
        branchId,
        eventType,
        targetType,
        targetId,
        action,
        from: fromDate,
        to: toDate,
      },
      { limit: window, offset: 0 },
    ),
    includeBaseReads
      ? listBranchBasePhiReads(
          db,
          branchId,
          { actorId, action, targetType, targetId, from: fromDate, to: toDate },
          { limit: window, offset: 0 },
        )
      : Promise.resolve({ rows: [] as BasePhiReadRow[], total: 0 }),
  ]);

  // Base rows carry no real tenant column; stamp the viewed branchId (the only
  // honest scope we have) rather than echoing the caller-supplied tenantId param.
  const merged = [
    ...entries.map(toDTO),
    ...base.rows.map((r) => basePhiReadToDTO(r, branchId, branchId)),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const page = merged.slice(offset, offset + limit);
  const total = dentalTotal + base.total;

  // V-AUD-NEW-B / WF-028 / AUDIT_CONTRACTS §3: viewing the audit log is itself a
  // privileged READ that MUST be self-audited (ACCESSED). Record scope/counts only —
  // never PHI. This is a single insert, so it cannot recurse (logAuditEvent does not
  // re-invoke getAuditEvents); logAuditEvent never throws, so it cannot break the read.
  const logger = ctx.get('logger');
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: tenantId ?? branchId,
    branchId,
    eventType: 'security',
    actorRole: 'dentist_owner',
    action: 'audit_log.accessed',
    resourceType: 'dental_audit_log',
    metadata: {
      // Filter scope only — IDs/flags/counts, no PHI.
      filteredActorId: actorId ?? null,
      eventType: eventType ?? null,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      action: action ?? null,
      from: from ?? null,
      to: to ?? null,
      limit,
      offset,
      resultCount: page.length,
      total,
    },
  });

  // V-AUD-003: rows are already mapped to the contract DTO (snapshots dropped) and
  // merged across sinks (#18 single pane); return the paginated window.
  return ctx.json({ data: page, meta: { total, limit, offset } });
}
