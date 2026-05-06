/**
 * usePatients — TanStack Query hook for the patient list
 *
 * Replaces the inline useEffect + fetch in patients.tsx.
 * Supports filtering by branchId, searchQuery, status, and needsFollowUp.
 *
 * API: GET /dental/patients?branchId=&q=&status=&needsFollowUp=
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';
import type { PatientCardData } from '../components/patient-folder-card';
import type { ToothState } from '@/features/workspace/components/dental-chart.helpers';

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

  const query = useQuery({
    queryKey: ['dental-patients', { branchId, searchQuery, status, needsFollowUp }],
    queryFn: async (): Promise<PatientCardData[]> => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      if (searchQuery) params.set('q', searchQuery);
      if (status && status !== 'all') params.set('status', status);
      if (needsFollowUp) params.set('needsFollowUp', 'true');

      const qs = params.toString();
      const url = `${apiBaseUrl}/dental/patients${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });

      if (!res.ok) {
        throw new Error(`Failed to fetch patients (${res.status})`);
      }

      const data = await res.json();
      const items: RawPatient[] = Array.isArray(data)
        ? data
        : (data.patients ?? data.data ?? data.items ?? []);

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
