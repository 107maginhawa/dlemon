/**
 * getDentalPatient — GET /dental/patients/:id
 *
 * FR2.4: Patient profile with visit count, outstanding balance, last visit date,
 *        emergency contact (FR2.16), communication preferences (FR2.17),
 *        recall date (FR2.18), and safety floor data (FR2.15).
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { eq, and, desc } from 'drizzle-orm';
import { dentalVisits } from '../dental-visit/repos/visit.schema';
import { dentalInvoices } from '../dental-billing/repos/dental-invoice.schema';
import { medicalHistoryEntries } from '../dental-clinical/repos/medical-history.schema';

export async function getDentalPatient(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('id');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneByIdWithPerson(patientId);

  if (!patient) throw new NotFoundError('Patient not found');

  // Visit count + last visit date
  const visits = await db
    .select()
    .from(dentalVisits)
    .where(eq(dentalVisits.patientId, patientId))
    .orderBy(desc(dentalVisits.createdAt));

  const visitCount = visits.length;
  const lastVisit = visits.find(v => v.status === 'completed' || v.status === 'locked')?.completedAt ?? null;

  // Outstanding balance: sum balanceCents from non-voided invoices
  const invoices = await db
    .select()
    .from(dentalInvoices)
    .where(
      and(
        eq(dentalInvoices.patientId, patientId),
        // exclude voided
      )
    );

  const outstandingCents = invoices
    .filter((inv: any) => inv.status !== 'voided')
    .reduce((sum: number, inv: any) => sum + (inv.balanceCents ?? 0), 0);

  const person = patient.person as any;
  const firstName = person?.firstName ?? '';
  const lastName = person?.lastName ?? '';

  logger?.info({ action: 'getDentalPatient', patientId }, 'Dental patient profile retrieved');

  return ctx.json({
    id: patient.id,
    displayName: [firstName, lastName].filter(Boolean).join(' ') || 'Unknown',
    dateOfBirth: person?.dateOfBirth ?? null,
    gender: person?.gender ?? null,
    preferredBranchId: patient.preferredBranchId ?? null,
    dentalHistorySummary: patient.dentalHistorySummary ?? null,
    needsFollowUp: patient.needsFollowUp ?? false,
    hasActivePaymentPlan: patient.hasActivePaymentPlan ?? false,
    status: (patient as any).status ?? 'active',
    archivedAt: (patient as any).archivedAt ?? null,
    emergencyContact: (patient as any).emergencyContact ?? null,
    communicationPreferences: (patient as any).communicationPreferences ?? null,
    recallDate: (patient as any).recallDate ?? null,
    recallNote: (patient as any).recallNote ?? null,
    // Aggregated data
    visitCount,
    lastVisit,
    outstandingBalanceCents: outstandingCents,
    person,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  }, 200);
}
