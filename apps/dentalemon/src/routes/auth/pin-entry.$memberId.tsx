/**
 * PIN Entry Route — /auth/pin-entry/$memberId
 *
 * Shows the numeric keypad for a specific staff member. On success,
 * starts a pin session and navigates to the dashboard.
 *
 * Wireframe: docs/prd/context/wireframes/auth-pin-entry.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { pinSession } from '@/utils/pin-session';

export const Route = createFileRoute('/auth/pin-entry/$memberId')({
  component: PinEntryRoute,
});

// --------------------------------------------------------------------------
// Exported component (also imported by pin-entry.test.ts)
// --------------------------------------------------------------------------

export interface PinEntryMember {
  id: string;
  displayName: string;
  role: string;
}

export interface VerifyPinResult {
  success: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
}

interface PinEntryProps {
  member: PinEntryMember;
  onSubmit: (pin: string) => Promise<VerifyPinResult | void>;
  onBack: () => void;
  errorMessage?: string;
  lockedUntil?: Date;
  /** FR9.7: Show "Forgot PIN?" link when failedAttempts >= 3 */
  failedAttempts?: number;
}

const PIN_LENGTH = 6;

const KEYPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'back'],
] as const;

/** Derive two-letter initials from a display name */
function initials(displayName: string): string {
  const words = displayName.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  }
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

export function PinEntry({ member, onSubmit, onBack, errorMessage, lockedUntil, failedAttempts = 0 }: PinEntryProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);

  const isLocked = lockedUntil !== undefined && lockedUntil > new Date();

  async function handleKey(key: string) {
    if (isLocked || isSubmitting) return;

    if (key === 'back') {
      setDigits(prev => prev.slice(0, -1));
      return;
    }

    const next = [...digits, key];
    setDigits(next);

    if (next.length === PIN_LENGTH) {
      setIsSubmitting(true);
      try {
        await onSubmit(next.join(''));
      } finally {
        setIsSubmitting(false);
        setDigits([]);
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 px-4 min-h-screen">
      {/* Back navigation */}
      <div className="w-full max-w-xs">
        <button
          data-testid="pin-back-btn"
          onClick={onBack}
          aria-label="Go back to profile selection"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Profiles
        </button>
      </div>

      {/* User identity */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold">
          {initials(member.displayName)}
        </div>
        <div className="font-semibold">{member.displayName}</div>
        <div className="text-xs text-muted-foreground capitalize">{member.role.replace(/_/g, ' ')}</div>
      </div>

      {isLocked ? (
        <div data-testid="pin-lockout-message" className="text-center text-sm text-destructive px-4">
          <p className="font-semibold">Too many failed attempts</p>
          <p className="text-xs mt-1">
            Try again after {lockedUntil!.toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <>
          {/* PIN dots */}
          <div
            role="status"
            aria-label={`${digits.length} of ${PIN_LENGTH} PIN digits entered`}
            className="flex gap-3"
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                data-testid={`pin-dot-${i}`}
                data-filled={i < digits.length ? 'true' : 'false'}
                className={`w-3 h-3 rounded-full border-2 transition-colors ${
                  i < digits.length ? 'bg-foreground border-foreground' : 'border-muted-foreground'
                }`}
              />
            ))}
          </div>

          {/* Error message */}
          {errorMessage && (
            <p className="text-sm text-destructive text-center">{errorMessage}</p>
          )}

          {/* FR9.7: "Forgot PIN?" appears after 3 failed attempts */}
          {failedAttempts >= 3 && !showForgotPin && (
            <button
              data-testid="forgot-pin-link"
              onClick={() => setShowForgotPin(true)}
              className="text-xs text-primary underline"
            >
              Forgot PIN?
            </button>
          )}
          {showForgotPin && (
            <div data-testid="forgot-pin-message" className="text-center text-xs text-muted-foreground px-4 py-2 rounded-lg bg-secondary">
              <p className="font-medium mb-1">PIN Reset</p>
              <p>Ask your practice owner or administrator to reset your PIN via the Staff settings.</p>
            </div>
          )}

          {/* Keypad */}
          <div
            role="group"
            aria-label="PIN keypad"
            className="grid grid-cols-3 gap-3 w-full max-w-xs"
          >
            {KEYPAD_KEYS.flat().map((key, idx) => {
              if (key === '') return <div key={idx} />;
              if (key === 'back') {
                return (
                  <button
                    key={idx}
                    data-testid="pin-backspace-btn"
                    onClick={() => handleKey('back')}
                    aria-label="Delete"
                    className="h-14 rounded-2xl bg-secondary flex items-center justify-center text-lg"
                  >
                    ⌫
                  </button>
                );
              }
              return (
                <button
                  key={idx}
                  aria-label={key}
                  onClick={() => handleKey(key)}
                  disabled={isSubmitting}
                  className="h-14 rounded-2xl bg-secondary flex items-center justify-center text-xl font-medium hover:bg-secondary/80 transition-colors"
                >
                  {key}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Route component
// --------------------------------------------------------------------------

const API = 'http://localhost:7213';

// FR9.3: Role-based landing page after successful PIN authentication
const ROLE_LANDING: Record<string, string> = {
  dentist_owner: '/dashboard',
  dentist_associate: '/dashboard',
  staff_full: '/patients',
  staff_scheduling: '/calendar',
};

function PinEntryRoute() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lockedUntil, setLockedUntil] = useState<Date | undefined>();
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [member, setMember] = useState<PinEntryMember>({
    id: memberId,
    displayName: 'Loading…',
    role: 'staff_full',
  });

  useEffect(() => {
    const branchId = localStorage.getItem('currentBranchId');
    if (!branchId) return;
    fetch(`${API}/dental/org/members?branchId=${encodeURIComponent(branchId)}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { items?: PinEntryMember[] }) => {
        const found = (data.items ?? []).find((m: PinEntryMember) => m.id === memberId);
        if (found) setMember(found);
      })
      .catch(() => {});
  }, [memberId]);

  async function handleSubmit(pin: string): Promise<VerifyPinResult | void> {
    const orgId = localStorage.getItem('currentOrgId');
    const branchId = localStorage.getItem('currentBranchId');
    if (!orgId || !branchId) {
      setErrorMessage('Missing org context');
      return;
    }

    const res = await fetch(
      `${API}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/verify-pin`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      }
    );

    const data = await res.json();

    if (data.success) {
      pinSession.startSession({ memberId, displayName: member.displayName, role: member.role });
      localStorage.setItem('currentMemberId', memberId);
      localStorage.setItem('currentMemberRole', member.role);
      setFailedAttempts(0);
      // FR9.3: Navigate to role-appropriate landing page
      const destination = ROLE_LANDING[member.role] ?? '/dashboard';
      navigate({ to: destination as any });
    } else {
      if (data.lockedUntil) {
        setLockedUntil(new Date(data.lockedUntil));
      }
      const newAttempts = data.failedAttempts ?? (failedAttempts + 1);
      setFailedAttempts(newAttempts);
      setErrorMessage('Incorrect PIN');
    }

    return {
      success: data.success,
      failedAttempts: data.failedAttempts ?? 0,
      lockedUntil: data.lockedUntil ? new Date(data.lockedUntil) : undefined,
    };
  }

  return (
    <div className="min-h-screen bg-background">
      <PinEntry
        member={member}
        onSubmit={handleSubmit}
        onBack={() => navigate({ to: '/auth/pin-select' })}
        errorMessage={errorMessage}
        lockedUntil={lockedUntil}
        failedAttempts={failedAttempts}
      />
    </div>
  );
}
