/**
 * useFollowUpNotes / useAddFollowUpNote — TanStack Query hooks (FR2.12)
 *
 * Fetches and creates follow-up notes for a patient.
 *
 * API: GET  /dental/patients/:id/follow-up-notes
 *      POST /dental/patients/:id/follow-up-notes
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listFollowUpNotesOptions,
  listFollowUpNotesQueryKey,
  addFollowUpNoteMutation,
} from '@monobase/sdk-ts/generated/react-query';

// ─── Types ────────────────────────────────────────────────────────────────

export interface FollowUpNote {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

// ─── List hook ────────────────────────────────────────────────────────────

interface UseFollowUpNotesOptions {
  patientId: string;
}

export function useFollowUpNotes({ patientId }: UseFollowUpNotesOptions) {
  const query = useQuery({
    ...listFollowUpNotesOptions({ path: { id: patientId } }),
    select: (data) => {
      const raw = data as unknown as { notes?: FollowUpNote[]; total?: number };
      return (raw?.notes ?? [])
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as FollowUpNote[];
    },
    enabled: !!patientId,
  });

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

// ─── Add mutation hook ────────────────────────────────────────────────────

interface UseAddFollowUpNoteOptions {
  patientId: string;
}

export function useAddFollowUpNote({ patientId }: UseAddFollowUpNoteOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...addFollowUpNoteMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listFollowUpNotesQueryKey({ path: { id: patientId } }),
      });
    },
  });

  const addNote = (text: string) => {
    mutation.mutate({
      path: { id: patientId },
      body: { text },
    });
  };

  return {
    addNote,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
