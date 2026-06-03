/**
 * exportDentalPatients — GET /dental/patients/export
 *
 * FR2.8: Export patient data as CSV or JSON.
 * Query params: format=csv|json, branchId=..., status=...
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { listDentalPatientsWithPerson } from '../../patient/repos/patient-dental-patient.facade';
import type { PatientWithPerson } from '../../patient/repos/patient.schema';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import type { ExportDentalPatientsQuery } from '@/generated/openapi/validators';

function toCSV(patients: PatientWithPerson[]): string {
  const headers = ['id', 'displayName', 'dateOfBirth', 'gender', 'status', 'needsFollowUp', 'hasActivePaymentPlan', 'recallDate', 'createdAt'];
  const rows = patients.map(p => {
    const person = p.person;
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
      p.recallDate ?? '',
      p.createdAt ? new Date(p.createdAt).toISOString() : '',
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

export async function exportDentalPatients(
  ctx: ValidatedContext<never, ExportDentalPatientsQuery, never>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.valid('query');

  // Branch-level authorization — branchId is required to prevent cross-branch data leaks
  if (!q['branchId']) {
    return new Response(JSON.stringify({ error: 'branchId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  await assertBranchRole(db, user.id, q['branchId'], ['dentist_owner']);

  const format = q['format'] === 'csv' ? 'csv' : 'json';
  const filters: Record<string, any> = {};
  if (q.branchId) filters['branchId'] = q.branchId;

  // Fetch up to 10k for export
  const patients = await listDentalPatientsWithPerson(db, filters, { pagination: { limit: 10000, offset: 0 } });

  const statusFilter = q['status'];
  const filtered = statusFilter
    ? patients.filter(p => p.status === statusFilter)
    : patients;

  logger?.info({ action: 'exportDentalPatients', format, count: filtered.length }, 'Patient export requested');

  // AL-006: PHI export audit trail — persisted to dental_audit + dental_audit_log
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: q['branchId'],
    branchId: q['branchId'],
    action: 'patient.export',
    resourceType: 'dental_patient',
    metadata: { format, count: filtered.length, statusFilter: statusFilter ?? null },
  });

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

  return ctx.json({ data: filtered, exportedAt: new Date().toISOString(), total: filtered.length }, 200);
}
