/**
 * useDentalAlerts — fetch/create/deactivate patient chairside dental alerts
 * (PP-7 sub-slice 1 / ISSUE-042).
 *
 * Dental alerts are patient-scoped chairside safety flags (latex allergy, needle
 * phobia, gag reflex, bleeding disorder, …) — distinct from the medical-history
 * safety floor. Writes invalidate the list query so the sheet + top-bar badges
 * re-render immediately. Mutation failures are surfaced (never swallowed) via toast.
 *
 * API: GET   /dental/patients/:patientId/dental-alerts
 *      POST  /dental/patients/:patientId/dental-alerts
 *      PATCH /dental/patients/:patientId/dental-alerts/:alertId
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDentalAlertsOptions,
  listDentalAlertsQueryKey,
  createDentalAlertMutation,
  updateDentalAlertMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPatientEngagementModuleDentalAlert,
  DentalPatientEngagementModuleCreateDentalAlertRequest,
  DentalPatientEngagementModuleUpdateDentalAlertRequest,
} from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';

export type DentalAlert = DentalPatientEngagementModuleDentalAlert;
export type DentalAlertType = DentalAlert['alertType'];
export type DentalAlertSeverity = DentalAlert['severity'];
export type CreateDentalAlertBody = DentalPatientEngagementModuleCreateDentalAlertRequest;
export type UpdateDentalAlertBody = DentalPatientEngagementModuleUpdateDentalAlertRequest;

export const DENTAL_ALERT_TYPES: DentalAlertType[] = [
  'gag_reflex',
  'latex_allergy',
  'needle_phobia',
  'dental_anxiety',
  'tmj_disorder',
  'excessive_salivation',
  'dry_socket_history',
  'bisphosphonate_use',
  'bleeding_disorder',
  'other',
];

export const DENTAL_ALERT_TYPE_LABELS: Record<DentalAlertType, string> = {
  gag_reflex: 'Gag reflex',
  latex_allergy: 'Latex allergy',
  needle_phobia: 'Needle phobia',
  dental_anxiety: 'Dental anxiety',
  tmj_disorder: 'TMJ disorder',
  excessive_salivation: 'Excessive salivation',
  dry_socket_history: 'Dry socket history',
  bisphosphonate_use: 'Bisphosphonate use',
  bleeding_disorder: 'Bleeding disorder',
  other: 'Other',
};

export const DENTAL_ALERT_SEVERITIES: DentalAlertSeverity[] = ['low', 'medium', 'high'];

export const DENTAL_ALERT_SEVERITY_LABELS: Record<DentalAlertSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function useDentalAlerts(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listDentalAlertsOptions({ path: { patientId } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    select: (data): DentalAlert[] => {
      // SDK response is Array<DentalAlert> | ErrorResponse; also tolerate a
      // paginated { data: [...] } wrapper. ErrorResponse is a non-array object.
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        return (data as { data: DentalAlert[] }).data;
      }
      return [];
    },
  });

  const create = useMutation({
    ...createDentalAlertMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listDentalAlertsQueryKey({ path: { patientId } }) });
    },
    onError: (err) => toastError(err, 'Could not save the alert.'),
  });

  const update = useMutation({
    ...updateDentalAlertMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listDentalAlertsQueryKey({ path: { patientId } }) });
    },
    onError: (err) => toastError(err, 'Could not update the alert.'),
  });

  const alerts = query.data ?? [];

  return {
    alerts,
    activeAlerts: alerts.filter((a) => a.active),
    isLoading: query.isLoading,
    isError: query.isError,
    createAlert: (body: CreateDentalAlertBody) => create.mutate({ path: { patientId }, body }),
    deactivateAlert: (alertId: string) =>
      update.mutate({ path: { patientId, alertId }, body: { active: false } }),
    isCreating: create.isPending,
    isUpdating: update.isPending,
  };
}
