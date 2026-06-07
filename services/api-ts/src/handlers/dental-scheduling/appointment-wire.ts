/**
 * appointment-wire.ts — wire <-> DB field mapping for dental appointments.
 *
 * V-SCH-006 / V-SCH-007: the canonical wire contract (API_CONTRACTS.md) uses
 *   providerId / startAt / endAt / visitType
 * while the DB schema retains the historical column names
 *   dentistMemberId / scheduledAt / durationMinutes / serviceType
 * (renaming the columns would require a destructive migration and break
 * cross-module fixtures that insert via the repo). This module is the single
 * place that translates between the two representations so handlers always
 * speak the canonical wire shape on input and output.
 *
 * Duration is derived: durationMinutes = (endAt - startAt) / 60000.
 */

import type { DentalAppointment } from './repos/dental-appointment.schema';

export const VISIT_TYPES = ['checkup', 'treatment', 'emergency', 'recall', 'hygiene'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export function isVisitType(value: unknown): value is VisitType {
  return typeof value === 'string' && (VISIT_TYPES as readonly string[]).includes(value);
}

/** Canonical wire representation of an appointment row. */
export interface AppointmentWire {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  patientId: string;
  providerId: string;
  branchId: string;
  startAt: Date | string;
  endAt: Date | string;
  visitType: string;
  operatoryId: string | null;
  walkIn: boolean;
  status: string;
  confirmedAt: Date | string | null;
  checkInTime: Date | string | null;
  visitId: string | null;
  notes: string | null;
  cancelledAt: Date | string | null;
  cancellationReason: string | null;
  noShowAt: Date | string | null;
  patientName?: string;
  warnings?: string[];
}

/** Compute endAt from a scheduledAt + durationMinutes pair. */
export function computeEndAt(scheduledAt: Date, durationMinutes: number): Date {
  return new Date(scheduledAt.getTime() + durationMinutes * 60_000);
}

/** Derive durationMinutes from startAt/endAt (rounded to nearest minute, min 1). */
export function durationFromRange(startAt: Date, endAt: Date): number {
  const minutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  return minutes > 0 ? minutes : 1;
}

/** Map a DB appointment row (optionally with patientName) to the wire shape. */
export function toWire<T extends Partial<DentalAppointment> & { patientName?: string }>(
  row: T,
  extra?: { warnings?: string[] },
): AppointmentWire {
  const scheduledAt = row.scheduledAt as Date;
  const durationMinutes = (row.durationMinutes as number) ?? 0;
  const endAt = scheduledAt ? computeEndAt(scheduledAt, durationMinutes) : (scheduledAt as unknown as Date);
  return {
    id: row.id as string,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    patientId: row.patientId as string,
    providerId: row.dentistMemberId as string,
    branchId: row.branchId as string,
    startAt: scheduledAt,
    endAt,
    visitType: row.serviceType as string,
    operatoryId: (row.operatoryId as string) ?? null,
    walkIn: (row.walkIn as boolean) ?? false,
    status: row.status as string,
    confirmedAt: (row.confirmedAt as Date) ?? null,
    checkInTime: (row.checkInTime as Date) ?? null,
    visitId: (row.visitId as string) ?? null,
    notes: (row.notes as string) ?? null,
    cancelledAt: (row.cancelledAt as Date) ?? null,
    cancellationReason: (row.cancellationReason as string) ?? null,
    noShowAt: (row.noShowAt as Date) ?? null,
    ...(row.patientName !== undefined ? { patientName: row.patientName } : {}),
    ...(extra?.warnings !== undefined ? { warnings: extra.warnings } : {}),
  };
}
