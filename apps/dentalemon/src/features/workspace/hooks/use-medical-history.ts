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
  type MedicalHistoryEntry,
  type MedicalHistoryEntryType,
  type CreateMedicalHistoryEntryRequest,
  type UpdateMedicalHistoryEntryRequest,
} from '@monobase/sdk-ts/generated';

// Cause-fix (oli QA_ESCAPES §6): the entry type + entry-type enum were hand-rolled
// duplicates of the SDK; the request inputs were subsets of the SDK request types.
// Alias all of them for a single source of truth — no local re-declaration, no
// `as unknown as`/`as Parameters<…>` casts.
export type { MedicalHistoryEntry, MedicalHistoryEntryType };
export type CreateEntryInput = CreateMedicalHistoryEntryRequest;
export type UpdateEntryInput = UpdateMedicalHistoryEntryRequest;

export function medicalHistoryKey(patientId: string) {
  return listMedicalHistoryQueryKey({ query: { patientId } });
}

export function useMedicalHistory(patientId: string) {
  const query = useQuery({
    ...listMedicalHistoryOptions({ query: { patientId } }),
    enabled: !!patientId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    // SDK response is { data: MedicalHistoryEntry[]; pagination } — no cast needed.
    select: (data) => (Array.isArray(data) ? data : (data?.data ?? [])),
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
    mutationFn: async (input: CreateEntryInput) => {
      const { data } = await createMedicalHistoryEntry({ body: input, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ entryId, active }: { entryId: string; active: boolean }) => {
      const { data } = await updateMedicalHistoryEntry({ path: { entryId }, body: { active }, throwOnError: true });
      return data;
    },
    onSuccess: invalidate,
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ entryId, patch }: { entryId: string; patch: UpdateEntryInput }) => {
      const { data } = await updateMedicalHistoryEntry({ path: { entryId }, body: patch, throwOnError: true });
      return data;
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
