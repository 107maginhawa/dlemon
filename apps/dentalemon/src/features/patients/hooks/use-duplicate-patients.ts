/**
 * useDuplicatePatients — P2-16 duplicate-patient detection
 *
 * Fetches likely-duplicate patient clusters in a branch for staff to review/merge.
 *
 * API: GET /dental/patients/duplicates?branchId=...
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

export interface DuplicateCandidatePatient {
  id: string;
  displayName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

export interface DuplicateCandidateGroup {
  matchType: 'strong' | 'name';
  matchKey: string;
  patients: DuplicateCandidatePatient[];
}

export interface DuplicateCandidatesData {
  groups: DuplicateCandidateGroup[];
  groupCount: number;
}

export function useDuplicatePatients({ branchId }: { branchId: string | null }) {
  const query = useQuery({
    queryKey: ['dental-duplicate-patients', branchId],
    queryFn: async (): Promise<DuplicateCandidatesData> => {
      if (!branchId) throw new Error('branchId is required');
      const res = await fetch(`${apiBaseUrl}/dental/patients/duplicates?branchId=${branchId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to fetch duplicate candidates (${res.status})`);
      return res.json();
    },
    enabled: !!branchId,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
