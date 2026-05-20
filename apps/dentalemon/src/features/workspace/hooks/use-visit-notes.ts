/**
 * useVisitNotes — TanStack Query hook for SOAP visit notes
 *
 * API:
 *   GET    /dental/visits/:visitId/notes
 *   PUT    /dental/visits/:visitId/notes
 *   POST   /dental/visits/:visitId/notes/sign
 *   POST   /dental/visits/:visitId/notes/addendum
 *   GET    /dental/visits/:visitId/notes/history
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVisitNotesOptions,
  getVisitNotesQueryKey,
  upsertVisitNotesMutation,
  signVisitNotesMutation,
  createVisitNoteAddendumMutation,
  getVisitNoteHistoryOptions,
  getVisitNoteHistoryQueryKey,
} from '@monobase/sdk-ts/generated/react-query';

export function useVisitNotes(visitId: string | null) {
  const queryClient = useQueryClient();

  const notesQuery = useQuery({
    ...getVisitNotesOptions({ path: { visitId: visitId as string } }),
    enabled: !!visitId,
  });

  const historyQuery = useQuery({
    ...getVisitNoteHistoryOptions({ path: { visitId: visitId as string } }),
    enabled: !!visitId,
  });

  const saveMutation = useMutation({
    ...upsertVisitNotesMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getVisitNotesQueryKey({ path: { visitId: visitId as string } }),
      });
    },
  });

  const signMutation = useMutation({
    ...signVisitNotesMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getVisitNotesQueryKey({ path: { visitId: visitId as string } }),
      });
      queryClient.invalidateQueries({
        queryKey: getVisitNoteHistoryQueryKey({ path: { visitId: visitId as string } }),
      });
    },
  });

  const addendumMutation = useMutation({
    ...createVisitNoteAddendumMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getVisitNoteHistoryQueryKey({ path: { visitId: visitId as string } }),
      });
    },
  });

  return {
    notes: notesQuery.data ?? null,
    isLoading: notesQuery.isLoading,
    error: notesQuery.error,
    history: historyQuery.data ?? [],
    isLoadingHistory: historyQuery.isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    sign: signMutation.mutate,
    isSigning: signMutation.isPending,
    addendum: addendumMutation.mutate,
    isAddingAddendum: addendumMutation.isPending,
  };
}
