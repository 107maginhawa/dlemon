/**
 * usePatients — TanStack Query hook for the patient list
 *
 * Replaces the inline useEffect + fetch in patients.tsx.
 * Supports filtering by branchId, searchQuery, status, and needsFollowUp.
 *
 * API: GET /dental/patients?branchId=&q=&status=&needsFollowUp=
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalPatientsOptions } from '@monobase/sdk-ts/generated/react-query';
import type { PatientCardData } from '../components/patient-folder-card';
import type { ToothState } from '@/lib/dental-chart-types';

// ─── Raw API shape ──────────────────────────────────────────────────────────

export interface RawPatient {
  id: string;
  person: {
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  } | null;
  displayName: string | null;
  visitCount: number;
  lastVisit: string | null;
  needsFollowUp: boolean;
  hasBalance: boolean;
  hasActivePaymentPlan: boolean;
  status?: string;
  latestChartTeeth?: Array<{ toothNumber: number; state: string }>;
}

// ─── Pure transform ─────────────────────────────────────────────────────────

export function toPatientCard(p: RawPatient): PatientCardData {
  const person = p.person ?? null;
  const firstName = person?.firstName ?? '';
  const lastName = person?.lastName ?? '';
  const displayName =
    p.displayName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    'Unknown Patient';

  let age = 0;
  const dob = person?.dateOfBirth ?? null;
  if (dob) {
    const dobDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - dobDate.getFullYear();
    if (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate())) {
      age--;
    }
  }

  return {
    id: p.id,
    displayName,
    age,
    lastVisit: p.lastVisit ? new Date(p.lastVisit) : undefined,
    visitCount: p.visitCount ?? 0,
    needsFollowUp: p.needsFollowUp ?? false,
    hasBalance: p.hasBalance || p.hasActivePaymentPlan || false,
    status: (p.status as 'active' | 'archived' | 'in-session') ?? undefined,
    latestChartTeeth: p.latestChartTeeth?.map((t) => ({
      toothNumber: t.toothNumber,
      state: t.state as ToothState,
    })),
  };
}

// ─── Hook options ───────────────────────────────────────────────────────────

export type PatientStatusFilter = 'all' | 'active' | 'archived';

export interface UsePatientsOptions {
  branchId?: string;
  searchQuery?: string;
  status?: PatientStatusFilter;
  needsFollowUp?: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePatients(options: UsePatientsOptions) {
  const { branchId, searchQuery, status, needsFollowUp } = options;

  // branchId is required by the API contract (GET /dental/patients); pass through
  // (empty when unset) to satisfy the generated type — the runtime 400-guard and
  // the caller's branch context handle the unset case.
  const query = useQuery({
    ...listDentalPatientsOptions({
      query: {
        branchId: branchId ?? '',
        q: searchQuery,
        status: status === 'all' ? undefined : status,
        needsFollowUp,
      },
    }),
    select: (data) => {
      const raw = data as Record<string, unknown>;
      const items: RawPatient[] = Array.isArray(data)
        ? data
        : Array.isArray(raw.data)
          ? (raw.data as RawPatient[])
          : Array.isArray(raw.patients)
            ? (raw.patients as RawPatient[])
            : [];
      return items.map(toPatientCard);
    },
  });

  return {
    patients: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
