/**
 * usePatientStatement — itemized patient statement (Phase 3.2, FR2.21).
 *
 * Wraps GET /dental/patients/:id/statement (visits + invoices + payments +
 * summary totals) for the patient-profile statement view. Lazy by default —
 * pass enabled:true only when the statement is actually opened.
 */
import { useQuery } from '@tanstack/react-query';
import { getDentalPatientStatementOptions } from '@monobase/sdk-ts/generated/react-query';
import type { DentalPatientModuleDentalPatientStatement } from '@monobase/sdk-ts/generated';

export type PatientStatement = DentalPatientModuleDentalPatientStatement;

export function usePatientStatement(patientId: string, enabled = true) {
  const query = useQuery({
    ...getDentalPatientStatementOptions({ path: { id: patientId } }),
    enabled: Boolean(patientId) && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    statement: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
