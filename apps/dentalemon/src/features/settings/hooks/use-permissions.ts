/**
 * usePermissionGrid — GET /dental/org/permissions?organizationId=
 * useUpdatePermissions — PUT overrides
 *
 * Backs the granular feature-permission grid (P2-17).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPermissionGridOptions,
  getPermissionGridQueryKey,
  updatePermissionsMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalOrgModulePermissionGridResponse,
  DentalOrgModulePermissionOverrideInput,
} from '@monobase/sdk-ts/generated';

export interface PermissionCatalogEntry {
  feature: string;
  label: string;
  category: string;
  defaultAllowedRoles: string[];
}

export interface PermissionGridCell {
  role: string;
  feature: string;
  allowed: boolean;
  source: 'override' | 'default';
}

export interface PermissionGrid {
  organizationId: string;
  catalog: PermissionCatalogEntry[];
  cells: PermissionGridCell[];
}

export interface PermissionOverrideInput {
  role: string;
  feature: string;
  allowed: boolean;
}

export function permissionGridKey(orgId: string | null) {
  return orgId
    ? getPermissionGridQueryKey({ query: { organizationId: orgId } })
    : (['permission-grid', null] as const);
}

// PermissionGrid is a view-model alias; cast via intersection so tsc still checks
// SDK-modelled fields and doesn't silently miss contract drift.
type PermissionGridCompat = DentalOrgModulePermissionGridResponse & PermissionGrid;

function toGrid(raw: DentalOrgModulePermissionGridResponse): PermissionGrid {
  return raw as PermissionGridCompat;
}

export function usePermissionGrid(orgId: string | null) {
  const query = useQuery({
    ...getPermissionGridOptions({ query: { organizationId: orgId ?? undefined } }),
    enabled: !!orgId,
    staleTime: 30_000,
    select: (data): PermissionGrid => toGrid(data),
  });
  return {
    grid: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useUpdatePermissions(orgId: string | null) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...updatePermissionsMutation(),
    onSuccess: (raw) => {
      const grid = toGrid(raw as DentalOrgModulePermissionGridResponse);
      queryClient.setQueryData(permissionGridKey(orgId), grid);
    },
  });
  return {
    save: (overrides: PermissionOverrideInput[]) =>
      mutation.mutateAsync({
        ...(orgId ? { query: { organizationId: orgId } } : {}),
        body: { overrides: overrides as DentalOrgModulePermissionOverrideInput[] },
      }),
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
