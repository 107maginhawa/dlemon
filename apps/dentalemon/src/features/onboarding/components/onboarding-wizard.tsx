import React, { useState, useEffect } from 'react';
import { Button } from '@monobase/ui';
import { useMutation } from '@tanstack/react-query';
import {
  createOnboardingMutation,
  dentalMembershipManagementSetPinMutation,
  createDentalPatientMutation,
  updateFeeScheduleEntryMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalOrgModuleOnboardingResponse,
} from '@monobase/sdk-ts/generated';
import { SdkError } from '@monobase/sdk-ts/client';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ClinicStep } from './wizard-step-clinic';
import { DentistStep } from './wizard-step-dentist';
import { FeesStep, type FeeEntry, DEFAULT_FEES } from './wizard-step-fees';
import { PatientStep } from './wizard-step-patient';

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

  // SDK mutations — transport configured globally via ApiProvider
  const onboardMut = useMutation(createOnboardingMutation());
  const setPinMut = useMutation(dentalMembershipManagementSetPinMutation());
  const createPatientMut = useMutation(createDentalPatientMutation());
  const setFeeMut = useMutation(updateFeeScheduleEntryMutation());

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
      // ONE atomic self-service call provisions org + default branch + owner
      // membership (replaces the old org→branch→member sequence that could leave a
      // half-provisioned tenant and trap a localStorage resume into a 409).
      let onb: DentalOrgModuleOnboardingResponse;
      try {
        const result = await onboardMut.mutateAsync({
          body: {
            organizationName: clinicName.trim(),
            tier: 'solo',
            countryCode,
            branchName: 'Main Branch',
            timezone: 'Asia/Manila',
            address: address.trim() || undefined,
            phone: clinicPhone.trim() || undefined,
            ownerDisplayName: dentistName.trim() || undefined,
          },
        });
        // result is DentalOrgModuleOnboardingResponse | ErrorResponse union (200 | 201)
        // When 201, it has organizationId/branchId/membershipId
        onb = result as DentalOrgModuleOnboardingResponse;
      } catch (err) {
        // Preserve the bespoke 409/403/429 semantics exactly as the raw-fetch version did.
        if (err instanceof SdkError) {
          if (err.status === 409) {
            // Already have an active clinic — fully provisioned, drop to dashboard.
            localStorage.removeItem(STORAGE_KEY);
            onComplete();
            return;
          }
          const body = err.body as { code?: string; message?: string } | null;
          const code = body?.code;
          if (err.status === 403 && code === 'EMAIL_NOT_VERIFIED') {
            throw new Error('Please verify your email address before creating a clinic.');
          }
          if (err.status === 403 && code === 'TIER_NOT_SELF_SERVICE') {
            throw new Error('Group and enterprise plans are set up by our team — please contact support.');
          }
          if (err.status === 429) {
            throw new Error('Too many attempts. Please wait a moment and try again.');
          }
          throw new Error(body?.message || `Clinic setup failed (${err.status})`);
        }
        throw err;
      }

      useOrgContextStore.getState().setContext({ orgId: onb.organizationId, branchId: onb.branchId, memberId: onb.membershipId });

      // Set the owner's PIN on the membership the onboarding call created.
      try {
        await setPinMut.mutateAsync({
          path: {
            orgId: onb.organizationId,
            branchId: onb.branchId,
            membershipId: onb.membershipId,
          },
          body: { pin },
        });
      } catch (err) {
        if (err instanceof SdkError) {
          const body = err.body as { message?: string } | null;
          throw new Error(body?.message || `PIN setup failed (${err.status})`);
        }
        throw err;
      }

      // G-11: persist the entered fee-schedule prices. Previously the `fees` state
      // was held but never submitted — the owner's prices were silently dropped and
      // the schedule stayed at the seeded 0 defaults. Submit only non-default
      // (non-zero) prices; best-effort (org is already provisioned, prices are
      // editable later in Settings) so a fee hiccup never traps onboarding.
      const enteredFees = fees.filter((fee) => fee.priceCents > 0);
      if (enteredFees.length > 0) {
        await Promise.allSettled(
          enteredFees.map((fee) =>
            setFeeMut.mutateAsync({
              path: { cdt: fee.cdtCode },
              body: { branchId: onb.branchId, priceCents: fee.priceCents },
            }),
          ),
        );
      }

      if (!skipPatient && patientName.trim()) {
        // createDentalPatient REQUIRES branchId AND consentGiven=true (else
        // CONSENT_REQUIRED). Registering the first patient implies the owner
        // captured registration consent. Surface a failure rather than silently
        // dropping the patient the user just entered.
        try {
          await createPatientMut.mutateAsync({
            body: {
              displayName: patientName.trim(),
              dateOfBirth: birthDate,
              gender,
              branchId: onb.branchId,
              consentGiven: true,
            },
          });
        } catch (err) {
          if (err instanceof SdkError) {
            const body = err.body as { message?: string } | null;
            throw new Error(body?.message || `First patient could not be created (${err.status})`);
          }
          throw err;
        }
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${i <= stepIndex ? 'bg-lemon text-lemon-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight ${i <= stepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 mt-4 ${i < stepIndex ? 'bg-lemon' : 'bg-border'}`} />}
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
          <Button type="button" variant="lemon" onClick={handleNext} disabled={saving} className="flex-1 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Setting up...' : isLast ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
