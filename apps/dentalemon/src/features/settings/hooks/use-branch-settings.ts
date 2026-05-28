/**
 * useBranchSettings — TanStack Query hook for GET/PUT branch settings
 *
 * All three settings panels (ClinicSettings, FeeSchedule, LocaleSettings)
 * read from and write to the same endpoint:
 *   GET/PUT /dental/branches/{branchId}/settings
 *
 * One query + one mutation covers all three panels.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

const API = apiBaseUrl;

export interface BranchSettings {
  // Clinic info
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  logoUrl?: string;
  dentistLicenseNumber?: string;
  // Fee schedule
  feeSchedule?: Record<string, number>;
  // Locale
  locale?: string;
  currency?: string;
  toothNotation?: string;
  // Working hours (JSON string)
  workingHours?: string;
  // Notification preferences
  notificationPreferences?: Record<string, unknown>;
  // Any other settings fields
  [key: string]: unknown;
}

interface BranchSettingsResponse {
  settings: BranchSettings;
}

async function fetchBranchSettings(branchId: string): Promise<BranchSettings> {
  const res = await fetch(`${API}/dental/branches/${branchId}/settings`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
  const data: BranchSettingsResponse = await res.json();
  return data.settings ?? {};
}

async function putBranchSettings(branchId: string, settings: Partial<BranchSettings>): Promise<BranchSettings> {
  const res = await fetch(`${API}/dental/branches/${branchId}/settings`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);
  const data = await res.json();
  return data.settings ?? settings;
}

export function branchSettingsKey(branchId: string | null) {
  return ['branch-settings', branchId] as const;
}

export function useBranchSettings(branchId: string | null) {
  const query = useQuery({
    queryKey: branchSettingsKey(branchId),
    queryFn: () => fetchBranchSettings(branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useUpdateBranchSettings(branchId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (settings: Partial<BranchSettings>) => {
      if (!branchId) return Promise.reject(new Error('No branch selected'));
      return putBranchSettings(branchId, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: branchSettingsKey(branchId) });
    },
  });

  return {
    update: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}
