/**
 * CollectionsWorklist — actionable overdue-account worklist (Phase 2.4).
 *
 * One row per overdue patient with overdue total, days overdue, open invoices,
 * plan status, and last collections contact. Per-row actions: log a contact
 * attempt (inline form → POST note) and send a statement. Sortable by days
 * overdue or overdue balance.
 */
import React, { useState } from 'react';
import {
  useCollectionsWorklist,
  useLogCollectionNote,
  useSendStatement,
} from '../hooks/use-collections';
import { ListErrorState } from '@/components/list-error-state';
import { formatCents } from './collections-view.helpers';

const CONTACT_CHANNELS = ['phone', 'email', 'sms', 'in-person', 'other'] as const;
type SortKey = 'oldestDaysOverdue' | 'totalOverdueCents';

function formatDate(value?: string | Date): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface CollectionsWorklistProps {
  branchId?: string | null;
}

export function CollectionsWorklist({ branchId }: CollectionsWorklistProps) {
  const { worklist, isLoading, error, refetch } = useCollectionsWorklist({ branchId });
  const { logNote, isLogging } = useLogCollectionNote({ branchId });
  const { send, sendingPatientId, lastSent } = useSendStatement({ branchId });

  const [sortKey, setSortKey] = useState<SortKey>('oldestDaysOverdue');
  const [loggingPatientId, setLoggingPatientId] = useState<string | null>(null);
  const [channel, setChannel] = useState<(typeof CONTACT_CHANNELS)[number]>('phone');
  const [noteText, setNoteText] = useState('');

  const rows = [...(worklist?.rows ?? [])].sort((a, b) => b[sortKey] - a[sortKey]);

  function openLog(patientId: string) {
    setLoggingPatientId(patientId);
    setChannel('phone');
    setNoteText('');
  }

  async function saveNote(patientId: string) {
    if (!noteText.trim()) return;
    try {
      await logNote({ patientId, note: noteText.trim(), contactChannel: channel });
      setLoggingPatientId(null);
      setNoteText('');
    } catch {
      // surfaced via mutation error; row stays open to retry
    }
  }

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      aria-pressed={sortKey === key}
      className={`uppercase tracking-wider ${sortKey === key ? 'text-foreground' : 'text-muted-foreground'} focus-visible:ring-2 focus-visible:ring-ring outline-none rounded`}
    >
      {label}{sortKey === key ? ' ↓' : ''}
    </button>
  );

  if (error) {
    return (
      <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="worklist-error">
        <ListErrorState message={error.message || 'Failed to load worklist.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="bg-background rounded-2xl shadow-sm overflow-hidden" data-testid="collections-worklist">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border pl-5">Patient</th>
              <th className="text-right text-xs font-semibold px-4 py-3 border-b border-border">{sortBtn('totalOverdueCents', 'Overdue')}</th>
              <th className="text-right text-xs font-semibold px-4 py-3 border-b border-border">{sortBtn('oldestDaysOverdue', 'Days')}</th>
              <th className="text-right text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Open</th>
              <th className="text-center text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Plan</th>
              <th className="text-left text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border">Last contact</th>
              <th className="text-right text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 py-3 border-b border-border pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading worklist…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">No overdue accounts. 🎉</td></tr>
            )}
            {!isLoading && rows.map((p) => (
              <React.Fragment key={p.patientId}>
                <tr className="border-t border-border first:border-t-0">
                  <td className="px-4 py-0 h-12 align-middle text-sm font-medium pl-5">{p.patientName}</td>
                  <td className="px-4 py-0 h-12 align-middle text-sm tabular-nums text-right font-bold">{formatCents(p.totalOverdueCents)}</td>
                  <td className="px-4 py-0 h-12 align-middle text-sm tabular-nums text-right font-semibold text-red-700">{p.oldestDaysOverdue}d</td>
                  <td className="px-4 py-0 h-12 align-middle text-sm tabular-nums text-right">{p.openInvoiceCount}</td>
                  <td className="px-4 py-0 h-12 align-middle text-sm text-center">
                    {p.hasActivePlan ? <span className="text-xs font-medium text-green-700">On plan</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-0 h-12 align-middle text-sm">
                    {p.lastContactedAt
                      ? <span>{formatDate(p.lastContactedAt)} <span className="text-muted-foreground">· {p.lastContactChannel} ({p.noteCount})</span></span>
                      : <span className="text-muted-foreground">Never</span>}
                  </td>
                  <td className="px-4 py-0 h-12 align-middle text-right pr-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openLog(p.patientId)}
                        className="h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
                        data-testid={`log-note-${p.patientId}`}
                      >
                        Log
                      </button>
                      <button
                        type="button"
                        onClick={() => { void send(p.patientId); }}
                        disabled={sendingPatientId === p.patientId}
                        className="h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                        data-testid={`send-statement-${p.patientId}`}
                      >
                        {sendingPatientId === p.patientId ? 'Sending…' : lastSent?.patientId === p.patientId ? 'Sent ✓' : 'Send'}
                      </button>
                    </div>
                  </td>
                </tr>
                {loggingPatientId === p.patientId && (
                  <tr className="bg-secondary/40" data-testid={`log-form-${p.patientId}`}>
                    <td colSpan={7} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={channel}
                          onChange={(e) => setChannel(e.target.value as typeof channel)}
                          aria-label="Contact channel"
                          className="h-9 rounded-lg border border-border px-2 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
                          data-testid={`log-channel-${p.patientId}`}
                        >
                          {CONTACT_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="What happened on this contact?"
                          className="flex-1 min-w-[200px] h-9 rounded-lg border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                          data-testid={`log-text-${p.patientId}`}
                        />
                        <button
                          type="button"
                          onClick={() => saveNote(p.patientId)}
                          disabled={isLogging || !noteText.trim()}
                          className="h-9 px-4 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                          data-testid={`log-save-${p.patientId}`}
                        >
                          {isLogging ? 'Saving…' : 'Save note'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoggingPatientId(null)}
                          className="h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
