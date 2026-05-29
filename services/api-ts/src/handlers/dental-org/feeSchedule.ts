/**
 * Fee Schedule handlers (EF-ORG-P016 / WF-025, FR6.3)
 *
 *   GET   /dental/fee-schedule?branchId=...   — read the branch fee schedule
 *   PATCH /dental/fee-schedule/:cdt           — set a per-branch CDT price
 *
 * The fee schedule is the active CDT procedure-code catalog (owned by
 * dental-visit, accessed via visit-org.facade) with per-branch price overrides
 * stored on `dental_branch.settings.feeSchedule` (Record<cdtCode, priceCents>).
 * Currency is taken from `settings.currency` (defaults to 'PHP').
 *
 * Access control:
 *   GET   — dentist_owner or dentist_associate (branch members)
 *   PATCH — dentist_owner only
 */

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
} from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { dentalBranches, type BranchSettings } from './repos/branch.schema';
import {
  listActiveProcedureCodes,
  getActiveProcedureCode,
} from '@/handlers/dental-visit/repos/visit-org.facade';
import { logAuditEvent } from '@/core/audit-logger';

const DEFAULT_CURRENCY = 'PHP';

export const UpdateFeeScheduleBody = z.object({
  branchId: z.string().uuid(),
  priceCents: z.number().int().min(0).max(999999),
});

interface FeeScheduleEntry {
  cdtCode: string;
  description: string;
  priceCents: number;
  currency: string;
}

/**
 * GET /dental/fee-schedule?branchId=...
 * Returns the active CDT catalog with effective per-branch prices.
 */
export async function getFeeSchedule(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new ValidationError('branchId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;

  // Read access: any clinical role with active branch membership.
  await assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate']);

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const settings = (branch.settings ?? {}) as BranchSettings;
  const overrides = settings.feeSchedule ?? {};
  const currency = settings.currency ?? DEFAULT_CURRENCY;

  const codes = await listActiveProcedureCodes(db);
  const data: FeeScheduleEntry[] = codes.map((code) => ({
    cdtCode: code.cdtCode,
    description: code.description,
    priceCents: overrides[code.cdtCode] ?? code.defaultFeePhp,
    currency,
  }));

  return ctx.json({ data }, 200);
}

/**
 * PATCH /dental/fee-schedule/:cdt
 * Sets a per-branch price override for a CDT code (dentist_owner only).
 */
export async function updateFeeScheduleEntry(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const cdt = ctx.req.param('cdt');
  if (!cdt) throw new BusinessLogicError('Unknown CDT code', 'INVALID_CDT_CODE');
  const { branchId, priceCents } = UpdateFeeScheduleBody.parse(await ctx.req.json());

  const db = ctx.get('database') as DatabaseInstance;

  // Write access: dentist_owner only. Runs before the CDT existence check so
  // CDT validity is never leaked to under-privileged callers.
  await assertBranchRole(db, user.id, branchId, ['dentist_owner']);

  const procedure = await getActiveProcedureCode(db, cdt);
  if (!procedure) {
    throw new BusinessLogicError(`Unknown CDT code: ${cdt}`, 'INVALID_CDT_CODE');
  }

  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');

  const settings = (branch.settings ?? {}) as BranchSettings;
  const merged: BranchSettings = {
    ...settings,
    feeSchedule: { ...(settings.feeSchedule ?? {}), [cdt]: priceCents },
  };

  await db.update(dentalBranches)
    .set({ settings: merged, updatedAt: new Date(), updatedBy: user.id })
    .where(eq(dentalBranches.id, branchId));

  // V-ORG-002 / §10b (AL-*): fee-schedule price changes are financially material
  // (WF-025) and must leave an audit trail. targetId is the branch (CDT code is
  // a string, not a uuid); the CDT code + new price live in non-PHI metadata.
  const logger = ctx.get('logger');
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: branch.organizationId,
      branchId,
      eventType: 'data-modification',
      action: 'fee_schedule.update',
      resourceType: 'dental_branch',
      resourceId: branchId,
      metadata: { cdtCode: cdt, priceCents },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'V-ORG-002: failed to write fee_schedule.update audit log');
  }

  const entry: FeeScheduleEntry = {
    cdtCode: procedure.cdtCode,
    description: procedure.description,
    priceCents,
    currency: settings.currency ?? DEFAULT_CURRENCY,
  };

  return ctx.json({ data: entry }, 200);
}
