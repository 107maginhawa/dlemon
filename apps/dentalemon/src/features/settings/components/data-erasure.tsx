/**
 * DataErasure — right-to-erasure (RA-10173 / GDPR Art.17) admin queue
 * (data-governance Batch E, decision #1 + C-4).
 *
 * V1 operator surface for the two-step erasure workflow: a platform administrator
 * reviews pending requests and Approves (runs the anonymize engine — PII redacted,
 * clinical record + audit trail preserved, blocked by an active legal hold) or
 * Rejects them. The endpoints are platform-admin gated (Better-Auth `admin` role);
 * the panel self-gates so a non-admin clinic owner sees an explanatory notice
 * rather than a 403 wall. Clinic-owner-initiated requests are deferred to Phase-2
 * — see the data-governance fix report.
 *
 * Split: `DataErasurePanel` is presentational (props-only, fully unit-tested);
 * `DataErasure` is the thin container wiring useSession + the generated react-query
 * hooks, proven end-to-end by the admin-approval E2E journey.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth';
import {
  listErasureRequestsOptions,
  listErasureRequestsQueryKey,
  approveErasureMutation,
  rejectErasureMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalErasureModuleErasureRequest as ErasureRequest,
  DentalErasureModuleErasureRequestStatus as ErasureStatus,
} from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';
import { APP_LOCALE } from '@/constants/brand';

const STATUS_FILTERS: { value: '' | ErasureStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'anonymized', label: 'Anonymized' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
];

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  anonymized: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  approved: 'bg-blue-100 text-blue-800',
};

function fmt(ts: string | Date | null): string {
  if (!ts) return '—';
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return d.toLocaleString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function short(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export interface DataErasurePanelProps {
  isPlatformAdmin: boolean;
  requests: ErasureRequest[];
  isLoading: boolean;
  error: Error | null;
  statusFilter: '' | ErasureStatus;
  onChangeStatus: (status: '' | ErasureStatus) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  /** id of the request currently mutating (its row actions disable). */
  busyId: string | null;
}

export function DataErasurePanel({
  isPlatformAdmin,
  requests,
  isLoading,
  error,
  statusFilter,
  onChangeStatus,
  onApprove,
  onReject,
  busyId,
}: DataErasurePanelProps) {
  // Per-row rejection reason (local view state; the container owns the data).
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const header = (
    <div>
      <h2 className="text-lg font-semibold">Data Erasure</h2>
      <p className="text-sm text-muted-foreground">
        Right-to-erasure (RA&nbsp;10173 / GDPR Art.&nbsp;17) request queue. Approving anonymizes the
        subject&apos;s personal data; the de-identified clinical record and the audit trail are kept.
        Requests for a subject under an active legal hold are refused.
      </p>
    </div>
  );

  if (!isPlatformAdmin) {
    return (
      <div data-testid="data-erasure-panel" className="flex flex-col gap-4">
        {header}
        <p data-testid="data-erasure-admin-only" className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Data erasure is operated by a platform administrator. Contact your platform administrator to
          raise or action an erasure request.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="data-erasure-panel" className="flex flex-col gap-4">
      {header}

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => onChangeStatus(e.target.value as '' | ErasureStatus)}
          className="rounded-lg border border-border px-3 py-2 text-sm bg-background"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value || 'all'} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div data-testid="data-erasure-loading" className="h-24 bg-muted animate-pulse rounded-xl" />
      ) : error ? (
        <div data-testid="data-erasure-error" className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load erasure requests. Please try again.
        </div>
      ) : requests.length === 0 ? (
        <p data-testid="data-erasure-empty" className="text-sm text-muted-foreground py-4">
          No erasure requests match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table data-testid="data-erasure-table" className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Requested</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((r) => {
                const isRequested = r.status === 'requested';
                const busy = busyId === r.id;
                const reason = reasons[r.id] ?? '';
                return (
                  <tr key={r.id} data-testid="data-erasure-row">
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs" title={r.subjectPersonId}>{short(r.subjectPersonId)}</td>
                    <td className="px-3 py-2 font-mono text-xs" title={r.tenantId}>{short(r.tenantId)}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[18rem] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-3 py-2">
                      <span data-testid="data-erasure-status" className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {r.status}
                      </span>
                      {r.legalHoldBlocked ? (
                        <span data-testid="data-erasure-hold" className="ml-1 text-xs text-red-700">legal hold</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {isRequested ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid="data-erasure-approve"
                            disabled={busy}
                            onClick={() => onApprove(r.id)}
                            className="px-2.5 py-1 rounded-lg bg-foreground text-background text-xs font-medium disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <input
                            aria-label={`Rejection reason for ${short(r.subjectPersonId)}`}
                            data-testid="data-erasure-reject-reason"
                            value={reason}
                            placeholder="Rejection reason"
                            disabled={busy}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-50"
                          />
                          <button
                            type="button"
                            data-testid="data-erasure-reject"
                            disabled={busy || reason.trim().length === 0}
                            onClick={() => onReject(r.id, reason.trim())}
                            className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Container: wires the platform-admin session + the generated erasure hooks.
 * Kept thin — all view logic lives in DataErasurePanel.
 */
export function DataErasure() {
  const { data: session } = useSession();
  const isPlatformAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState<'' | ErasureStatus>('');
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    ...listErasureRequestsOptions({ query: statusFilter ? { status: statusFilter } : {} }),
    enabled: isPlatformAdmin,
  });

  // Partial-match every erasure-list query (any status filter): the key is
  // [{ _id: 'listErasureRequests', baseUrl }] with no query field, so it
  // refetches the active view after an approve/reject regardless of the filter.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listErasureRequestsQueryKey() });

  const approve = useMutation({
    ...approveErasureMutation(),
    onSuccess: () => {
      invalidate();
      toast.success('Erasure request approved');
    },
    onError: (err) => toastError(err, 'Could not approve the erasure request. Please try again.'),
  });
  const reject = useMutation({
    ...rejectErasureMutation(),
    onSuccess: () => {
      invalidate();
      toast.success('Erasure request rejected');
    },
    onError: (err) => toastError(err, 'Could not reject the erasure request. Please try again.'),
  });

  const data = listQuery.data as { data?: ErasureRequest[] } | undefined;
  const requests = data?.data ?? [];

  const busyId = approve.isPending
    ? (approve.variables?.path?.id ?? null)
    : reject.isPending
      ? (reject.variables?.path?.id ?? null)
      : null;

  return (
    <DataErasurePanel
      isPlatformAdmin={isPlatformAdmin}
      requests={requests}
      isLoading={isPlatformAdmin && listQuery.isLoading}
      error={listQuery.error as Error | null}
      statusFilter={statusFilter}
      onChangeStatus={setStatusFilter}
      onApprove={(id) => approve.mutate({ path: { id }, body: {} })}
      onReject={(id, rejectionReason) => reject.mutate({ path: { id }, body: { rejectionReason } })}
      busyId={busyId}
    />
  );
}
