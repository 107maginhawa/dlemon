/**
 * use-my-portal — TanStack Query hooks for the patient self-service portal (E4).
 *
 * These hit the self-scoped /me reads. The patient identity is derived
 * server-side from the session, so the hooks take NO patientId — there is
 * nothing to pass and nothing to tamper.
 *
 *   useMyAppointments() → GET /me/appointments
 *   useMyInvoices()     → GET /me/invoices
 *   useMyBalance()      → GET /me/balance
 */
import { useQuery } from '@tanstack/react-query';
import {
  listMyAppointmentsOptions,
  listMyInvoicesOptions,
  getMyBalanceOptions,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPortalModuleMyAppointment,
  DentalPortalModuleMyInvoice,
  DentalPortalModuleMyBalance,
} from '@monobase/sdk-ts/generated/types.gen';

export type MyAppointment = DentalPortalModuleMyAppointment;
export type MyInvoice = DentalPortalModuleMyInvoice;
export type MyBalance = DentalPortalModuleMyBalance;

export function useMyAppointments() {
  // The SDK 200 type is now a clean MyAppointment[] (the TypeSpec op declares no
  // ErrorResponse on 200), so no defensive array-shape guard is needed.
  const query = useQuery(listMyAppointmentsOptions());
  return {
    appointments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useMyInvoices() {
  const query = useQuery(listMyInvoicesOptions());
  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useMyBalance() {
  const query = useQuery(getMyBalanceOptions());
  return {
    balance: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
