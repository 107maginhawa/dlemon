import React, { useState, useEffect } from 'react';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

type Step = 'clinic' | 'dentist' | 'fees' | 'patient';
const STEPS: Step[] = ['clinic', 'dentist', 'fees', 'patient'];
const STEP_LABELS: Record<Step, string> = {
  clinic: 'Clinic Setup',
  dentist: 'Dentist Profile',
  fees: 'Fee Schedule',
  patient: 'First Patient',
};

interface FeeEntry { cdtCode: string; description: string; priceCents: number; }

const DEFAULT_FEES: FeeEntry[] = [
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 0 },
  { cdtCode: 'D0274', description: 'Bitewings (4 films)', priceCents: 0 },
  { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 0 },
  { cdtCode: 'D2391', description: 'Composite (1 surface)', priceCents: 0 },
  { cdtCode: 'D2710', description: 'Crown (porcelain)', priceCents: 0 },
  { cdtCode: 'D7140', description: 'Simple Extraction', priceCents: 0 },
];

const STORAGE_KEY = 'onboardingWizardState';

interface WizardState {
  step: Step;
  clinicName: string;
  countryCode: string;
  address: string;
  clinicPhone: string;
  dentistName: string;
  licenseNumber: string;
  specialization: string;
  fees: FeeEntry[];
}

function loadState(): Partial<WizardState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: WizardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable
  }
}

export interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const saved = loadState();

  const [step, setStep] = useState<Step>(saved.step ?? 'clinic');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Clinic step
  const [clinicName, setClinicName] = useState(saved.clinicName ?? '');
  const [countryCode, setCountryCode] = useState(saved.countryCode ?? 'PH');
  const [address, setAddress] = useState(saved.address ?? '');
  const [clinicPhone, setClinicPhone] = useState(saved.clinicPhone ?? '');

  // Dentist step
  const [dentistName, setDentistName] = useState(saved.dentistName ?? '');
  const [licenseNumber, setLicenseNumber] = useState(saved.licenseNumber ?? '');
  const [specialization, setSpecialization] = useState(saved.specialization ?? '');
  // FR9.1: User-defined 6-digit PIN (never persisted for security)
  const [pin, setPin] = useState('');

  // Fee schedule step
  const [fees, setFees] = useState<FeeEntry[]>(saved.fees ?? DEFAULT_FEES);

  // Patient step
  const [patientName, setPatientName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('male');
  const [patientPhone, setPatientPhone] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const isLast = stepIndex === STEPS.length - 1;

  // FR7.4: Persist progress to localStorage on every state change (except PIN)
  useEffect(() => {
    saveState({
      step, clinicName, countryCode, address, clinicPhone,
      dentistName, licenseNumber, specialization, fees,
    });
  }, [step, clinicName, countryCode, address, clinicPhone, dentistName, licenseNumber, specialization, fees]);

  function validate(): string[] {
    const errs: string[] = [];
    if (step === 'clinic') {
      if (!clinicName.trim()) errs.push('Clinic name is required');
      if (!countryCode.trim()) errs.push('Country is required');
    } else if (step === 'dentist') {
      if (!dentistName.trim()) errs.push('Dentist name is required');
      // FR9.1: PIN must be exactly 6 digits
      if (!/^\d{6}$/.test(pin)) errs.push('PIN must be exactly 6 digits');
    } else if (step === 'patient') {
      if (!patientName.trim()) errs.push('Patient name is required');
      if (!birthDate.trim()) errs.push('Date of birth is required');
    }
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    if (!isLast) {
      const next = STEPS[stepIndex + 1];
      if (next) setStep(next);
    } else {
      handleFinish(false);
    }
  }

  function handleBack() {
    const prev = STEPS[stepIndex - 1];
    if (stepIndex > 0 && prev) { setErrors([]); setStep(prev); }
  }

  // FR7.1: Skip first patient step (it's optional)
  function handleSkipPatient() {
    handleFinish(true);
  }

  async function handleFinish(skipPatient: boolean) {
    setSaving(true);
    setErrors([]);
    try {
      // Create org using correct nested API endpoint
      const orgRes = await fetch(`${API}/dental/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: clinicName.trim(), tier: 'solo', countryCode }),
      });
      if (!orgRes.ok) {
        const err = await orgRes.json().catch(() => ({}));
        throw new Error(err.message || `Organization creation failed (${orgRes.status})`);
      }
      const org = await orgRes.json();

      // Create branch using correct nested API endpoint
      const branchRes = await fetch(`${API}/dental/organizations/${org.id}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'Main Branch',
          timezone: 'Asia/Manila',
          address: address.trim() || undefined,
          phone: clinicPhone.trim() || undefined,
        }),
      });
      if (!branchRes.ok) {
        const err = await branchRes.json().catch(() => ({}));
        throw new Error(err.message || `Branch creation failed (${branchRes.status})`);
      }
      const branch = await branchRes.json();

      // Create dentist-owner member using correct nested API endpoint
      const memberRes = await fetch(`${API}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: dentistName.trim(),
          role: 'dentist_owner',
        }),
      });
      if (!memberRes.ok) {
        const err = await memberRes.json().catch(() => ({}));
        throw new Error(err.message || `Member creation failed (${memberRes.status})`);
      }
      const member = await memberRes.json();

      // FR9.1: Set the user-defined PIN (not a hardcoded default)
      const pinRes = await fetch(
        `${API}/dental/organizations/${org.id}/branches/${branch.id}/members/${member.id}/set-pin`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin }),
        },
      );
      if (!pinRes.ok) {
        const err = await pinRes.json().catch(() => ({}));
        throw new Error(err.message || `PIN setup failed (${pinRes.status})`);
      }

      // Store org/branch context in localStorage for PIN auth and dashboard
      localStorage.setItem('currentOrgId', org.id);
      localStorage.setItem('currentBranchId', branch.id);
      localStorage.setItem('currentMemberId', member.id);

      // Create first patient (only if not skipped)
      if (!skipPatient && patientName.trim()) {
        await fetch(`${API}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            displayName: patientName.trim(),
            dateOfBirth: birthDate,
            gender,
          }),
        });
        // Patient creation failure is non-fatal — don't block onboarding completion
      }

      // Clear saved wizard state (onboarding is complete)
      localStorage.removeItem(STORAGE_KEY);

      onComplete();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Setup failed. Please try again.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Step indicator — numbered circles with labels */}
        <div className="flex items-start justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-start gap-1">
              <div className="flex flex-col items-center gap-1 w-16">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${i <= stepIndex ? 'bg-[#FFE97D] text-[#4A4018]' : 'bg-secondary text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight ${i <= stepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 mt-4 ${i < stepIndex ? 'bg-[#FFE97D]' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-center mb-1">{STEP_LABELS[step]}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {step === 'clinic' && 'Tell us about your practice'}
          {step === 'dentist' && 'Your professional details and login PIN'}
          {step === 'fees' && 'Set your default procedure prices (optional)'}
          {step === 'patient' && 'Register your first patient to get started (optional)'}
        </p>

        {errors.length > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive mb-4">
            {errors.map(e => <p key={e}>{e}</p>)}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {step === 'clinic' && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Clinic Name *
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder="e.g. Smile Dental Clinic"
                  aria-label="Clinic Name"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Country *
                </label>
                <select
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  aria-label="Country"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                >
                  <option value="PH">Philippines</option>
                  <option value="AU">Australia</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  aria-label="Address"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Phone
                </label>
                <input
                  type="text"
                  value={clinicPhone}
                  onChange={e => setClinicPhone(e.target.value)}
                  aria-label="Phone"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
            </>
          )}

          {step === 'dentist' && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={dentistName}
                  onChange={e => setDentistName(e.target.value)}
                  placeholder="Dr. Juan dela Cruz"
                  aria-label="Full Name"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  License Number
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={e => setLicenseNumber(e.target.value)}
                  placeholder="PRC License #"
                  aria-label="License Number"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Specialization
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={e => setSpecialization(e.target.value)}
                  placeholder="e.g. General Dentistry"
                  aria-label="Specialization"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              {/* FR9.1: User-defined 6-digit PIN — never hardcoded */}
              <div>
                <label
                  htmlFor="dentist-pin"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                >
                  Your 6-digit PIN *
                </label>
                <input
                  id="dentist-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  aria-label="6-digit PIN"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none tracking-widest"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You'll use this PIN to sign in to the app
                </p>
              </div>
            </>
          )}

          {step === 'fees' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-2">CDT Code</th>
                    <th className="px-4 py-2">Procedure</th>
                    <th className="px-4 py-2 text-right">Price (₱)</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((fee, i) => (
                    <tr key={fee.cdtCode} className="border-b last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{fee.cdtCode}</td>
                      <td className="px-4 py-2">{fee.description}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={fee.priceCents / 100 || ''}
                          onChange={e => {
                            const updated = [...fees];
                            updated[i] = { ...fee, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) };
                            setFees(updated);
                          }}
                          className="w-24 h-8 rounded-lg border border-border px-2 text-sm text-right bg-background focus:border-[#FFE97D] outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {step === 'patient' && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="Juan dela Cruz"
                  aria-label="Full Name"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  aria-label="Date of Birth"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  aria-label="Gender"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Phone
                </label>
                <input
                  type="text"
                  value={patientPhone}
                  onChange={e => setPatientPhone(e.target.value)}
                  aria-label="Patient Phone"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-8">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
            >
              Back
            </button>
          )}
          {/* FR7.1: Skip button on the optional First Patient step */}
          {step === 'patient' && (
            <button
              type="button"
              onClick={handleSkipPatient}
              disabled={saving}
              className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
          >
            {saving ? 'Setting up...' : isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
