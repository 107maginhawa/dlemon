/**
 * usePatientProfile — TanStack Query hook for a single patient's profile (PROF-01)
 *
 * Fetches demographics, contact info, and summary stats for one patient.
 *
 * API: GET /dental/patients/:patientId
 */
import { useQuery } from '@tanstack/react-query';
import { getDentalPatientOptions } from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPatientModuleDentalPatient,
  DentalPatientModuleDentalPatientPerson,
} from '@monobase/sdk-ts/generated';

// ─── Raw API shape ─────────────────────────────────────────────────────────

// Cause-fix (oli QA_ESCAPES §6): consume the generated SDK patient type intersected
// for the summary-stat enrichments it omits (live-confirmed against
// GET /dental/patients/:id, 2026-06-04: visitCount, lastVisit, outstandingBalanceCents).
// The previous hand-rolled type + `as unknown as` hid a latent name drift: it read
// `balanceCents`, but the API sends `outstandingBalanceCents` (so the value was
// always 0). Contact lives under `person.contactInfo` (the backend source) — the
// SDK person type omits it, so it is intersected here; the legacy flat
// person.phone/email is kept as a fallback for existing fixtures.
type PatientPersonWithContact = DentalPatientModuleDentalPatientPerson & {
  phone?: string | null;
  email?: string | null;
  contactInfo?: { phone?: string | null; email?: string | null } | null;
};

export type RawPatientDetail = Omit<DentalPatientModuleDentalPatient, 'person'> & {
  person?: PatientPersonWithContact | null;
  visitCount?: number;
  lastVisit?: string | null;
  nextAppointment?: string | null;
  outstandingBalanceCents?: number;
};

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
    // Contact comes from person.contactInfo (backend source); fall back to a flat
    // person.phone/email if present.
    phone: person?.contactInfo?.phone ?? person?.phone ?? null,
    email: person?.contactInfo?.email ?? person?.email ?? null,
    visitCount: raw.visitCount ?? 0,
    lastVisit: raw.lastVisit ? new Date(raw.lastVisit) : null,
    nextAppointment: raw.nextAppointment ? new Date(raw.nextAppointment) : null,
    // API field is `outstandingBalanceCents` (not `balanceCents` — the prior name
    // drift meant this was always 0); a positive balance OR an active plan flags it.
    hasBalance: (raw.outstandingBalanceCents ?? 0) > 0 || raw.hasActivePaymentPlan || false,
    balanceCents: raw.outstandingBalanceCents ?? 0,
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
    // Single narrowing `as` (no blind `as unknown as`): the SDK patient type widened
    // to the documented enrichment shape above.
    select: (data) => toPatientProfile(data as RawPatientDetail),
    enabled: !!patientId,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
