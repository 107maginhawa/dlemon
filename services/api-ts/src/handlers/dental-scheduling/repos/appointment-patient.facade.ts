/**
 * appointment-patient.facade.ts
 *
 * Joins dental appointments with patient/person data for display.
 * Isolated here so dental-scheduling handlers never import cross-module schemas directly.
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalAppointments } from './dental-appointment.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import type { AppointmentWithPatientName } from './dental-appointment.repo';

export async function getAppointmentWithPatientName(
  db: DatabaseInstance,
  id: string,
): Promise<AppointmentWithPatientName | null> {
  const [row] = await db
    .select({
      id: dentalAppointments.id,
      patientId: dentalAppointments.patientId,
      dentistMemberId: dentalAppointments.dentistMemberId,
      branchId: dentalAppointments.branchId,
      scheduledAt: dentalAppointments.scheduledAt,
      durationMinutes: dentalAppointments.durationMinutes,
      serviceType: dentalAppointments.serviceType,
      operatoryId: dentalAppointments.operatoryId,
      walkIn: dentalAppointments.walkIn,
      status: dentalAppointments.status,
      checkInTime: dentalAppointments.checkInTime,
      visitId: dentalAppointments.visitId,
      notes: dentalAppointments.notes,
      cancelledAt: dentalAppointments.cancelledAt,
      cancellationReason: dentalAppointments.cancellationReason,
      noShowAt: dentalAppointments.noShowAt,
      createdAt: dentalAppointments.createdAt,
      updatedAt: dentalAppointments.updatedAt,
      createdBy: dentalAppointments.createdBy,
      updatedBy: dentalAppointments.updatedBy,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(dentalAppointments)
    .leftJoin(patients, eq(patients.id, dentalAppointments.patientId))
    .leftJoin(persons, eq(persons.id, patients.person))
    .where(eq(dentalAppointments.id, id));
  if (!row) return null;
  const { firstName, lastName, ...appt } = row;
  return { ...appt, patientName: firstName ? [firstName, lastName].filter(Boolean).join(' ') : undefined } as AppointmentWithPatientName;
}

export async function listAppointmentsWithPatientName(
  db: DatabaseInstance,
  conditions: (SQL<unknown> | undefined)[],
  limit: number,
  offset: number,
): Promise<AppointmentWithPatientName[]> {
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: dentalAppointments.id,
      patientId: dentalAppointments.patientId,
      dentistMemberId: dentalAppointments.dentistMemberId,
      branchId: dentalAppointments.branchId,
      scheduledAt: dentalAppointments.scheduledAt,
      durationMinutes: dentalAppointments.durationMinutes,
      serviceType: dentalAppointments.serviceType,
      operatoryId: dentalAppointments.operatoryId,
      walkIn: dentalAppointments.walkIn,
      status: dentalAppointments.status,
      checkInTime: dentalAppointments.checkInTime,
      visitId: dentalAppointments.visitId,
      notes: dentalAppointments.notes,
      cancelledAt: dentalAppointments.cancelledAt,
      cancellationReason: dentalAppointments.cancellationReason,
      noShowAt: dentalAppointments.noShowAt,
      createdAt: dentalAppointments.createdAt,
      updatedAt: dentalAppointments.updatedAt,
      createdBy: dentalAppointments.createdBy,
      updatedBy: dentalAppointments.updatedBy,
      firstName: persons.firstName,
      lastName: persons.lastName,
    })
    .from(dentalAppointments)
    .leftJoin(patients, eq(patients.id, dentalAppointments.patientId))
    .leftJoin(persons, eq(persons.id, patients.person))
    .where(where)
    .limit(limit)
    .offset(offset);
  return rows.map(({ firstName, lastName, ...appt }) => ({
    ...appt,
    patientName: firstName ? [firstName, lastName].filter(Boolean).join(' ') : undefined,
  })) as AppointmentWithPatientName[];
}
