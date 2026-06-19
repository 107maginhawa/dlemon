/**
 * ClinicActivationBanner — owner-facing clinic activation (C-1 / ADR-007).
 *
 * Self-service onboarding leaves a clinic `provisional`; in production, patient/
 * visit PHI writes are blocked until the OWNER activates it (accepts terms/BAA).
 * This banner is that activation surface — rendered in the dashboard shell, owner-
 * only, only while the org is provisional. Activating flips org status to 'live'
 * (server-side + in the org-context store, so the banner self-dismisses).
 */

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { activateOrganizationMutation } from '@monobase/sdk-ts/generated/react-query';
import { toastError } from '@/lib/error-toast';
import { useOrgContextStore } from '@/stores/org-context.store';

export function ClinicActivationBanner() {
  const orgId = useOrgContextStore((s) => s.orgId);
  const role = useOrgContextStore((s) => s.role);
  const orgStatus = useOrgContextStore((s) => s.orgStatus);
  const setContext = useOrgContextStore((s) => s.setContext);
  const [error, setError] = useState<string | null>(null);

  const activateMut = useMutation({
    ...activateOrganizationMutation(),
    onSuccess: () => {
      setContext({ orgStatus: 'live' });
      toast.success('Clinic activated');
    },
  });

  // Only the owner of a still-provisional clinic sees the activation CTA.
  if (orgStatus !== 'provisional' || role !== 'dentist_owner' || !orgId) return null;

  async function handleActivate() {
    setError(null);
    try {
      await activateMut.mutateAsync({ path: { id: orgId! } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not activate the clinic. Please try again.');
      toastError(e, 'Could not activate the clinic. Please try again.');
    }
  }

  return (
    <div
      data-testid="clinic-activation-banner"
      role="status"
      className="flex flex-col gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-semibold">Activate your clinic to start adding patients</p>
        <p className="text-xs text-amber-800">
          Your clinic is in setup mode. Activate it to confirm you accept the terms and
          start creating patient records.
        </p>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        data-testid="activate-clinic-btn"
        onClick={handleActivate}
        disabled={activateMut.isPending}
        className="h-10 shrink-0 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
      >
        {activateMut.isPending ? 'Activating…' : 'Activate clinic'}
      </button>
    </div>
  );
}
