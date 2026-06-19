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
import {
  getBranchSettingsOptions,
  getBranchSettingsQueryKey,
  updateBranchSettingsMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalOrgModuleDentalBranchSettings } from '@monobase/sdk-ts/generated';

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
  // BR-048: clinic-wide default payment terms (days). Feeds dueDate at issue.
  defaultPaymentTermsDays?: number;
  // BR-050: dunning reminder cadence — days-past-due offsets for the sweep.
  billingReminderOffsetDays?: number[];
  // BR-054: PH tax mode. non_vat (default) → no invoice tax; vat_registered → 12% VAT.
  taxMode?: 'non_vat' | 'vat_registered';
  vatRate?: number;
  // BR-055: BIR receipt header fields (PH).
  registeredName?: string;
  businessStyle?: string;
  tin?: string;
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

// The API returns the ENVELOPE `{ branchId, settings: { ...bag } }` — the settings
// bag is nested under `.settings`, not spread flat on the response. We unwrap it
// here so the panels (clinic/fee/locale/working-hours/notifications) read their
// fields off the bag (`settings.clinicName`) rather than off the envelope (where
// those keys are undefined). Saving sends the bag's keys directly, which the
// handler merges — the round-trip only broke on READ before this unwrap.
function toSettings(raw: DentalOrgModuleDentalBranchSettings): BranchSettings {
  const bag = (raw as { settings?: Record<string, unknown> })?.settings;
  return (bag ?? {}) as BranchSettings;
}

export function branchSettingsKey(branchId: string | null) {
  return branchId
    ? getBranchSettingsQueryKey({ path: { branchId } })
    : (['branch-settings', null] as const);
}

export function useBranchSettings(branchId: string | null) {
  const query = useQuery({
    ...getBranchSettingsOptions({ path: { branchId: branchId! } }),
    enabled: !!branchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    select: (data): BranchSettings => toSettings(data),
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}

export function useUpdateBranchSettings(branchId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...updateBranchSettingsMutation(),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: getBranchSettingsQueryKey({ path: { branchId } }),
        });
      }
    },
  });

  return {
    update: (settings: Partial<BranchSettings>) => {
      if (!branchId) return Promise.reject(new Error('No branch selected'));
      return mutation.mutateAsync({
        path: { branchId },
        body: settings as DentalOrgModuleDentalBranchSettings,
      });
    },
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}
