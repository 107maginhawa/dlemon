/**
 * usePatientBalance — authoritative patient outstanding balance (roadmap slice 1.6)
 *
 * Reads server-computed aggregates from GET /dental/billing/patients/:id/balance
 * instead of summing a (paginated) invoice list client-side. The endpoint excludes
 * voided invoices and counts active plans — the single source of truth for the
 * Outstanding Balance figure on the patient profile.
 */
import { useQuery } from '@tanstack/react-query';
import { getPatientBalanceOptions } from '@monobase/sdk-ts/generated/react-query';
import type { PatientBalanceResponse } from '@monobase/sdk-ts/generated';

export type { PatientBalanceResponse };

export function usePatientBalance({ patientId }: { patientId: string }) {
  const query = useQuery({
    ...getPatientBalanceOptions({ path: { patientId } }),
    enabled: !!patientId,
  });

  return {
    balance: (query.data as PatientBalanceResponse | undefined) ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
