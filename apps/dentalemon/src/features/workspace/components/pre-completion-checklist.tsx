/**
 * PreCompletionChecklist — Radix Dialog for visit completion safety checks
 *
 * Runs 4 parallel async checks on open (consent, treatments, SOAP notes, lab orders).
 * Shows pass/warn icons per check. Allows "Complete anyway" when warns exist.
 * On confirm: calls updateDentalVisit({ status: 'completed' }).
 */

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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
  const unfinished = items.filter(
    t => t.status === 'diagnosed' || t.status === 'planned',
  );
  return {
    label: 'No incomplete treatments',
    pass: unfinished.length === 0,
    message:
      unfinished.length > 0
        ? `${unfinished.length} treatment(s) still diagnosed or planned`
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
    message: openOrders.length > 0 ? `${openOrders.length} lab order(s) still open` : undefined,
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
          ? 'This visit still has open treatments. Mark them performed or dismiss them before completing.'
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
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full bg-background rounded-2xl p-6 z-50 shadow-2xl focus:outline-none"
          aria-describedby="pre-completion-description"
        >
          {/* Header */}
          <Dialog.Title className="text-base font-semibold">
            Complete Visit
          </Dialog.Title>
          <p
            id="pre-completion-description"
            className="text-xs text-muted-foreground mt-1 mb-5"
          >
            {loading
              ? 'Checking visit readiness…'
              : 'Review the items below before completing.'}
          </p>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive mb-4">
              {error}
            </div>
          )}

          {/* Check rows */}
          <div className="mb-5">
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
                    <CheckCircle2 className="size-4 text-success flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="size-4 text-warning flex-shrink-0" />
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
                className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Go Back
              </button>
              {/* CR-02: the four checks are warnings, not hard blocks (BR-014 allows
                  owner override). When warnings exist, offer an explicit
                  "Complete anyway" instead of disabling completion entirely. */}
              {hasWarns ? (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isPending || checks.length === 0}
                  className="flex-1 h-11 rounded-xl bg-amber-100 text-amber-900 text-sm font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Completing…' : 'Complete anyway'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={isPending || checks.length === 0}
                  className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Completing…' : 'Complete Visit'}
                </button>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
