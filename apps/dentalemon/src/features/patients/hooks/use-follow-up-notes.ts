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
import type { DentalPatientModuleFollowUpNote } from '@monobase/sdk-ts/generated';

// ─── Types ────────────────────────────────────────────────────────────────

// Cause-fix (oli QA_ESCAPES §6): this was a hand-rolled duplicate of the SDK note
// type (field-for-field identical, createdAt is a string at runtime — no
// transformer). Alias it for a single source of truth.
export type FollowUpNote = DentalPatientModuleFollowUpNote;

// ─── List hook ────────────────────────────────────────────────────────────

interface UseFollowUpNotesOptions {
  patientId: string;
}

export function useFollowUpNotes({ patientId }: UseFollowUpNotesOptions) {
  const query = useQuery({
    ...listFollowUpNotesOptions({ path: { id: patientId } }),
    // The SDK models the response as { notes: FollowUpNote[]; total } — no cast needed.
    select: (data) =>
      (data?.notes ?? [])
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
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
