/**
 * listDentalPatients — GET /dental/patients
 *
 * FR2.1: List patients with pagination and branchId filter
 * FR2.2: Search patients by name (q param)
 * FR2.10: Filter by follow-up indicator (needsFollowUp=true)
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';

export async function listDentalPatients(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.query();

  const filters: Record<string, any> = {};
  if (q.branchId) filters.branchId = q.branchId;
  if (q.q) filters.q = q.q;
  if (q.needsFollowUp === 'true') filters.needsFollowUp = true;
  if (q.status) filters.status = q.status;

  const limit = Math.min(parseInt(q.limit ?? '50', 10) || 50, 200);
  const offset = parseInt(q.offset ?? '0', 10) || 0;

  const repo = new PatientRepository(db, logger);
  const allPatients = await repo.findManyWithPerson(filters, { pagination: { limit, offset } });

  // Apply status filter (not yet in base repo)
  const filtered = q.status
    ? allPatients.filter((p: any) => p.status === q.status)
    : allPatients;

  const mapped = filtered.map((p: any) => {
    const person = p.person as any;
    const firstName = person?.firstName ?? '';
    const lastName = person?.lastName ?? '';
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
      createdAt: p.createdAt,
      person,
    };
  });

  logger?.info({ action: 'listDentalPatients', filters, count: mapped.length }, 'Dental patients listed');

  return ctx.json({ patients: mapped, total: mapped.length, limit, offset }, 200);
}
