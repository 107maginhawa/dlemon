/**
 * useDuplicatePatients — P2-16 duplicate-patient detection
 *
 * Fetches likely-duplicate patient clusters in a branch for staff to review/merge.
 *
 * API: GET /dental/patients/duplicates?branchId=...
 */
import { useQuery } from '@tanstack/react-query';
import {
  detectDuplicatePatientsOptions,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalPatientModuleDuplicateCandidatesResponse } from '@monobase/sdk-ts/generated';

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

function toData(raw: DentalPatientModuleDuplicateCandidatesResponse): DuplicateCandidatesData {
  return {
    groups: raw.groups.map((g) => ({
      matchType: g.matchType as 'strong' | 'name',
      matchKey: g.matchKey,
      patients: g.patients.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        dateOfBirth: p.dateOfBirth,
        email: p.email,
        phone: p.phone,
        createdAt: p.createdAt,
      })),
    })),
    groupCount: raw.groupCount,
  };
}

export function useDuplicatePatients({ branchId }: { branchId: string | null }) {
  const query = useQuery({
    ...detectDuplicatePatientsOptions({ query: { branchId: branchId! } }),
    enabled: !!branchId,
    select: (data): DuplicateCandidatesData => toData(data),
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
