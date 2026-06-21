/**
 * WaitlistPanel — PP-5 (ISSUE-039) front-desk waitlist (short-notice fills).
 *
 * Calendar slide-over (sibling of RecallDueList): lists a branch's ACTIVE waitlist
 * entries — created by the public BookingWizard, previously invisible to staff —
 * and lets the front desk fill a short-notice slot. "Fill slot" opens an inline
 * form (date/time/duration/provider/visit type) → POST /waitlist/:id/promote books
 * a scheduled appointment and the entry drops off the active list.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@monobase/ui';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { useWaitlist, type WaitlistEntry, type WaitlistUrgency } from '../hooks/use-waitlist';
import { buildTimeRange, DURATION_OPTIONS, VISIT_TYPE_OPTIONS } from './appointment-modal';

const URGENCY_STYLE: Record<WaitlistUrgency, string> = {
  routine: 'bg-gray-100 text-gray-600',
  soon: 'bg-amber-100 text-amber-700',
  asap: 'bg-red-100 text-red-700',
};

function truncateId(id: string, maxLen = 8): string {
  return id.length <= maxLen ? id : id.slice(0, maxLen) + '…';
}

export interface PromoteForm {
  date: string;
  time: string;
  durationMinutes: number;
  providerId: string;
  visitType: string;
}

export function initialPromoteForm(entry: WaitlistEntry): PromoteForm {
  return {
    date: '',
    time: '',
    durationMinutes: 30,
    providerId: entry.preferredProviderId ?? '',
    visitType: entry.visitType ?? 'checkup',
  };
}

/** A slot can be booked only once date, time and a provider are chosen. */
export function canPromote(form: PromoteForm): boolean {
  return Boolean(form.date && form.time && form.providerId.trim());
}

export function WaitlistPanel({ branchId }: { branchId?: string }) {
  const { entries, isLoading, isError, refetch, promote, isPromoting } = useWaitlist(branchId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoteForm | null>(null);

  function startFill(entry: WaitlistEntry) {
    setOpenId(entry.id);
    setForm(initialPromoteForm(entry));
  }

  async function handlePromote(entry: WaitlistEntry) {
    if (!form || !canPromote(form)) return;
    const { startAt, endAt } = buildTimeRange(form.date, form.time, form.durationMinutes);
    try {
      await promote({
        path: { entryId: entry.id },
        body: { startAt: new Date(startAt), endAt: new Date(endAt), providerId: form.providerId.trim(), visitType: form.visitType },
      });
      toast.success('Slot filled from the waitlist');
      setOpenId(null);
      setForm(null);
    } catch (err) {
      toastError(err, `Couldn’t fill a slot for ${entry.patientName || 'this patient'}.`);
    }
  }

  const inputClass = 'h-10 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none';

  return (
    <Card data-testid="waitlist-panel">
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight">Waitlist</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground py-6 text-center" role="status">Loading waitlist…</p>}

        {isError && (
          <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            Couldn’t load the waitlist.{' '}
            <button type="button" onClick={() => void refetch()} className="underline font-medium">Retry</button>
          </div>
        )}

        {!isLoading && !isError && entries.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center" data-testid="waitlist-empty">No one is waiting. 🎉</p>
        )}

        {!isLoading && !isError && entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border px-3 py-2.5" data-testid="waitlist-row">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{entry.patientName || truncateId(entry.patientId)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {entry.visitType ?? 'Any visit'}
                  {entry.notes ? ` · ${entry.notes}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary" className={URGENCY_STYLE[entry.urgency]}>{entry.urgency}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => (openId === entry.id ? setOpenId(null) : startFill(entry))}
                  data-testid={`waitlist-fill-${entry.id}`}
                  className="h-8 px-3 rounded-lg bg-lemon hover:bg-lemon-hover text-lemon-foreground text-sm font-semibold transition-colors"
                  aria-label={`Fill a slot for ${entry.patientName || truncateId(entry.patientId)}`}
                >
                  {openId === entry.id ? 'Close' : 'Fill slot'}
                </Button>
              </div>
            </div>

            {openId === entry.id && form && (
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3" data-testid="waitlist-promote-form">
                <div className="flex gap-2">
                  <input type="date" aria-label="Date" data-testid="waitlist-date" className={`${inputClass} flex-1`} value={form.date} onChange={(e) => setForm((f) => f && { ...f, date: e.target.value })} />
                  <input type="time" aria-label="Time" data-testid="waitlist-time" className={`${inputClass} flex-1`} value={form.time} onChange={(e) => setForm((f) => f && { ...f, time: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <select aria-label="Duration" data-testid="waitlist-duration" className={`${inputClass} flex-1`} value={form.durationMinutes} onChange={(e) => setForm((f) => f && { ...f, durationMinutes: Number(e.target.value) })}>
                    {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select aria-label="Visit type" data-testid="waitlist-visit-type" className={`${inputClass} flex-1`} value={form.visitType} onChange={(e) => setForm((f) => f && { ...f, visitType: e.target.value })}>
                    {VISIT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <input
                  type="text"
                  aria-label="Provider member ID"
                  data-testid="waitlist-provider"
                  placeholder="Provider member ID"
                  className={inputClass}
                  value={form.providerId}
                  onChange={(e) => setForm((f) => f && { ...f, providerId: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handlePromote(entry)}
                  disabled={!canPromote(form) || isPromoting}
                  data-testid={`waitlist-book-${entry.id}`}
                  className="h-9 rounded-lg bg-lemon hover:bg-lemon-hover text-lemon-foreground text-sm font-semibold transition-colors disabled:opacity-50 self-start px-4"
                >
                  {isPromoting ? 'Booking…' : 'Book slot'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
