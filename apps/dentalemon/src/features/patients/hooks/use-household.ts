/**
 * useHousehold — P1-27 household / guarantor (family file)
 *
 * Fetches the household a patient belongs to, for the patient-profile surface.
 * A 404 (patient not in any household) resolves to `null` rather than an error.
 *
 * API: GET /dental/patients/:patientId/household
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

export interface HouseholdMember {
  id: string;
  householdId: string;
  patientId: string;
  relationship: string;
  isGuarantor: boolean;
}

export interface Household {
  id: string;
  branchId: string;
  name: string;
  guarantorPatientId: string;
  notes: string | null;
}

export interface HouseholdWithMembers {
  household: Household;
  members: HouseholdMember[];
}

export function useHousehold({ patientId }: { patientId: string | null }) {
  const query = useQuery({
    queryKey: ['dental-household', patientId],
    queryFn: async (): Promise<HouseholdWithMembers | null> => {
      if (!patientId) throw new Error('patientId is required');
      const res = await fetch(`${apiBaseUrl}/dental/patients/${patientId}/household`, {
        credentials: 'include',
      });
      // 404 = patient simply isn't in a household — a normal, non-error state.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Failed to fetch household (${res.status})`);
      return res.json();
    },
    enabled: !!patientId,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
