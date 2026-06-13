/**
 * StaffCreateModal -- slide-up modal for creating a new staff member
 *
 * Features: display name input, role card selection with permission preview,
 *           6-digit PIN setup with confirmation, branch-scoped creation
 */

import React, { useState } from 'react';
import { canAccess, type DentalRole, type DentalModule } from '@/lib/rbac';
import { useStaffMutations } from '../hooks/use-staff-members';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffFormData {
  displayName: string;
  role: string;
  pin: string;
  confirmPin: string;
  branchId: string;
}

export interface StaffCreateModalProps {
  branchId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Role metadata
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: DentalRole; label: string; description: string; disabled?: boolean }[] = [
  {
    value: 'dentist_owner',
    label: 'Dentist-Owner',
    description: 'Full access to all modules',
    disabled: true,
  },
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

const MODULES: DentalModule[] = [
  'dashboard', 'workspace', 'patients', 'calendar', 'billing', 'reports', 'staff', 'settings',
];

const MODULE_LABELS: Record<DentalModule, string> = {
  dashboard: 'Dashboard',
  workspace: 'Workspace',
  patients: 'Patients',
  calendar: 'Calendar',
  billing: 'Billing',
  reports: 'Reports',
  staff: 'Staff',
  settings: 'Settings',
};

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

export function validateStaffForm(form: StaffFormData): string[] {
  const errors: string[] = [];

  if (!form.displayName.trim()) {
    errors.push('Display name is required');
  }

  if (!form.role) {
    errors.push('Role is required');
  }

  if (!form.pin) {
    errors.push('PIN is required');
  } else if (!/^\d{6}$/.test(form.pin)) {
    errors.push('PIN must be exactly 6 digits');
  }

  if (form.pin && form.confirmPin && form.pin !== form.confirmPin) {
    errors.push('PINs do not match');
  }

  return errors;
}

export function buildCreateMemberPayload(form: StaffFormData): {
  branchId: string;
  displayName: string;
  role: string;
  pin: string;
} {
  return {
    branchId: form.branchId,
    displayName: form.displayName.trim(),
    role: form.role,
    pin: form.pin,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffCreateModal({ branchId, open, onClose, onCreated }: StaffCreateModalProps) {
  const { create, isCreating, createError, resetCreate } = useStaffMutations(branchId);

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string>('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  if (!open) return null;

  function handleClose() {
    setDisplayName('');
    setRole('');
    setPin('');
    setConfirmPin('');
    setValidationErrors([]);
    resetCreate();
    onClose();
  }

  async function handleSubmit() {
    const form: StaffFormData = { displayName, role, pin, confirmPin, branchId };
    const errs = validateStaffForm(form);
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    setValidationErrors([]);
    resetCreate();

    try {
      await create({ displayName: displayName.trim(), role, pin });
      handleClose();
      onCreated?.();
    } catch {
      // createError is exposed in UI
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        data-testid="staff-create-modal"
        className="relative w-full max-h-[85vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">Add Staff Member</h2>
            <p className="text-xs text-muted-foreground">Create a new team member with role and PIN</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            X
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
          {createError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {createError.message}
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-name">
              Display Name *
            </label>
            <input
              id="staff-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Dr. Maria Santos"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
              Role *
            </label>
            <div className="flex flex-col gap-2">
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && setRole(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    opt.disabled
                      ? 'border-border bg-secondary/50 opacity-50 cursor-not-allowed'
                      : role === opt.value
                        ? 'border-lemon bg-lemon/10'
                        : 'border-border hover:bg-secondary/50 cursor-pointer'
                  }`}
                >
                  <p className="text-sm font-medium">
                    {opt.label}
                    {opt.disabled && <span className="ml-2 text-xs text-muted-foreground">(Already assigned)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Permission Preview */}
          {role && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Permission Preview
              </label>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Module</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map(mod => {
                      const hasAccess = canAccess(role as DentalRole, mod);
                      return (
                        <tr key={mod} className="border-t border-border">
                          <td className="px-3 py-2 text-sm">{MODULE_LABELS[mod]}</td>
                          <td className="px-3 py-2">
                            {hasAccess ? (
                              <span className="text-green-600 text-xs font-medium">Full Access</span>
                            ) : (
                              <span className="text-gray-400 text-xs">No Access</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PIN Setup */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-pin">
              PIN (6 digits) *
            </label>
            <input
              id="staff-pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit PIN"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none tracking-widest"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="staff-pin-confirm">
              Confirm PIN *
            </label>
            <input
              id="staff-pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Re-enter 6-digit PIN"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none tracking-widest"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating}
            className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Staff Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
