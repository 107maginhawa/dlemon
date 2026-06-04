/**
 * listDentalPatients — GET /dental/patients
 *
 * FR2.1: List patients with pagination and branchId filter
 * FR2.2: Search patients by name (q param)
 * FR2.10: Filter by follow-up indicator (needsFollowUp=true)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { listDentalPatientsWithPerson, countDentalPatientsWithPerson } from '../../patient/repos/patient-dental-patient.facade';
import { getVisitStatsForPatients } from '../../dental-visit/repos/visit-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { buildPaginationMeta } from '@/utils/query';
import type { ListDentalPatientsQuery } from '@/generated/openapi/validators';

export async function listDentalPatients(
  ctx: ValidatedContext<never, ListDentalPatientsQuery, never>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.valid('query');

  // Branch-level authorization — branchId is required to prevent cross-branch data leaks
  if (!q['branchId']) {
    return ctx.json({ error: 'branchId is required' } as any, 400);
  }
  // V-PAT-008: per ROLE_PERMISSION_MATRIX, ALL dental context roles may view
  // the patient list (scoped to their branch). Read access is the floor.
  await assertBranchRole(db, user.id, q['branchId'], [
    'dentist_owner',
    'dentist_associate',
    'hygienist',
    'staff_full',
    'staff_scheduling',
    'dental_assistant',
    'front_desk',
    'billing_staff',
    'read_only',
  ]);

  const filters: Record<string, any> = {};

  // EM-PAT-004/EF-PAT-003: strict per-branch scope — never expand to the whole org
  if (q['branchId']) {
    filters['branchId'] = q['branchId'];
  }

  if (q['q']) filters['q'] = q['q'];
  if (q['needsFollowUp'] === true) filters['needsFollowUp'] = true;
  if (q['status']) filters['status'] = q['status'];

  const limit = Math.min(q.limit ?? 50, 200);
  const offset = q.offset ?? 0;

  const [allPatients, total] = await Promise.all([
    listDentalPatientsWithPerson(db, filters, { pagination: { limit, offset } }),
    countDentalPatientsWithPerson(db, filters),
  ]);

  // Batch visit counts + last visit for all patients in one query
  const patientIds = allPatients.map(p => p.id);
  const visitStats = await getVisitStatsForPatients(db, patientIds);

  const visitMap = new Map(visitStats.map(v => [v.patientId, v]));

  const mapped = allPatients.map(p => {
    const person = p.person;
    const firstName = person?.firstName ?? '';
    const lastName = person?.lastName ?? '';
    const stats = visitMap.get(p.id);
    return {
      id: p.id,
      displayName: [firstName, lastName].filter(Boolean).join(' ') || 'Unknown',
      dateOfBirth: person?.dateOfBirth ?? null,
      gender: person?.gender ?? null,
      preferredBranchId: p.preferredBranchId ?? null,
      needsFollowUp: p.needsFollowUp ?? false,
      hasActivePaymentPlan: p.hasActivePaymentPlan ?? false,
      status: p.status ?? 'active',
      recallDate: p.recallDate ?? null,
      visitCount: stats?.visitCount ?? 0,
      lastVisit: stats?.lastVisit ?? null,
      createdAt: p.createdAt,
      person,
    };
  });

  logger?.info({ action: 'listDentalPatients', filters, count: mapped.length }, 'Dental patients listed');

  return ctx.json({ data: mapped, pagination: buildPaginationMeta(mapped, total, limit, offset) }, 200);
}
