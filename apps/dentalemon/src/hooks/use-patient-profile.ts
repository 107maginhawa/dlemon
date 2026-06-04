/**
 * usePatientProfile — TanStack Query hook for a single patient's profile (PROF-01)
 *
 * Fetches demographics, contact info, and summary stats for one patient.
 *
 * API: GET /dental/patients/:patientId
 */
import { useQuery } from '@tanstack/react-query';
import { getDentalPatientOptions } from '@monobase/sdk-ts/generated/react-query';

// ─── Raw API shape ─────────────────────────────────────────────────────────

export interface RawPatientDetail {
  id: string;
  displayName: string | null;
  person: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender?: string;
    phone?: string;
    email?: string;
  } | null;
  visitCount: number;
  lastVisit: string | null;
  nextAppointment?: string | null;
  hasBalance: boolean;
  hasActivePaymentPlan: boolean;
  balanceCents?: number;
  status?: string;
}

// ─── Normalized shape ──────────────────────────────────────────────────────

export interface PatientProfileData {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number;
  gender: string | null;
  phone: string | null;
  email: string | null;
  visitCount: number;
  lastVisit: Date | null;
  nextAppointment: Date | null;
  hasBalance: boolean;
  balanceCents: number;
  status: 'active' | 'archived' | 'in-session';
}

// ─── Pure transform ────────────────────────────────────────────────────────

export function toPatientProfile(raw: RawPatientDetail): PatientProfileData {
  const person = raw.person ?? null;
  const firstName = person?.firstName ?? '';
  const lastName = person?.lastName ?? '';
  const dob = person?.dateOfBirth ?? null;

  const displayName =
    raw.displayName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    'Unknown Patient';

  let age = 0;
  if (dob) {
    const dobDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - dobDate.getFullYear();
    if (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate())) {
      age--;
    }
  }

  return {
    id: raw.id,
    displayName,
    firstName,
    lastName,
    dateOfBirth: dob,
    age,
    gender: person?.gender ?? null,
    phone: person?.phone ?? null,
    email: person?.email ?? null,
    visitCount: raw.visitCount ?? 0,
    lastVisit: raw.lastVisit ? new Date(raw.lastVisit) : null,
    nextAppointment: raw.nextAppointment ? new Date(raw.nextAppointment) : null,
    hasBalance: raw.hasBalance || raw.hasActivePaymentPlan || false,
    balanceCents: raw.balanceCents ?? 0,
    status: (raw.status as PatientProfileData['status']) ?? 'active',
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────

interface UsePatientProfileOptions {
  patientId: string;
}

export function usePatientProfile({ patientId }: UsePatientProfileOptions) {
  const query = useQuery({
    ...getDentalPatientOptions({ path: { id: patientId } }),
    select: (data) => toPatientProfile(data as unknown as RawPatientDetail),
    enabled: !!patientId,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
