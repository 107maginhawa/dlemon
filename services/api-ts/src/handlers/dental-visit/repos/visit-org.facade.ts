/**
 * visit-org.facade.ts
 *
 * Facade exposing dental-visit procedure-code data to dental-org handlers.
 * Isolates cross-module access behind typed functions — dental-org imports
 * only this file, never the underlying procedure-code repo/schema directly
 * (Phase 10 boundary lint).
 *
 * Used by dental-org fee-schedule endpoints (EF-ORG-P016 / WF-025): the fee
 * schedule is the active CDT catalog with per-branch price overrides.
 */

import { eq, and, asc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalProcedureCodes } from './procedure-code.schema';

export interface ProcedureCodeEntry {
  cdtCode: string;
  description: string;
  defaultFeePhp: number;
}

/** All active CDT procedure codes, ordered by code — the fee-schedule catalog. */
export async function listActiveProcedureCodes(db: DatabaseInstance): Promise<ProcedureCodeEntry[]> {
  return db
    .select({
      cdtCode: dentalProcedureCodes.cdtCode,
      description: dentalProcedureCodes.description,
      defaultFeePhp: dentalProcedureCodes.defaultFeePhp,
    })
    .from(dentalProcedureCodes)
    .where(eq(dentalProcedureCodes.active, true))
    .orderBy(asc(dentalProcedureCodes.cdtCode));
}

/** A single active CDT procedure code, or null if unknown/inactive. */
export async function getActiveProcedureCode(
  db: DatabaseInstance,
  cdtCode: string,
): Promise<ProcedureCodeEntry | null> {
  const [row] = await db
    .select({
      cdtCode: dentalProcedureCodes.cdtCode,
      description: dentalProcedureCodes.description,
      defaultFeePhp: dentalProcedureCodes.defaultFeePhp,
    })
    .from(dentalProcedureCodes)
    .where(and(eq(dentalProcedureCodes.cdtCode, cdtCode), eq(dentalProcedureCodes.active, true)))
    .limit(1);
  return row ?? null;
}
