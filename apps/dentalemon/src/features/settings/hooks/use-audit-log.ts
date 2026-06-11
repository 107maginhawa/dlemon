/**
 * useAuditLog — WF-028 compliance audit viewer query (dental-audit FIX-001).
 *
 * Reads GET /dental/audit-events (branch-scoped, owner-only — the settings route
 * is owner-gated and the endpoint enforces it). Pure FE wiring over the generated
 * `getAuditEvents` SDK hook; the viewer renders ONLY the fields the DTO returns
 * (no snapshots — deliberate latent-PHI guard).
 */
import { useQuery } from '@tanstack/react-query';
import { getAuditEventsOptions } from '@monobase/sdk-ts/generated/react-query';
import type { DentalAuditModuleDentalAuditEvent } from '@monobase/sdk-ts/generated';

export interface AuditLogFilters {
  actorId?: string;
  eventType?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
}

export const AUDIT_PAGE_SIZE = 25;

export function useAuditLog(branchId: string, filters: AuditLogFilters, offset: number) {
  const query = useQuery({
    ...getAuditEventsOptions({
      query: {
        branchId,
        limit: AUDIT_PAGE_SIZE,
        offset,
        // Only include set filters so empty inputs don't over-constrain the query.
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.eventType ? { eventType: filters.eventType as never } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.targetType ? { targetType: filters.targetType } : {}),
        ...(filters.from ? { from: new Date(filters.from) } : {}),
        ...(filters.to ? { to: new Date(filters.to) } : {}),
      },
    }),
    enabled: !!branchId,
  });

  const data = query.data as { data?: DentalAuditModuleDentalAuditEvent[]; meta?: { total?: number } } | undefined;

  return {
    events: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
