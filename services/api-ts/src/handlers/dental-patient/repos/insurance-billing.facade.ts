/**
 * insurance-billing.facade.ts
 *
 * Facade exposing patient-module insurance profile + coverage-authorization data
 * to dental-billing revenue-cycle handlers. Isolates cross-module access behind
 * typed functions (boundary lint exempts *.facade.ts).
 */

import { eq, and, inArray } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalInsuranceProfiles } from './insurance-profile.schema';
import { dentalCoverageAuthorizations } from './coverage-authorization.schema';

export interface InsuranceProfileSummary {
  id: string;
  patientId: string;
  insurerName: string;
  payerType: string;
  active: boolean;
  annualLimitCents: number | null;
  annualLimitUsedCents: number | null;
}

export interface CoverageAuthorizationSummary {
  id: string;
  patientId: string;
  insuranceProfileId: string;
  status: string;
  validUntil: string | null;
  approvedAmountCents: number | null;
  coveredProcedures: Array<{ cdtCode: string; approvedAmountCents?: number; note?: string }> | null;
}

/** Look up an insurance profile by id, scoped to the patient. */
export async function getInsuranceProfileForBilling(
  db: DatabaseInstance,
  profileId: string,
  patientId: string,
): Promise<InsuranceProfileSummary | null> {
  const [row] = await db
    .select({
      id: dentalInsuranceProfiles.id,
      patientId: dentalInsuranceProfiles.patientId,
      insurerName: dentalInsuranceProfiles.insurerName,
      payerType: dentalInsuranceProfiles.payerType,
      active: dentalInsuranceProfiles.active,
      annualLimitCents: dentalInsuranceProfiles.annualLimitCents,
      annualLimitUsedCents: dentalInsuranceProfiles.annualLimitUsedCents,
    })
    .from(dentalInsuranceProfiles)
    .where(and(
      eq(dentalInsuranceProfiles.id, profileId),
      eq(dentalInsuranceProfiles.patientId, patientId),
    ))
    .limit(1);
  return row ?? null;
}

/** Whether a patient has at least one active insurance profile. */
export async function patientHasActiveInsurance(
  db: DatabaseInstance,
  patientId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: dentalInsuranceProfiles.id })
    .from(dentalInsuranceProfiles)
    .where(and(
      eq(dentalInsuranceProfiles.patientId, patientId),
      eq(dentalInsuranceProfiles.active, true),
    ))
    .limit(1);
  return !!row;
}

/** Map insurance-profile ids → insurer (payer) display names. */
export async function getInsurerNamesForBilling(
  db: DatabaseInstance,
  profileIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (profileIds.length === 0) return names;
  const rows = await db
    .select({ id: dentalInsuranceProfiles.id, insurerName: dentalInsuranceProfiles.insurerName })
    .from(dentalInsuranceProfiles)
    .where(inArray(dentalInsuranceProfiles.id, profileIds));
  for (const r of rows) names.set(r.id, r.insurerName);
  return names;
}

/** Look up a coverage authorization by id, scoped to the patient. */
export async function getCoverageAuthorizationForBilling(
  db: DatabaseInstance,
  authorizationId: string,
  patientId: string,
): Promise<CoverageAuthorizationSummary | null> {
  const [row] = await db
    .select({
      id: dentalCoverageAuthorizations.id,
      patientId: dentalCoverageAuthorizations.patientId,
      insuranceProfileId: dentalCoverageAuthorizations.insuranceProfileId,
      status: dentalCoverageAuthorizations.status,
      validUntil: dentalCoverageAuthorizations.validUntil,
      approvedAmountCents: dentalCoverageAuthorizations.approvedAmountCents,
      coveredProcedures: dentalCoverageAuthorizations.coveredProcedures,
    })
    .from(dentalCoverageAuthorizations)
    .where(and(
      eq(dentalCoverageAuthorizations.id, authorizationId),
      eq(dentalCoverageAuthorizations.patientId, patientId),
    ))
    .limit(1);
  return row ?? null;
}
