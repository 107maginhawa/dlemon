/**
 * usePatientReport — TanStack Query hook for the patient report
 *
 * Fetches all patients and computes stats:
 * - Total active patients
 * - Total archived patients
 * - New registrations within a date range
 *
 * API: GET /dental/patients
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalPatientsOptions } from '@monobase/sdk-ts/generated/react-query';

// ─── Exported types ─────────────────────────────────────────────────────────

export interface PatientReportRow {
  id: string;
  displayName: string;
  status: string;
  createdAt: string;
}

export interface PatientStats {
  totalActive: number;
  totalArchived: number;
  newRegistrations: number;
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

export function computePatientStats(
  patients: PatientReportRow[],
  startDate: string,
  endDate: string,
): PatientStats {
  let totalActive = 0;
  let totalArchived = 0;
  let newRegistrations = 0;

  for (const p of patients) {
    if (p.status === 'active' || p.status === 'in-session') {
      totalActive++;
    } else if (p.status === 'archived') {
      totalArchived++;
    } else {
      // Default: count as active for unknown statuses
      totalActive++;
    }

    // Count new registrations within date range
    const createdDate = p.createdAt.slice(0, 10);
    if (!startDate && !endDate) {
      newRegistrations++;
    } else {
      const inRange =
        (!startDate || createdDate >= startDate) &&
        (!endDate || createdDate <= endDate);
      if (inRange) {
        newRegistrations++;
      }
    }
  }

  return { totalActive, totalArchived, newRegistrations };
}

// ─── Hook options ───────────────────────────────────────────────────────────

export interface UsePatientReportOptions {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePatientReport(options: UsePatientReportOptions) {
  const { branchId, startDate = '', endDate = '' } = options;

  const query = useQuery({
    ...listDentalPatientsOptions({
      query: {
        branchId: branchId || undefined,
        limit: 1000, // Fetch all for reporting
      },
    }),
  });

  // Extract patients from API response
  const rawPatients: PatientReportRow[] = (() => {
    const data = query.data;
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map(toReportRow);
    }
    const raw = data as Record<string, unknown>;
    // PaginatedResponse shape: { data: [...], pagination: {...} }
    if (Array.isArray(raw.data)) {
      return (raw.data as Record<string, unknown>[]).map(toReportRow);
    }
    return [];
  })();

  const stats = computePatientStats(rawPatients, startDate, endDate);

  return {
    stats,
    patients: rawPatients,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── Private helpers ────────────────────────────────────────────────────────

function toReportRow(p: Record<string, unknown>): PatientReportRow {
  const createdAt = p.createdAt;
  let createdAtStr = '';
  if (typeof createdAt === 'string') {
    createdAtStr = createdAt;
  } else if (createdAt instanceof Date) {
    createdAtStr = createdAt.toISOString();
  } else if (createdAt) {
    createdAtStr = String(createdAt);
  }

  return {
    id: String(p.id ?? ''),
    displayName: String(p.displayName ?? p.display_name ?? 'Unknown'),
    status: String(p.status ?? 'active'),
    createdAt: createdAtStr,
  };
}
