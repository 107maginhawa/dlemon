/**
 * useMedicalHistory — TanStack Query hooks for patient medical history
 *
 * API:
 *   GET  /dental/clinical/medical-history?patientId=  → { items, total }
 *   POST /dental/clinical/medical-history             → create entry
 *   PATCH /dental/clinical/medical-history/{entryId}  → update entry (toggle active, add notes)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listMedicalHistoryOptions,
  listMedicalHistoryQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import {
  createMedicalHistoryEntry,
  updateMedicalHistoryEntry,
} from '@monobase/sdk-ts/generated';

export type MedicalHistoryEntryType =
  | 'condition'
  | 'medication'
  | 'allergy'
  | 'procedure'
  | 'vaccination'
  | 'family_history';

export interface MedicalHistoryEntry {
  id: string;
  patientId: string;
  entryType: MedicalHistoryEntryType;
  codeSystem?: string | null;
  code?: string | null;
  displayName: string;
  notes?: string | null;
  onsetDate?: string | null;
  resolvedDate?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntryInput {
  patientId: string;
  entryType: MedicalHistoryEntryType;
  displayName: string;
  codeSystem?: string;
  code?: string;
  notes?: string;
}

export interface UpdateEntryInput {
  active?: boolean;
  notes?: string;
  displayName?: string;
  resolvedDate?: string;
}

export function medicalHistoryKey(patientId: string) {
  return listMedicalHistoryQueryKey({ query: { patientId } });
}

export function useMedicalHistory(patientId: string) {
  const query = useQuery({
    ...listMedicalHistoryOptions({ query: { patientId } }),
    enabled: !!patientId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    select: (data) => {
      const raw = data as unknown as { data?: MedicalHistoryEntry[] } | MedicalHistoryEntry[];
      return Array.isArray(raw) ? raw : (raw?.data ?? []);
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useMedicalHistoryMutations(patientId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: listMedicalHistoryQueryKey({ query: { patientId } }) });

  const addMutation = useMutation({
    mutationFn: async (input: CreateEntryInput): Promise<MedicalHistoryEntry> => {
      const { data } = await createMedicalHistoryEntry({
        body: input as Parameters<typeof createMedicalHistoryEntry>[0]['body'],
        throwOnError: true,
      });
      return data as unknown as MedicalHistoryEntry;
    },
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ entryId, active }: { entryId: string; active: boolean }): Promise<MedicalHistoryEntry> => {
      const { data } = await updateMedicalHistoryEntry({
        path: { entryId },
        body: { active } as Parameters<typeof updateMedicalHistoryEntry>[0]['body'],
        throwOnError: true,
      });
      return data as unknown as MedicalHistoryEntry;
    },
    onSuccess: invalidate,
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ entryId, patch }: { entryId: string; patch: UpdateEntryInput }): Promise<MedicalHistoryEntry> => {
      const { data } = await updateMedicalHistoryEntry({
        path: { entryId },
        body: patch as Parameters<typeof updateMedicalHistoryEntry>[0]['body'],
        throwOnError: true,
      });
      return data as unknown as MedicalHistoryEntry;
    },
    onSuccess: invalidate,
  });

  return {
    addEntry: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    addError: addMutation.error as Error | null,

    toggleEntry: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,

    updateEntry: updateNotesMutation.mutateAsync,
    isSaving: addMutation.isPending || updateNotesMutation.isPending,
    saveError: (addMutation.error ?? updateNotesMutation.error) as Error | null,
  };
}
