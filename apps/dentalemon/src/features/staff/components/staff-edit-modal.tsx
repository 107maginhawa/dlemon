/**
 * StaffEditModal -- slide-up modal for editing an existing staff member
 *
 * FR6.1: owner can correct role, display name and provider credentials
 * (license number, NPI, credential type) without deactivate+recreate.
 * Sends only the changed fields to PATCH /dental/org/members/{memberId}.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { DentalRole } from '@/lib/rbac';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { useStaffMutations, type Member, type UpdateMemberInput } from '../hooks/use-staff-members';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffEditModalProps {
  branchId: string;
  member: Member;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface EditFormState {
  displayName: string;
  role: string;
  licenseNumber: string;
  npi: string;
  credentialType: string;
}

// ---------------------------------------------------------------------------
// Role metadata (mirrors StaffCreateModal options)
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: DentalRole; label: string; description: string }[] = [
  {
    value: 'dentist_associate',
    label: 'Associate Dentist',
    description: 'Clinical access, own billing, no staff/reports/settings',
  },
  {
    value: 'staff_full',
    label: 'Staff - Full Operations',
    description: 'Dashboard, workspace, patients, calendar',
  },
  {
    value: 'staff_scheduling',
    label: 'Staff - Scheduling',
    description: 'Calendar and patient read access only',
  },
  {
    value: 'treatment_coordinator',
    label: 'Treatment Coordinator',
    description: 'Presents treatment plans + financials to patients',
  },
];

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

export function buildUpdateMemberPayload(member: Member, form: EditFormState): UpdateMemberInput {
  const payload: UpdateMemberInput = {};
  const name = form.displayName.trim();
  if (name && name !== member.displayName) payload.displayName = name;
  if (form.role && form.role !== member.role) payload.role = form.role as UpdateMemberInput['role'];
  if (form.licenseNumber.trim() !== (member.licenseNumber ?? '')) {
    payload.licenseNumber = form.licenseNumber.trim();
  }
  if (form.npi.trim() !== (member.npi ?? '')) payload.npi = form.npi.trim();
  if (form.credentialType.trim() !== (member.credentialType ?? '')) {
    payload.credentialType = form.credentialType.trim();
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffEditModal({ branchId, member, open, onClose, onSaved }: StaffEditModalProps) {
  const { update, isUpdating, updateError, resetUpdate, resetPin, isResettingPin, resetPinError, resetResetPin } =
    useStaffMutations(branchId);

  const [displayName, setDisplayName] = useState(member.displayName);
  const [role, setRole] = useState<string>(member.role);
  const [licenseNumber, setLicenseNumber] = useState(member.licenseNumber ?? '');
  const [npi, setNpi] = useState(member.npi ?? '');
  const [credentialType, setCredentialType] = useState(member.credentialType ?? '');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Owner-reset-only PIN recovery (decision #9 / FR9.7).
  const [newPin, setNewPin] = useState('');
  const [pinValidation, setPinValidation] = useState<string | null>(null);
  const [pinResetDone, setPinResetDone] = useState(false);

  // Re-prefill when a different member is selected for editing.
  useEffect(() => {
    setDisplayName(member.displayName);
    setRole(member.role);
    setLicenseNumber(member.licenseNumber ?? '');
    setNpi(member.npi ?? '');
    setCredentialType(member.credentialType ?? '');
    setValidationErrors([]);
    setNewPin('');
    setPinValidation(null);
    setPinResetDone(false);
  }, [member]);

  const { containerRef } = useSheetA11y({ open, onClose: handleClose });

  if (!open) return null;

  const isOwnerRow = member.role === 'dentist_owner';

  function handleClose() {
    setValidationErrors([]);
    setNewPin('');
    setPinValidation(null);
    setPinResetDone(false);
    resetUpdate();
    resetResetPin();
    onClose();
  }

  async function handleResetPin() {
    if (!/^\d{6}$/.test(newPin)) {
      setPinValidation('PIN must be exactly 6 digits');
      setPinResetDone(false);
      return;
    }
    setPinValidation(null);
    setPinResetDone(false);
    resetResetPin();
    try {
      await resetPin(member.id, newPin);
      setNewPin('');
      setPinResetDone(true);
    } catch {
      // resetPinError is surfaced in the UI
    }
  }

  async function handleSubmit() {
    if (!displayName.trim()) {
      setValidationErrors(['Display name is required']);
      return;
    }
    if (npi.trim() && !/^\d{10}$/.test(npi.trim())) {
      setValidationErrors(['NPI must be exactly 10 digits']);
      return;
    }
    setValidationErrors([]);

    const payload = buildUpdateMemberPayload(member, {
      displayName, role, licenseNumber, npi, credentialType,
    });
    if (Object.keys(payload).length === 0) {
      handleClose();
      return;
    }

    resetUpdate();
    try {
      await update(member.id, payload);
      handleClose();
      onSaved?.();
    } catch {
      // updateError is exposed in UI
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Edit staff member"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        data-testid="staff-edit-modal"
        className="relative w-full max-h-[85vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">Edit Staff Member</h2>
            <p className="text-xs text-muted-foreground">Update role, name and provider credentials</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="-mr-2 h-11 w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {validationErrors.map(e => <p key={e}>{e}</p>)}
            </div>
          )}
          {updateError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {updateError.message}
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-edit-name">
              Display Name *
            </label>
            <input
              id="staff-edit-name"
              type="text"
              autoFocus
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Role
            </label>
            {isOwnerRow ? (
              <p className="text-sm text-muted-foreground px-1">
                Dentist-Owner role cannot be changed.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`edit-role-${opt.value}`}
                    aria-pressed={role === opt.value}
                    onClick={() => setRole(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      role === opt.value
                        ? 'border-lemon bg-lemon/10'
                        : 'border-border hover:bg-secondary/50 cursor-pointer'
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provider credentials */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-edit-license">
              License Number
            </label>
            <input
              id="staff-edit-license"
              type="text"
              value={licenseNumber}
              onChange={e => setLicenseNumber(e.target.value)}
              placeholder="e.g. PRC-12345"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-edit-npi">
              NPI
            </label>
            <input
              id="staff-edit-npi"
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={npi}
              onChange={e => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit National Provider Identifier"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-edit-credential">
              Credential Type
            </label>
            <input
              id="staff-edit-credential"
              type="text"
              value={credentialType}
              onChange={e => setCredentialType(e.target.value)}
              placeholder="e.g. DDS, DMD, RDH"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          {/* Security — owner-reset PIN (decision #9 / FR9.7). Distinct op from
              the profile Save above; shared clinic devices use owner-reset only,
              never a self-service security-question flow. */}
          <div className="border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-reset-pin">
              Reset PIN
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Set a new 6-digit PIN for this member (e.g. after they are locked out or forget it).
            </p>
            {pinValidation && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive mb-2">
                {pinValidation}
              </div>
            )}
            {resetPinError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive mb-2">
                {resetPinError.message}
              </div>
            )}
            {pinResetDone && (
              <div data-testid="staff-reset-pin-success" className="rounded-lg bg-status-done border border-status-done-foreground/30 px-3 py-2 text-sm text-status-done-foreground mb-2">
                PIN has been reset.
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="staff-reset-pin"
                data-testid="staff-reset-pin-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={e => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinResetDone(false); }}
                placeholder="New 6-digit PIN"
                className="flex-1 h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none tracking-widest"
              />
              <button
                type="button"
                data-testid="staff-reset-pin-btn"
                onClick={handleResetPin}
                disabled={isResettingPin}
                className="h-11 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isResettingPin ? 'Resetting…' : 'Reset PIN'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUpdating}
            className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
