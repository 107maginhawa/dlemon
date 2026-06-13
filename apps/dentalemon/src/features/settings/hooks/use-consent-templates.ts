/**
 * useConsentTemplates — branch-scoped consent-template CRUD (FR8.4b).
 *
 * Wraps the generated SDK hooks for the contract-correct endpoints:
 *   GET    /dental/branches/{branchId}/consent-templates
 *   POST   /dental/branches/{branchId}/consent-templates           (owner-only)
 *   PATCH  /dental/branches/{branchId}/consent-templates/{id}       (owner-only)
 *   DELETE /dental/branches/{branchId}/consent-templates/{id}       (owner-only soft-delete)
 *
 * The list response is a bare array (ApiOkResponse<T[]>). Write mutations
 * invalidate the list cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listConsentTemplatesOptions,
  listConsentTemplatesQueryKey,
  createConsentTemplateMutation,
  updateConsentTemplateMutation,
  deleteConsentTemplateMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalOrgModuleDentalConsentTemplate,
  DentalOrgModuleCreateDentalConsentTemplateRequest,
  DentalOrgModuleUpdateDentalConsentTemplateRequest,
} from '@monobase/sdk-ts/generated';

export type ConsentTemplate = DentalOrgModuleDentalConsentTemplate;
export type CreateConsentTemplateInput = DentalOrgModuleCreateDentalConsentTemplateRequest;
export type UpdateConsentTemplateInput = DentalOrgModuleUpdateDentalConsentTemplateRequest;

export function consentTemplatesKey(branchId: string) {
  return listConsentTemplatesQueryKey({ path: { branchId } });
}

export function useConsentTemplates(branchId: string) {
  const query = useQuery({
    ...listConsentTemplatesOptions({ path: { branchId } }),
    enabled: !!branchId,
    staleTime: 30_000,
    select: (data): ConsentTemplate[] => (Array.isArray(data) ? data : []),
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useConsentTemplateMutations(branchId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: consentTemplatesKey(branchId) });

  const createMut = useMutation({ ...createConsentTemplateMutation(), onSuccess: invalidate });
  const updateMut = useMutation({ ...updateConsentTemplateMutation(), onSuccess: invalidate });
  const deleteMut = useMutation({ ...deleteConsentTemplateMutation(), onSuccess: invalidate });

  return {
    create: (body: CreateConsentTemplateInput) =>
      createMut.mutateAsync({ path: { branchId }, body }),
    update: (id: string, body: UpdateConsentTemplateInput) =>
      updateMut.mutateAsync({ path: { branchId, id }, body }),
    remove: (id: string) =>
      deleteMut.mutateAsync({ path: { branchId, id } }),

    isMutating: createMut.isPending || updateMut.isPending || deleteMut.isPending,
    mutationError: (createMut.error ?? updateMut.error ?? deleteMut.error) as Error | null,
    resetMutations: () => { createMut.reset(); updateMut.reset(); deleteMut.reset(); },
  };
}
