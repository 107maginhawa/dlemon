/**
 * useHousehold — P1-27 household / guarantor (family file)
 *
 * Fetches the household a patient belongs to, for the patient-profile surface.
 * A 404 (patient not in any household) resolves to `null` rather than an error.
 *
 * API: GET /dental/patients/:patientId/household
 */
import { useQuery } from '@tanstack/react-query';
import { getPatientHousehold } from '@monobase/sdk-ts/generated';
import { getPatientHouseholdQueryKey } from '@monobase/sdk-ts/generated/react-query';
import type { DentalPatientFinanceModuleHouseholdWithMembers } from '@monobase/sdk-ts/generated';

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

function toHousehold(raw: DentalPatientFinanceModuleHouseholdWithMembers): HouseholdWithMembers {
  const h = raw.household;
  return {
    household: {
      id: h.id,
      branchId: h.branchId,
      name: h.name,
      guarantorPatientId: h.guarantorPatientId,
      notes: h.notes,
    },
    members: raw.members.map((m) => ({
      id: m.id,
      householdId: m.householdId,
      patientId: m.patientId,
      relationship: m.relationship,
      isGuarantor: m.isGuarantor,
    })),
  };
}

export function useHousehold({ patientId }: { patientId: string | null }) {
  const query = useQuery({
    queryKey: patientId
      ? getPatientHouseholdQueryKey({ path: { patientId } })
      : ['dental-household', null],
    queryFn: async (): Promise<HouseholdWithMembers | null> => {
      if (!patientId) throw new Error('patientId is required');
      // Use throwOnError: false so we can inspect the response status for 404→null
      // without depending on the SdkError interceptor being installed in all test envs.
      const result = await getPatientHousehold({
        path: { patientId },
        throwOnError: false,
      });
      // 204 (no household) or 404 (legacy) = patient simply isn't in a
      // household — a normal, non-error state, not a fetch failure.
      const status = result.response?.status;
      if (status === 204 || status === 404) return null;
      if (result.error) {
        // Re-throw non-404 errors so TanStack Query sets error state
        const status = result.response?.status;
        const msg = (result.error as { message?: string })?.message;
        throw new Error(msg ?? (status ? `Failed to fetch household (${status})` : 'Failed to fetch household'));
      }
      const raw = result.data as DentalPatientFinanceModuleHouseholdWithMembers | null;
      if (!raw || !('household' in raw)) return null;
      return toHousehold(raw);
    },
    enabled: !!patientId,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
