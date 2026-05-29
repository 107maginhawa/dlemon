import React, { useState, useEffect } from 'react';
import { Button } from '@monobase/ui';
import { apiBaseUrl } from '@/lib/config';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ClinicStep } from './wizard-step-clinic';
import { DentistStep } from './wizard-step-dentist';
import { FeesStep, type FeeEntry, DEFAULT_FEES } from './wizard-step-fees';
import { PatientStep } from './wizard-step-patient';

const API = apiBaseUrl;

type Step = 'clinic' | 'dentist' | 'fees' | 'patient';
const STEPS: Step[] = ['clinic', 'dentist', 'fees', 'patient'];
const STEP_LABELS: Record<Step, string> = {
  clinic: 'Clinic Setup',
  dentist: 'Dentist Profile',
  fees: 'Fee Schedule',
  patient: 'First Patient',
};

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

  const [clinicName, setClinicName] = useState(saved.clinicName ?? '');
  const [countryCode, setCountryCode] = useState(saved.countryCode ?? 'PH');
  const [address, setAddress] = useState(saved.address ?? '');
  const [clinicPhone, setClinicPhone] = useState(saved.clinicPhone ?? '');

  const [dentistName, setDentistName] = useState(saved.dentistName ?? '');
  const [licenseNumber, setLicenseNumber] = useState(saved.licenseNumber ?? '');
  const [specialization, setSpecialization] = useState(saved.specialization ?? '');
  const [pin, setPin] = useState('');

  const [fees, setFees] = useState<FeeEntry[]>(saved.fees ?? DEFAULT_FEES);

  const [patientName, setPatientName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('male');
  const [patientPhone, setPatientPhone] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    saveState({ step, clinicName, countryCode, address, clinicPhone, dentistName, licenseNumber, specialization, fees });
  }, [step, clinicName, countryCode, address, clinicPhone, dentistName, licenseNumber, specialization, fees]);

  function validate(): string[] {
    const errs: string[] = [];
    if (step === 'clinic') {
      if (!clinicName.trim()) errs.push('Clinic name is required');
      if (!countryCode.trim()) errs.push('Country is required');
    } else if (step === 'dentist') {
      if (!dentistName.trim()) errs.push('Dentist name is required');
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

  function handleSkipPatient() { handleFinish(true); }

  async function handleFinish(skipPatient: boolean) {
    setSaving(true);
    setErrors([]);
    try {
      const orgRes = await fetch(`${API}/dental/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: clinicName.trim(), tier: 'solo', countryCode }),
      });
      if (!orgRes.ok) { const e = await orgRes.json().catch(() => ({})); throw new Error(e.message || `Organization creation failed (${orgRes.status})`); }
      const org = await orgRes.json();

      const branchRes = await fetch(`${API}/dental/organizations/${org.id}/branches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: 'Main Branch', timezone: 'Asia/Manila', address: address.trim() || undefined, phone: clinicPhone.trim() || undefined }),
      });
      if (!branchRes.ok) { const e = await branchRes.json().catch(() => ({})); throw new Error(e.message || `Branch creation failed (${branchRes.status})`); }
      const branch = await branchRes.json();

      const memberRes = await fetch(`${API}/dental/organizations/${org.id}/branches/${branch.id}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ displayName: dentistName.trim(), role: 'dentist_owner' }),
      });
      if (!memberRes.ok) { const e = await memberRes.json().catch(() => ({})); throw new Error(e.message || `Member creation failed (${memberRes.status})`); }
      const member = await memberRes.json();

      const pinRes = await fetch(`${API}/dental/organizations/${org.id}/branches/${branch.id}/members/${member.id}/set-pin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ pin }),
      });
      if (!pinRes.ok) { const e = await pinRes.json().catch(() => ({})); throw new Error(e.message || `PIN setup failed (${pinRes.status})`); }

      useOrgContextStore.getState().setContext({ orgId: org.id, branchId: branch.id, memberId: member.id });

      if (!skipPatient && patientName.trim()) {
        await fetch(`${API}/dental/patients`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ displayName: patientName.trim(), dateOfBirth: birthDate, gender }),
        });
      }

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
        {/* Step indicator */}
        <div className="flex items-start justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-start gap-1">
              <div className="flex flex-col items-center gap-1 w-16">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${i <= stepIndex ? 'bg-[#FFE97D] text-[#4A4018]' : 'bg-secondary text-muted-foreground'}`}>
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
            <ClinicStep
              clinicName={clinicName} onClinicNameChange={setClinicName}
              countryCode={countryCode} onCountryCodeChange={setCountryCode}
              address={address} onAddressChange={setAddress}
              clinicPhone={clinicPhone} onClinicPhoneChange={setClinicPhone}
            />
          )}
          {step === 'dentist' && (
            <DentistStep
              dentistName={dentistName} onDentistNameChange={setDentistName}
              licenseNumber={licenseNumber} onLicenseNumberChange={setLicenseNumber}
              specialization={specialization} onSpecializationChange={setSpecialization}
              pin={pin} onPinChange={setPin}
            />
          )}
          {step === 'fees' && <FeesStep fees={fees} onFeesChange={setFees} />}
          {step === 'patient' && (
            <PatientStep
              patientName={patientName} onPatientNameChange={setPatientName}
              birthDate={birthDate} onBirthDateChange={setBirthDate}
              gender={gender} onGenderChange={setGender}
              patientPhone={patientPhone} onPatientPhoneChange={setPatientPhone}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-8">
          {stepIndex > 0 && (
            <Button type="button" variant="ghost" onClick={handleBack} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Back</Button>
          )}
          {step === 'patient' && (
            <Button type="button" variant="ghost" onClick={handleSkipPatient} disabled={saving} className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50">Skip for now</Button>
          )}
          <Button type="button" variant="ghost" onClick={handleNext} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50">
            {saving ? 'Setting up...' : isLast ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
