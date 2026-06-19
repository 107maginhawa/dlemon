/**
 * org-billing.facade.ts
 *
 * Facade exposing dental-org repo data to dental-billing handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { BranchRepository } from './branch.repo';
import { dentalMemberships } from './membership.schema';

export async function getBranchOrgId(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ organizationId: string } | null> {
  const branch = await new BranchRepository(db).findOneById(branchId);
  return branch ? { organizationId: branch.organizationId } : null;
}

/**
 * EM-BIL-002: the active branch ids a person belongs to.
 *
 * Used by the dental-billing report endpoints (AR aging, collections summary,
 * payer aging, claim worklist, statement batch) whose `branchId` filter is
 * OPTIONAL. When the caller omits `branchId` the handler must scope results to
 * the caller's own branches — NOT the entire (multi-tenant) database — or it
 * leaks another org's invoices/payments/claims/balances + patient PHI.
 */
export async function getActiveBranchIdsForPerson(
  db: DatabaseInstance,
  personId: string,
): Promise<string[]> {
  const rows = await db
    .select({ branchId: dentalMemberships.branchId })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, personId), eq(dentalMemberships.status, 'active')));
  return rows.map((r) => r.branchId);
}

/**
 * dental-org G2 (decision §5): the per-branch CDT price overrides stored on
 * `dental_branch.settings.feeSchedule`. Consumed by dental-visit treatment
 * creation to default a treatment's price from the configured fee schedule.
 * Returns an empty map when the branch is unknown or has no overrides.
 */
export async function getBranchFeeOverrides(
  db: DatabaseInstance,
  branchId: string,
): Promise<Record<string, number>> {
  const branch = await new BranchRepository(db).findOneById(branchId);
  const settings = (branch?.settings ?? {}) as { feeSchedule?: Record<string, number> };
  return settings.feeSchedule ?? {};
}

/**
 * BR-048: the clinic-wide default payment terms (days) from branch settings.
 * Lowest-precedence fallback at invoice issue. Null when unset (→ due on receipt).
 */
export async function getBranchDefaultPaymentTermsDays(
  db: DatabaseInstance,
  branchId: string,
): Promise<number | null> {
  const branch = await new BranchRepository(db).findOneById(branchId);
  const settings = (branch?.settings ?? {}) as { defaultPaymentTermsDays?: number };
  return settings.defaultPaymentTermsDays ?? null;
}

/**
 * BR-054: the per-branch tax mode (PH). Drives invoice tax derivation.
 * Defaults to non_vat (no tax) when unset. vatRate defaults to 12.
 */
export async function getBranchTaxConfig(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ taxMode: 'non_vat' | 'vat_registered'; vatRate: number }> {
  const branch = await new BranchRepository(db).findOneById(branchId);
  const settings = (branch?.settings ?? {}) as { taxMode?: 'non_vat' | 'vat_registered'; vatRate?: number };
  return { taxMode: settings.taxMode ?? 'non_vat', vatRate: settings.vatRate ?? 12 };
}

/**
 * BR-055: the per-branch BIR receipt header (PH). Registered name, business
 * style, TIN, address from branch settings + the VAT-registration flag. Null
 * fields are simply not yet configured.
 */
export async function getBranchBirInfo(
  db: DatabaseInstance,
  branchId: string,
): Promise<{ registeredName: string | null; businessStyle: string | null; tin: string | null; address: string | null; isVatRegistered: boolean }> {
  const branch = await new BranchRepository(db).findOneById(branchId);
  const s = (branch?.settings ?? {}) as {
    registeredName?: string; businessStyle?: string; tin?: string; clinicAddress?: string;
    taxMode?: 'non_vat' | 'vat_registered';
  };
  return {
    registeredName: s.registeredName ?? branch?.name ?? null,
    businessStyle: s.businessStyle ?? null,
    tin: s.tin ?? null,
    address: s.clinicAddress ?? null,
    isVatRegistered: s.taxMode === 'vat_registered',
  };
}

export async function getActiveMembershipId(
  db: DatabaseInstance,
  personId: string,
  branchId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: dentalMemberships.id })
    .from(dentalMemberships)
    .where(
      and(
        eq(dentalMemberships.personId, personId),
        eq(dentalMemberships.branchId, branchId),
        eq(dentalMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}
