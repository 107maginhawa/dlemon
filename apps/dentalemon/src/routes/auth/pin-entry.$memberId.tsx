/**
 * PIN Entry Route — /auth/pin-entry/$memberId
 *
 * Shows the numeric keypad for a specific staff member. On success,
 * starts a pin session and navigates to the dashboard.
 *
 * Wireframe: docs/prd/context/wireframes/auth-pin-entry.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState } from 'react';
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

export function PinEntry({ member, onSubmit, onBack, errorMessage, lockedUntil }: PinEntryProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

function PinEntryRoute() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lockedUntil, setLockedUntil] = useState<Date | undefined>();

  // TODO Phase 2.4: fetch the member details from the API
  // For now use a placeholder
  const member: PinEntryMember = {
    id: memberId,
    displayName: 'Staff Member',
    role: 'staff_full',
  };

  async function handleSubmit(pin: string): Promise<VerifyPinResult | void> {
    // TODO: need orgId + branchId from context/store
    // For now this is a placeholder — the full wiring happens in Phase 2.4
    setErrorMessage('PIN verification requires org context (Phase 2.4)');
  }

  return (
    <div className="min-h-screen bg-background">
      <PinEntry
        member={member}
        onSubmit={handleSubmit}
        onBack={() => navigate({ to: '/auth/pin-select' })}
        errorMessage={errorMessage}
        lockedUntil={lockedUntil}
      />
    </div>
  );
}
