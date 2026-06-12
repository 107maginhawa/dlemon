/**
 * base-phi-reads.facade — read-only seam from the dental-audit viewer into the
 * BASE platform audit sink (`audit_log_entry`, sink #3).
 *
 * #18 / decision-log Q2 ("single pane"): base-module PHI-access reads — the
 * `data-access` events that dental read handlers (listMedicalHistory,
 * listPrescriptions, getDentalInvoice, …) record via the base `audit.logEvent`
 * sink — must surface in the dental owner's audit viewer alongside the dental
 * `dental_audit_log` events. The physical 3→1 sink merge stays deferred to V2;
 * this is a READ-TIME union, so no other module's write path changes.
 *
 * SCOPING (the hard part): `audit_log_entry` carries no branch/tenant column
 * (baseEntityFields only). We therefore scope by ACTOR — the rows whose actor
 * (`user`) is an ACTIVE member of the viewed branch (`dental_membership`, the
 * same table the viewer already authorizes against). This is leak-safe for V1's
 * single-org product: only the caller's own branch members' reads are surfaced,
 * and only ids (actor/resource) — base `details` (potential PHI) are dropped by
 * the caller. ROADMAP: if cross-org membership ever becomes possible, harden to
 * resource-scoping (patient/visit∈branch) once the patient branch anchor is
 * non-nullable.
 *
 * Boundary: this file is a `.facade` (exempt from check-module-boundaries) so it
 * may read the base `audit_log_entry` schema and the dental-org membership schema
 * directly. It exposes ONLY the minimal, PHI-free row shape the viewer needs.
 */

import { and, eq, gte, lte, inArray, desc, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { auditLogEntries, type AuditAction } from '@/handlers/audit/repos/audit.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';

// `audit_log_entry.action` is a constrained Postgres ENUM. The dental viewer's
// `action` filter is freeform (dental actions like `invoice.voided`,
// `patient.registered`), so passing a non-enum value to the base query would
// raise "invalid input value for enum audit_action" (500). Guard with the known
// base actions; any other action filter can match no base row → empty result.
const BASE_AUDIT_ACTIONS: readonly AuditAction[] = [
  'create', 'read', 'update', 'delete', 'login', 'logout',
];

export interface BasePhiReadFilters {
  actorId?: string;
  action?: string;
  targetType?: string; // → audit_log_entry.resourceType
  targetId?: string; // → audit_log_entry.resource
  from?: Date;
  to?: Date;
}

/** PHI-free projection of a base data-access row (ids + request context only). */
export interface BasePhiReadRow {
  id: string;
  user: string | null;
  userType: string | null;
  resourceType: string;
  resource: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * List base-sink (#3) PHI-access reads attributable to the viewed branch's active
 * members. Returns rows newest-first plus the unpaginated total for that scope.
 */
export async function listBranchBasePhiReads(
  db: DatabaseInstance,
  branchId: string,
  filters: BasePhiReadFilters,
  pagination: { limit: number; offset: number },
): Promise<{ rows: BasePhiReadRow[]; total: number }> {
  // Active members of the viewed branch — the actor allow-list (leak-safe scope).
  const members = await db
    .select({ personId: dentalMemberships.personId })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.branchId, branchId), eq(dentalMemberships.status, 'active')));
  const memberIds = members
    .map((m) => m.personId)
    .filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (memberIds.length === 0) return { rows: [], total: 0 };

  // A non-base action filter (e.g. a dental `invoice.voided`) can never match a
  // base ENUM action — and would crash the enum comparison — so short-circuit.
  if (filters.action && !BASE_AUDIT_ACTIONS.includes(filters.action as AuditAction)) {
    return { rows: [], total: 0 };
  }

  const conditions: SQL[] = [
    // Only PHI-access READS (sink #3 also holds auth/system/data-modification noise).
    eq(auditLogEntries.eventType, 'data-access'),
    inArray(auditLogEntries.user, memberIds),
  ];
  // If the caller filters to a specific actor, intersect (still within member set).
  if (filters.actorId) conditions.push(eq(auditLogEntries.user, filters.actorId));
  if (filters.action) conditions.push(eq(auditLogEntries.action, filters.action as AuditAction));
  if (filters.targetType) conditions.push(eq(auditLogEntries.resourceType, filters.targetType));
  if (filters.targetId) conditions.push(eq(auditLogEntries.resource, filters.targetId));
  if (filters.from) conditions.push(gte(auditLogEntries.createdAt, filters.from));
  if (filters.to) conditions.push(lte(auditLogEntries.createdAt, filters.to));

  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: auditLogEntries.id,
        user: auditLogEntries.user,
        userType: auditLogEntries.userType,
        resourceType: auditLogEntries.resourceType,
        resource: auditLogEntries.resource,
        ipAddress: auditLogEntries.ipAddress,
        userAgent: auditLogEntries.userAgent,
        createdAt: auditLogEntries.createdAt,
      })
      .from(auditLogEntries)
      .where(where)
      .orderBy(desc(auditLogEntries.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ id: auditLogEntries.id }).from(auditLogEntries).where(where),
  ]);

  return { rows, total: countRows.length };
}
