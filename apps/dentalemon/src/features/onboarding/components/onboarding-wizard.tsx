import React, { useState } from 'react';

const API = 'http://localhost:7213';

type Step = 'clinic' | 'dentist' | 'fees' | 'patient';
const STEPS: Step[] = ['clinic', 'dentist', 'fees', 'patient'];
const STEP_LABELS: Record<Step, string> = { clinic: 'Clinic Setup', dentist: 'Dentist Profile', fees: 'Fee Schedule', patient: 'First Patient' };

interface FeeEntry { cdtCode: string; description: string; priceCents: number; }

const DEFAULT_FEES: FeeEntry[] = [
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 0 },
  { cdtCode: 'D0274', description: 'Bitewings (4 films)', priceCents: 0 },
  { cdtCode: 'D1110', description: 'Prophylaxis', priceCents: 0 },
  { cdtCode: 'D2391', description: 'Composite (1 surface)', priceCents: 0 },
  { cdtCode: 'D2710', description: 'Crown (porcelain)', priceCents: 0 },
  { cdtCode: 'D7140', description: 'Simple Extraction', priceCents: 0 },
];

export interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('clinic');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [clinicName, setClinicName] = useState('');
  const [countryCode, setCountryCode] = useState('PH');
  const [address, setAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');

  const [dentistName, setDentistName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');

  const [fees, setFees] = useState<FeeEntry[]>(DEFAULT_FEES);

  const [patientName, setPatientName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('male');
  const [patientPhone, setPatientPhone] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const isLast = stepIndex === STEPS.length - 1;

  function validate(): string[] {
    const errs: string[] = [];
    if (step === 'clinic') {
      if (!clinicName.trim()) errs.push('Clinic name is required');
      if (!countryCode.trim()) errs.push('Country is required');
    } else if (step === 'dentist') {
      if (!dentistName.trim()) errs.push('Dentist name is required');
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
      handleFinish();
    }
  }

  function handleBack() {
    const prev = STEPS[stepIndex - 1];
    if (stepIndex > 0 && prev) { setErrors([]); setStep(prev); }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      // Create org
      const orgRes = await fetch(`${API}/dental/org/organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: clinicName.trim(), tier: 'solo', countryCode }),
      });
      const org = await orgRes.json();

      // Create branch
      const branchRes = await fetch(`${API}/dental/org/branches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ organizationId: org.id, name: 'Main Branch', timezone: 'Asia/Manila' }),
      });
      const branch = await branchRes.json();

      // Create dentist-owner membership
      await fetch(`${API}/dental/org/members?branchId=${branch.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ branchId: branch.id, displayName: dentistName.trim(), role: 'dentist_owner', pin: '000000' }),
      });

      // Create first patient
      await fetch(`${API}/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          name: [{ use: 'official', family: patientName.trim(), given: [patientName.trim().split(' ')[0]] }],
          birthDate, gender,
        }),
      });

      onComplete();
    } catch {
      setErrors(['Setup failed. Please try again.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                ${i <= stepIndex ? 'bg-[#FFE97D] text-[#4A4018]' : 'bg-secondary text-muted-foreground'}`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < stepIndex ? 'bg-[#FFE97D]' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-center mb-1">{STEP_LABELS[step]}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {step === 'clinic' && 'Tell us about your practice'}
          {step === 'dentist' && 'Your professional details'}
          {step === 'fees' && 'Set your default procedure prices (optional)'}
          {step === 'patient' && 'Register your first patient to get started'}
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
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Clinic Name *</label>
                <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="e.g. Smile Dental Clinic"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Country *</label>
                <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none">
                  <option value="PH">Philippines</option>
                  <option value="AU">Australia</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Phone</label>
                <input type="text" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
            </>
          )}

          {step === 'dentist' && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Full Name *</label>
                <input type="text" value={dentistName} onChange={e => setDentistName(e.target.value)} placeholder="Dr. Juan dela Cruz"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">License Number</label>
                <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="PRC License #"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Specialization</label>
                <input type="text" value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="e.g. General Dentistry"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
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
                        <input type="number" min="0" step="0.01"
                          value={fee.priceCents / 100 || ''}
                          onChange={e => {
                            const updated = [...fees];
                            updated[i] = { ...fee, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) };
                            setFees(updated);
                          }}
                          className="w-24 h-8 rounded-lg border border-border px-2 text-sm text-right bg-background focus:border-[#FFE97D] outline-none" />
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
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Full Name *</label>
                <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Juan dela Cruz"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Date of Birth *</label>
                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Phone</label>
                <input type="text" value={patientPhone} onChange={e => setPatientPhone(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none" />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-8">
          {stepIndex > 0 && (
            <button type="button" onClick={handleBack}
              className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">
              Back
            </button>
          )}
          <button type="button" onClick={handleNext} disabled={saving}
            className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50">
            {saving ? 'Setting up...' : isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
