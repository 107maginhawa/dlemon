/**
 * PatientRegistrationModal
 *
 * Form modal for registering a new dental patient.
 * Validates: name required, DOB format, consent required.
 *
 * Wireframe: docs/prd/context/wireframes/patient-registration.html
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@monobase/ui';

// P1-28: per-channel communication consent captured at registration.
export interface CommunicationChannelConsent {
  sms: boolean;
  email: boolean;
  phone: boolean;
  marketing: boolean;
}

export interface PatientRegistrationData {
  displayName: string;
  dateOfBirth: string;
  gender: string;
  consentGiven: boolean;
  /** P1-28: per-channel communication opt-ins. */
  communicationConsent: CommunicationChannelConsent;
}

interface PatientRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PatientRegistrationData) => Promise<void>;
}

export function PatientRegistrationModal({
  open,
  onClose,
  onSubmit,
}: PatientRegistrationModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  // P1-28: per-channel communication consent.
  const [channelConsent, setChannelConsent] = useState<CommunicationChannelConsent>({
    sms: false,
    email: false,
    phone: false,
    marketing: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset to a clean form each open (the panel stays mounted while `open` toggles),
  // so a prior abandoned registration's fields/errors don't carry over.
  useEffect(() => {
    if (!open) return;
    setDisplayName('');
    setDateOfBirth('');
    setGender('');
    setConsentGiven(false);
    setChannelConsent({ sms: false, email: false, phone: false, marketing: false });
    setErrors({});
    setIsSubmitting(false);
  }, [open]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs['name'] = 'Full name is required';
    if (!dateOfBirth) errs['dob'] = 'Date of birth is required';
    if (!consentGiven) errs['consent'] = 'Patient consent is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        displayName: displayName.trim(),
        dateOfBirth,
        gender,
        consentGiven,
        communicationConsent: channelConsent,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register new patient</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Full Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="reg-name" className="text-sm font-medium">
              Full Name <span className="text-destructive">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-label="Full name"
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
            {errors['name'] && (
              <span className="text-xs text-destructive">{errors['name']}</span>
            )}
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1">
            <label htmlFor="reg-dob" className="text-sm font-medium">
              Date of Birth <span className="text-destructive">*</span>
            </label>
            <input
              id="reg-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              aria-label="Date of birth"
              className="rounded-lg border border-border px-3 py-2 text-sm"
            />
            {errors['dob'] && (
              <span className="text-xs text-destructive">{errors['dob']}</span>
            )}
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1">
            <label htmlFor="reg-gender" className="text-sm font-medium">
              Gender
            </label>
            <select
              id="reg-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              aria-label="Gender"
              className="rounded-lg border border-border px-3 py-2 text-sm bg-background"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Consent */}
          <div className="flex items-start gap-2">
            <input
              id="reg-consent"
              type="checkbox"
              data-testid="consent-checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="reg-consent" className="text-sm leading-tight">
              Patient has provided consent for data collection and treatment
            </label>
          </div>
          {errors['consent'] && (
            <span className="text-xs text-destructive -mt-2">{errors['consent']}</span>
          )}

          {/* P1-28: per-channel communication consent */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Communication consent</legend>
            <p className="text-xs text-muted-foreground">
              How may we contact this patient? (optional)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['sms', 'SMS'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                  ['marketing', 'Marketing'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    data-testid={`consent-channel-${key}`}
                    checked={channelConsent[key]}
                    onChange={(e) =>
                      setChannelConsent((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Buttons */}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border px-4 text-sm hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Register patient
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
