/**
 * exportDentalPatients — GET /dental/patients/export
 *
 * FR2.8: Export patient data as CSV or JSON.
 * Query params: format=csv|json, branchId=..., status=...
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

function toCSV(patients: any[]): string {
  const headers = ['id', 'displayName', 'dateOfBirth', 'gender', 'status', 'needsFollowUp', 'hasActivePaymentPlan', 'recallDate', 'createdAt'];
  const rows = patients.map(p => {
    const person = p.person as any;
    const firstName = person?.firstName ?? '';
    const lastName = person?.lastName ?? '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ');
    return [
      p.id,
      `"${displayName.replace(/"/g, '""')}"`,
      person?.dateOfBirth ?? '',
      person?.gender ?? '',
      p.status ?? 'active',
      p.needsFollowUp ? 'true' : 'false',
      p.hasActivePaymentPlan ? 'true' : 'false',
      (p as any).recallDate ?? '',
      p.createdAt ? new Date(p.createdAt).toISOString() : '',
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

export async function exportDentalPatients(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.query();

  // Branch-level authorization
  if (q.branchId) {
    await assertBranchAccess(db, user.id, q.branchId);
  }

  const format = q.format === 'csv' ? 'csv' : 'json';
  const filters: Record<string, any> = {};
  if (q.branchId) filters.branchId = q.branchId;
  if (q.q) filters.q = q.q;

  const repo = new PatientRepository(db, logger);
  // Fetch up to 10k for export
  const patients = await repo.findManyWithPerson(filters, { pagination: { limit: 10000, offset: 0 } });

  const statusFilter = q.status;
  const filtered = statusFilter
    ? patients.filter((p: any) => p.status === statusFilter)
    : patients;

  logger?.info({ action: 'exportDentalPatients', format, count: filtered.length }, 'Patient export requested');

  if (format === 'csv') {
    const csv = toCSV(filtered);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="patients.csv"',
      },
    });
  }

  return ctx.json({ patients: filtered, exportedAt: new Date().toISOString(), total: filtered.length }, 200);
}
