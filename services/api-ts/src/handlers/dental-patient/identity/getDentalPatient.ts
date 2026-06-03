/**
 * getDentalPatient — GET /dental/patients/:id
 *
 * FR2.4: Patient profile with visit count, outstanding balance, last visit date,
 *        emergency contact (FR2.16), communication preferences (FR2.17),
 *        recall date (FR2.18), and safety floor data (FR2.15).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getDentalPatientWithPerson } from '../../patient/repos/patient-dental-patient.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { eq, desc, and } from 'drizzle-orm';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { dentalInvoices } from '../../dental-billing/repos/dental-invoice.schema';
import { medicalHistoryEntries } from '../../dental-clinical/repos/medical-history.schema';
import { logAuditEvent } from '@/core/audit-logger';
import type { GetDentalPatientParams } from '@/generated/openapi/validators';

export async function getDentalPatient(
  ctx: ValidatedContext<never, never, GetDentalPatientParams>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getDentalPatientWithPerson(db, patientId);

  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchAccess(db, user.id, patient.preferredBranchId);

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
    .where(eq(dentalInvoices.patientId, patientId));

  const outstandingCents = invoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + (inv.balanceCents ?? 0), 0);

  const person = patient.person;
  const firstName = person?.firstName ?? '';
  const lastName = person?.lastName ?? '';

  // V-PAT-007 / AC-PAT-003: safety-floor aggregation on the profile endpoint.
  const safetyEntries = await db
    .select()
    .from(medicalHistoryEntries)
    .where(
      and(
        eq(medicalHistoryEntries.patientId, patientId),
        eq(medicalHistoryEntries.active, true)
      )
    );
  const allergyCount = safetyEntries.filter(e => e.entryType === 'allergy').length;
  const medicationCount = safetyEntries.filter(e => e.entryType === 'medication').length;
  const conditionCount = safetyEntries.filter(e => e.entryType === 'condition').length;
  const safetyFloor = {
    hasAlerts: allergyCount > 0,
    allergyCount,
    medicationCount,
    conditionCount,
  };

  logger?.info({ action: 'getDentalPatient', patientId }, 'Dental patient profile retrieved');

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.view',
    resourceType: 'dental_patient',
    resourceId: patientId,
  });

  return ctx.json({
    id: patient.id,
    displayName: [firstName, lastName].filter(Boolean).join(' ') || 'Unknown',
    dateOfBirth: person?.dateOfBirth ?? null,
    gender: person?.gender ?? null,
    preferredBranchId: patient.preferredBranchId ?? null,
    dentalHistorySummary: patient.dentalHistorySummary ?? null,
    needsFollowUp: patient.needsFollowUp ?? false,
    hasActivePaymentPlan: patient.hasActivePaymentPlan ?? false,
    status: patient.status ?? 'active',
    archivedAt: patient.archivedAt ?? null,
    emergencyContact: patient.emergencyContact ?? null,
    communicationPreferences: patient.communicationPreferences ?? null,
    recallDate: patient.recallDate ?? null,
    recallNote: patient.recallNote ?? null,
    // Aggregated data
    visitCount,
    lastVisit,
    outstandingBalanceCents: outstandingCents,
    // V-PAT-007: safety floor + follow-up notes + consent on the profile.
    safetyFloor,
    followUpNotes: patient.followUpNotes ?? [],
    consent: (person as any)?.consent ?? null,
    // V-PAT-014: return a DECLARED subset of person — never spread the full
    // person row (which carries undeclared PII: contactInfo, primaryAddress…).
    person: {
      id: person?.id ?? null,
      firstName,
      lastName: lastName || null,
      dateOfBirth: person?.dateOfBirth ?? null,
      gender: person?.gender ?? null,
    },
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  }, 200);
}
