/**
 * useMedicalHistoryReview — TanStack Query hooks for the ASA classification +
 * periodic re-confirmation record (P1-4).
 *
 * API:
 *   GET  /dental/clinical/medical-history-review?patientId=  → latest review (404 if none)
 *   POST /dental/clinical/medical-history-review             → record a new review
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMedicalHistoryReviewOptions,
  getMedicalHistoryReviewQueryKey,
  recordMedicalHistoryReviewMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { MedicalHistoryReview } from '@monobase/sdk-ts/generated';

export type AsaClassification = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

/** Months after which a medical history is "due for review" (ADA: every 3–6 months). */
export const REVIEW_DUE_MONTHS = 6;

/**
 * Whether a medical history is due for re-confirmation.
 * `reviewedAt` null/undefined → never reviewed → due.
 */
export function isReviewDue(
  reviewedAt: string | Date | null | undefined,
  now: Date = new Date(),
  dueMonths: number = REVIEW_DUE_MONTHS,
): boolean {
  if (!reviewedAt) return true;
  const reviewed = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  if (Number.isNaN(reviewed.getTime())) return true;
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - dueMonths);
  return reviewed.getTime() < threshold.getTime();
}

export function useMedicalHistoryReview(patientId: string) {
  const query = useQuery({
    ...getMedicalHistoryReviewOptions({ query: { patientId } }),
    enabled: !!patientId,
    // 404 (never reviewed) is an expected state, not a hard error — don't retry it.
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const review = (query.data as unknown as MedicalHistoryReview | undefined) ?? null;

  return {
    review,
    isLoading: query.isLoading,
    // A 404 means "never reviewed" → due for review, not a failure to surface.
    reviewDue: isReviewDue(review?.reviewedAt),
  };
}

export interface RecordReviewInput {
  patientId: string;
  asaClassification?: AsaClassification;
  asaEmergency?: boolean;
}

export function useMedicalHistoryReviewMutation(patientId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...recordMedicalHistoryReviewMutation(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: getMedicalHistoryReviewQueryKey({ query: { patientId } }) }),
  });

  return {
    recordReview: (input: RecordReviewInput) =>
      mutation.mutateAsync({
        body: input as Parameters<typeof mutation.mutateAsync>[0]['body'],
      }),
    isRecording: mutation.isPending,
    recordError: mutation.error as Error | null,
  };
}
