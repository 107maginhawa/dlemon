/**
 * useTreatmentTemplates — branch-scoped treatment-template CRUD (FR1.8).
 *
 * Wraps the generated SDK hooks for the contract-correct endpoints:
 *   GET    /dental/treatment-templates?branchId=...   (list, { templates: [...] })
 *   POST   /dental/treatment-templates                (create — branchId in body)
 *   PATCH  /dental/treatment-templates/{id}            (update)
 *   DELETE /dental/treatment-templates/{id}            (soft-delete: active=false)
 *
 * The list query param `branchId` was added in the FIX-001 completion reconcile
 * (without it the SDK could not send the param the handler requires). Write
 * mutations invalidate the list cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listTreatmentTemplatesOptions,
  listTreatmentTemplatesQueryKey,
  createTreatmentTemplateMutation,
  updateTreatmentTemplateMutation,
  deleteTreatmentTemplateMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  TreatmentTemplate,
  TemplateTreatmentItem,
  CreateTreatmentTemplateRequest,
  UpdateTreatmentTemplateRequest,
} from '@monobase/sdk-ts/generated';

export type { TreatmentTemplate, TemplateTreatmentItem };
/** Create input minus branchId — the hook injects it from the active branch. */
export type CreateTreatmentTemplateInput = Omit<CreateTreatmentTemplateRequest, 'branchId'>;
export type UpdateTreatmentTemplateInput = UpdateTreatmentTemplateRequest;

export function treatmentTemplatesKey(branchId: string) {
  return listTreatmentTemplatesQueryKey({ query: { branchId } });
}

export function useTreatmentTemplates(branchId: string) {
  const query = useQuery({
    ...listTreatmentTemplatesOptions({ query: { branchId } }),
    enabled: !!branchId,
    staleTime: 30_000,
    select: (data): TreatmentTemplate[] => data?.templates ?? [],
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useTreatmentTemplateMutations(branchId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: treatmentTemplatesKey(branchId) });

  const createMut = useMutation({ ...createTreatmentTemplateMutation(), onSuccess: invalidate });
  const updateMut = useMutation({ ...updateTreatmentTemplateMutation(), onSuccess: invalidate });
  const deleteMut = useMutation({ ...deleteTreatmentTemplateMutation(), onSuccess: invalidate });

  return {
    create: (body: CreateTreatmentTemplateInput) =>
      createMut.mutateAsync({ body: { ...body, branchId } }),
    update: (id: string, body: UpdateTreatmentTemplateInput) =>
      updateMut.mutateAsync({ path: { id }, body }),
    remove: (id: string) =>
      deleteMut.mutateAsync({ path: { id } }),

    isMutating: createMut.isPending || updateMut.isPending || deleteMut.isPending,
    mutationError: (createMut.error ?? updateMut.error ?? deleteMut.error) as Error | null,
    resetMutations: () => { createMut.reset(); updateMut.reset(); deleteMut.reset(); },
  };
}
