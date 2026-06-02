/**
 * usePermissionGrid — GET /dental/org/permissions?organizationId=
 * useUpdatePermissions — PUT overrides
 *
 * Backs the granular feature-permission grid (P2-17). Follows the raw-fetch
 * pattern used by the other dental-org settings hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

const API = apiBaseUrl;

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
  return ['permission-grid', orgId] as const;
}

async function fetchGrid(orgId: string): Promise<PermissionGrid> {
  const res = await fetch(`${API}/dental/org/permissions?organizationId=${encodeURIComponent(orgId)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load permissions (${res.status})`);
  return res.json();
}

async function putOverrides(orgId: string, overrides: PermissionOverrideInput[]): Promise<PermissionGrid> {
  const res = await fetch(`${API}/dental/org/permissions?organizationId=${encodeURIComponent(orgId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ overrides }),
  });
  if (!res.ok) {
    let message = `Failed to save permissions (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res.json();
}

export function usePermissionGrid(orgId: string | null) {
  const query = useQuery({
    queryKey: permissionGridKey(orgId),
    queryFn: () => fetchGrid(orgId as string),
    enabled: !!orgId,
    staleTime: 30_000,
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
    mutationFn: (overrides: PermissionOverrideInput[]) => putOverrides(orgId as string, overrides),
    onSuccess: (grid) => {
      queryClient.setQueryData(permissionGridKey(orgId), grid);
    },
  });
  return {
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
