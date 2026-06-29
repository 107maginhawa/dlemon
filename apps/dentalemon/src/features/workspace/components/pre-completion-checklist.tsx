/**
 * PreCompletionChecklist — Radix Dialog for visit completion safety checks
 *
 * Runs 4 parallel async checks on open (consent, treatments, SOAP notes, lab orders).
 * Shows pass/warn icons per check. Allows "Complete anyway" when warns exist.
 * On confirm: calls updateDentalVisit({ status: 'completed' }).
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@monobase/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  listConsentForms,
  listDentalTreatments,
  getVisitNotes,
  listLabOrders,
} from '@monobase/sdk-ts/generated';
import {
  updateDentalVisitMutation,
  listDentalVisitsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { isOpenTreatment } from '../lib/billable';

export interface PreCompletionChecklistProps {
  visitId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

interface CheckResult {
  label: string;
  pass: boolean;
  message?: string;
}

async function checkConsentSigned(visitId: string): Promise<CheckResult> {
  const { data } = await listConsentForms({ path: { visitId } });
  const items = (data && 'data' in data ? data.data : []) as Array<{ signed: boolean }>;
  const signed = items.some(f => f.signed);
  return {
    label: 'Consent form signed',
    pass: signed,
    message: signed ? undefined : 'No signed consent form on file',
  };
}

async function checkNoUnstartedTreatments(visitId: string): Promise<CheckResult> {
  const { data } = await listDentalTreatments({ path: { visitId } });
  const items = (data && 'data' in data ? data.data : []) as Array<{ status: string }>;
  const unfinished = items.filter(t => isOpenTreatment(t.status));
  return {
    label: 'No incomplete treatments',
    pass: unfinished.length === 0,
    message:
      unfinished.length > 0
        ? `${unfinished.length} treatment${unfinished.length === 1 ? '' : 's'} not done yet — mark done or dismiss`
        : undefined,
  };
}

async function checkSoapNotesPresent(visitId: string): Promise<CheckResult> {
  const { data } = await getVisitNotes({ path: { visitId } });
  const notes = data as { subjective?: string; objective?: string; assessment?: string; plan?: string } | null | undefined;
  const hasNotes =
    !!notes &&
    !!(
      notes.subjective?.trim() ||
      notes.objective?.trim() ||
      notes.assessment?.trim() ||
      notes.plan?.trim()
    );
  return {
    label: 'SOAP notes recorded',
    pass: hasNotes,
    message: hasNotes ? undefined : 'SOAP notes not recorded',
  };
}

async function checkNoOpenLabOrders(visitId: string): Promise<CheckResult> {
  const { data } = await listLabOrders({ path: { visitId } });
  const items = (data && 'data' in data ? data.data : []) as Array<{ status: string }>;
  const openOrders = items.filter(
    o => o.status !== 'fitted' && o.status !== 'cancelled',
  );
  return {
    label: 'No open lab orders',
    pass: openOrders.length === 0,
    message: openOrders.length > 0 ? `${openOrders.length} lab order${openOrders.length === 1 ? '' : 's'} still open` : undefined,
  };
}

export function PreCompletionChecklist({
  visitId,
  patientId,
  open,
  onClose,
  onCompleted,
}: PreCompletionChecklistProps) {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    ...updateDentalVisitMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listDentalVisitsQueryKey({ query: { patientId } }),
      });
      onCompleted?.();
      onClose();
    },
    onError: (err) => {
      // Surface backend guards (e.g. VISIT_HAS_OPEN_TREATMENTS) instead of failing
      // silently — the dialog stays open so the clinician can resolve and retry.
      const e = err as { code?: string; message?: string; body?: { code?: string; message?: string } };
      const code = e?.code ?? e?.body?.code;
      const msg = e?.body?.message ?? e?.message;
      setError(
        code === 'VISIT_HAS_OPEN_TREATMENTS'
          ? 'This visit still has open treatments. Mark them done or dismiss them before completing.'
          : (msg || 'Could not complete the visit. Please try again.'),
      );
    },
  });

  // Run all 4 checks in parallel when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setChecks([]);
    setError('');

    Promise.all([
      checkConsentSigned(visitId),
      checkNoUnstartedTreatments(visitId),
      checkSoapNotesPresent(visitId),
      checkNoOpenLabOrders(visitId),
    ])
      .then(results => {
        setChecks(results);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to run checks. Please try again.');
        setLoading(false);
      });
  }, [open, visitId]);

  function handleComplete() {
    setError('');
    completeMutation.mutate({
      path: { visitId },
      body: { status: 'completed' },
    });
  }

  const hasWarns = checks.some(c => !c.pass);
  const isPending = completeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
          {/* Header */}
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold">
              Complete visit
            </DialogTitle>
            <DialogDescription className="text-xs">
              {loading
                ? 'Checking visit readiness…'
                : 'A few quick checks before you complete this visit.'}
            </DialogDescription>
          </DialogHeader>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Check rows */}
          <div>
            {loading ? (
              <>
                <div className="h-8 bg-muted animate-pulse rounded-lg mb-2" />
                <div className="h-8 bg-muted animate-pulse rounded-lg mb-2" />
                <div className="h-8 bg-muted animate-pulse rounded-lg mb-2" />
                <div className="h-8 bg-muted animate-pulse rounded-lg mb-2" />
              </>
            ) : (
              checks.map((check, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                >
                  {check.pass ? (
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                  ) : (
                    <AlertTriangle className="size-4 text-warning shrink-0" />
                  )}
                  <div>
                    <p className="text-sm">{check.label}</p>
                    {!check.pass && check.message && (
                      <p className="text-xs text-muted-foreground">{check.message}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 h-11 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Not yet
              </button>
              {/* CR-02: the four checks are warnings, not hard blocks (BR-014 allows
                  owner override). When warnings exist, offer an explicit
                  "Complete anyway" instead of disabling completion entirely. */}
              {hasWarns ? (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isPending || checks.length === 0}
                  className="flex-1 h-11 rounded-lg bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {isPending ? 'Completing…' : 'Complete anyway'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isPending || checks.length === 0}
                  className="flex-1 h-11 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isPending ? 'Completing…' : 'Complete visit'}
                </button>
              )}
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
