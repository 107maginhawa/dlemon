/**
 * AuditLog — WF-028 compliance audit viewer (dental-audit FIX-001).
 *
 * Owner-only (the settings route is owner-gated; the endpoint enforces it).
 * Branch-scoped table of audit events with actor / eventType / action / target /
 * date filters + pagination. Renders ONLY the DTO fields (no snapshots) — actor
 * is a UUID, never a name, per the PHI-minimisation contract.
 */
import React, { useState } from 'react';
import { useOrgContextStore } from '@/stores/org-context.store';
import { APP_LOCALE } from '@/constants/brand';
import { useAuditLog, AUDIT_PAGE_SIZE, type AuditLogFilters } from '../hooks/use-audit-log';

const EVENT_TYPES = ['authentication', 'data-access', 'data-modification', 'security', 'compliance', 'system-config'];

function fmt(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return d.toLocaleString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AuditLog() {
  const branchId = useOrgContextStore((s) => s.branchId) ?? '';
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [offset, setOffset] = useState(0);

  const { events, total, isLoading, error } = useAuditLog(branchId, filters, offset);

  function setFilter(key: keyof AuditLogFilters, value: string) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }

  const page = Math.floor(offset / AUDIT_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <div data-testid="audit-log-panel" className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Compliance trail of sensitive actions in this branch. Actors are recorded by ID.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Event type"
          value={filters.eventType ?? ''}
          onChange={(e) => setFilter('eventType', e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm bg-background"
        >
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          aria-label="Action"
          placeholder="Action (e.g. invoice.voided)"
          value={filters.action ?? ''}
          onChange={(e) => setFilter('action', e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          aria-label="Actor ID"
          placeholder="Actor ID"
          value={filters.actorId ?? ''}
          onChange={(e) => setFilter('actorId', e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          aria-label="Target type"
          placeholder="Target type"
          value={filters.targetType ?? ''}
          onChange={(e) => setFilter('targetType', e.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          type="date"
          aria-label="From date"
          value={filters.from?.slice(0, 10) ?? ''}
          onChange={(e) => setFilter('from', e.target.value ? `${e.target.value}T00:00:00.000Z` : '')}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          type="date"
          aria-label="To date"
          value={filters.to?.slice(0, 10) ?? ''}
          onChange={(e) => setFilter('to', e.target.value ? `${e.target.value}T23:59:59.999Z` : '')}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>

      {/* Body */}
      {isLoading ? (
        <div data-testid="audit-log-loading" className="h-24 bg-muted animate-pulse rounded-xl" />
      ) : error ? (
        <div data-testid="audit-log-error" className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load the audit log. Please try again.
        </div>
      ) : events.length === 0 ? (
        <p data-testid="audit-log-empty" className="text-sm text-muted-foreground py-4">
          No audit events match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table data-testid="audit-log-table" className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} data-testid="audit-log-row">
                  <td className="px-3 py-2 whitespace-nowrap">{fmt(e.timestamp ?? e.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.actorId}</td>
                  <td className="px-3 py-2">{e.actorRole ?? '—'}</td>
                  <td className="px-3 py-2">{e.eventType}</td>
                  <td className="px-3 py-2 font-medium">{e.action}</td>
                  <td className="px-3 py-2">
                    {e.resourceType}{e.resourceId ? ` · ${e.resourceId.slice(0, 8)}…` : ''}
                    {e.metadata?.['source'] === 'base' ? (
                      <span
                        data-testid="audit-source-base"
                        title="PHI read recorded in the platform audit sink, surfaced here for a single compliance view"
                        className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground align-middle"
                      >
                        platform
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{total} event{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="audit-prev-page"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - AUDIT_PAGE_SIZE))}
            className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-muted-foreground">Page {page} / {totalPages}</span>
          <button
            type="button"
            data-testid="audit-next-page"
            disabled={page >= totalPages}
            onClick={() => setOffset((o) => o + AUDIT_PAGE_SIZE)}
            className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
