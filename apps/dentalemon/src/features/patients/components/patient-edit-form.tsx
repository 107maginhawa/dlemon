/**
 * PatientEditForm (FIX-001 / FR2.4)
 *
 * Demographics-correction modal for an existing patient: first/last name, date of
 * birth, gender — the registration-typo fix. These fields live on the linked
 * PERSON record and are saved via PATCH /dental/patients/:id (updateDentalPatient).
 *
 * Pure presentational form (the profile page owns the mutation + cache
 * invalidation), mirroring PatientRegistrationModal. Archived patients are
 * read-only (BR-015b): the server returns 403, and the form pre-disables.
 *
 * Contact info (phone/email) IS editable here per decision #14 (V-PAT-014): it is
 * surfaced on the profile and saved as person.contactInfo (a partial merge on the
 * server — an omitted/blank sub-field is sent through and merged).
 */

import React, { useState } from 'react';

export interface PatientEditData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // '' when unset
  gender: string; // '' when unset
  email: string; // '' when unset
  phone: string; // '' when unset
}

interface PatientEditFormProps {
  open: boolean;
  initial: PatientEditData;
  /** Archived patient → read-only (BR-015b). */
  disabled?: boolean;
  /** Save error surfaced to the user (no silent failures). */
  error?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (data: PatientEditData) => Promise<void>;
}

// Matches the person genderEnum (person.schema.ts).
const GENDER_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Prefer not to say'],
  ['male', 'Male'],
  ['female', 'Female'],
  ['non-binary', 'Non-binary'],
  ['other', 'Other'],
  ['prefer-not-to-say', 'Prefer not to say (explicit)'],
];

/**
 * Normalize a human-typed phone to E.164 (the server contract is
 * `^\+[1-9]\d{1,14}$` — digits only after a leading `+`). Strips spaces and the
 * usual visual separators so a natural "+63 917 555 1234" is accepted instead of
 * being silently 400'd by the server's stricter pattern (ISSUE-015).
 */
function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s().-]/g, '');
}

export function PatientEditForm({
  open,
  initial,
  disabled = false,
  error = null,
  saving = false,
  onClose,
  onSubmit,
}: PatientEditFormProps) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [gender, setGender] = useState(initial.gender);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!open) return null;

  function validate(): boolean {
    if (!firstName.trim()) {
      setFieldError('First name is required');
      return false;
    }
    // Email is optional; validate format only when provided.
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFieldError('Please enter a valid email address');
      return false;
    }
    // Phone is optional. Normalize to E.164 and validate against the server contract
    // (`^\+[1-9]\d{1,14}$`) so we never pass client validation only to be 400'd: the
    // patient/staff gets actionable guidance instead of a generic save failure.
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone && !/^\+[1-9]\d{1,14}$/.test(normalizedPhone)) {
      setFieldError('Enter phone in international format, e.g. +639171234567');
      return false;
    }
    setFieldError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    if (!validate()) return;
    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth,
      gender,
      email: email.trim(),
      phone: normalizePhone(phone),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit patient demographics"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Edit Patient Details</h2>

        {disabled && (
          <p className="text-xs text-muted-foreground mb-3">
            This patient is archived and cannot be edited. Restore the patient to make changes.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* First Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-first-name" className="text-sm font-medium">
              First Name <span className="text-destructive">*</span>
            </label>
            <input
              id="edit-first-name"
              type="text"
              value={firstName}
              disabled={disabled}
              onChange={(e) => setFirstName(e.target.value)}
              aria-label="First name"
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>

          {/* Last Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-last-name" className="text-sm font-medium">
              Last Name
            </label>
            <input
              id="edit-last-name"
              type="text"
              value={lastName}
              disabled={disabled}
              onChange={(e) => setLastName(e.target.value)}
              aria-label="Last name"
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-dob" className="text-sm font-medium">
              Date of Birth
            </label>
            <input
              id="edit-dob"
              type="date"
              value={dateOfBirth}
              disabled={disabled}
              onChange={(e) => setDateOfBirth(e.target.value)}
              aria-label="Date of birth"
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-gender" className="text-sm font-medium">
              Gender
            </label>
            <select
              id="edit-gender"
              value={gender}
              disabled={disabled}
              onChange={(e) => setGender(e.target.value)}
              aria-label="Gender"
              className="rounded-lg border border-border px-3 py-2 text-sm bg-background disabled:opacity-50"
            >
              {GENDER_OPTIONS.map(([value, label]) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Email (#14: person.contactInfo.email) */}
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              disabled={disabled}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>

          {/* Phone (#14: person.contactInfo.phone) */}
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-phone" className="text-sm font-medium">
              Phone
            </label>
            <input
              id="edit-phone"
              type="tel"
              value={phone}
              disabled={disabled}
              onChange={(e) => setPhone(e.target.value)}
              aria-label="Phone"
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>

          {fieldError && <span className="text-xs text-destructive">{fieldError}</span>}
          {error && (
            <span role="alert" className="text-xs text-destructive">
              {error}
            </span>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled || saving}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-primary text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
