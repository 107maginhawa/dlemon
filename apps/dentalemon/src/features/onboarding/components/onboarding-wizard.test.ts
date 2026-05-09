import { describe, test, expect } from 'bun:test';

type Step = 'clinic' | 'dentist' | 'fees' | 'patient';

interface ClinicData { name: string; countryCode: string; address: string; phone: string; }
interface DentistData { name: string; licenseNumber: string; specialization: string; }
interface FeeEntry { cdtCode: string; description: string; priceCents: number; }
interface PatientData { name: string; birthDate: string; gender: string; phone: string; }

function getStepLabel(step: Step): string {
  const labels: Record<Step, string> = { clinic: 'Clinic Setup', dentist: 'Dentist Profile', fees: 'Fee Schedule', patient: 'First Patient' };
  return labels[step];
}

function getStepNumber(step: Step): number {
  const nums: Record<Step, number> = { clinic: 1, dentist: 2, fees: 3, patient: 4 };
  return nums[step];
}

function validateClinicStep(data: ClinicData): string[] {
  const errors: string[] = [];
  if (!data.name.trim()) errors.push('Clinic name is required');
  if (!data.countryCode.trim()) errors.push('Country is required');
  return errors;
}

function validateDentistStep(data: DentistData): string[] {
  const errors: string[] = [];
  if (!data.name.trim()) errors.push('Dentist name is required');
  return errors;
}

function validateFeeScheduleStep(_data: FeeEntry[]): string[] {
  return [];
}

function validatePatientStep(data: PatientData): string[] {
  const errors: string[] = [];
  if (!data.name.trim()) errors.push('Patient name is required');
  if (!data.birthDate.trim()) errors.push('Date of birth is required');
  return errors;
}

function canProceedToNext(step: Step, data: { clinic: ClinicData; dentist: DentistData; fees: FeeEntry[]; patient: PatientData }): boolean {
  switch (step) {
    case 'clinic': return validateClinicStep(data.clinic).length === 0;
    case 'dentist': return validateDentistStep(data.dentist).length === 0;
    case 'fees': return validateFeeScheduleStep(data.fees).length === 0;
    case 'patient': return validatePatientStep(data.patient).length === 0;
  }
}

describe('Onboarding Wizard — step labels', () => {
  test('clinic label', () => expect(getStepLabel('clinic')).toBe('Clinic Setup'));
  test('dentist label', () => expect(getStepLabel('dentist')).toBe('Dentist Profile'));
  test('fees label', () => expect(getStepLabel('fees')).toBe('Fee Schedule'));
  test('patient label', () => expect(getStepLabel('patient')).toBe('First Patient'));
});

describe('Onboarding Wizard — step numbers', () => {
  test('clinic is step 1', () => expect(getStepNumber('clinic')).toBe(1));
  test('dentist is step 2', () => expect(getStepNumber('dentist')).toBe(2));
  test('fees is step 3', () => expect(getStepNumber('fees')).toBe(3));
  test('patient is step 4', () => expect(getStepNumber('patient')).toBe(4));
});

describe('Onboarding Wizard — clinic validation', () => {
  test('missing name → error', () => {
    expect(validateClinicStep({ name: '', countryCode: 'PH', address: '', phone: '' })).toContain('Clinic name is required');
  });
  test('missing country → error', () => {
    expect(validateClinicStep({ name: 'Test', countryCode: '', address: '', phone: '' })).toContain('Country is required');
  });
  test('valid data → no errors', () => {
    expect(validateClinicStep({ name: 'Test', countryCode: 'PH', address: '123 St', phone: '' })).toHaveLength(0);
  });
});

describe('Onboarding Wizard — dentist validation', () => {
  test('missing name → error', () => {
    expect(validateDentistStep({ name: '', licenseNumber: '', specialization: '' })).toContain('Dentist name is required');
  });
  test('valid data → no errors', () => {
    expect(validateDentistStep({ name: 'Dr. Test', licenseNumber: '1234567', specialization: 'General' })).toHaveLength(0);
  });
});

describe('Onboarding Wizard — fee schedule validation', () => {
  test('always valid', () => expect(validateFeeScheduleStep([])).toHaveLength(0));
});

describe('Onboarding Wizard — patient validation', () => {
  test('missing name → error', () => {
    expect(validatePatientStep({ name: '', birthDate: '2000-01-01', gender: 'male', phone: '' })).toContain('Patient name is required');
  });
  test('missing birthDate → error', () => {
    expect(validatePatientStep({ name: 'Jose', birthDate: '', gender: 'male', phone: '' })).toContain('Date of birth is required');
  });
  test('valid data → no errors', () => {
    expect(validatePatientStep({ name: 'Jose', birthDate: '2000-01-01', gender: 'male', phone: '' })).toHaveLength(0);
  });
});

describe('Onboarding Wizard — canProceedToNext', () => {
  const validData = {
    clinic: { name: 'Test', countryCode: 'PH', address: '', phone: '' },
    dentist: { name: 'Dr Test', licenseNumber: '', specialization: '' },
    fees: [] as FeeEntry[],
    patient: { name: 'Jose', birthDate: '2000-01-01', gender: 'male', phone: '' },
  };

  test('valid clinic → can proceed', () => expect(canProceedToNext('clinic', validData)).toBe(true));
  test('invalid clinic → cannot proceed', () => {
    expect(canProceedToNext('clinic', { ...validData, clinic: { ...validData.clinic, name: '' } })).toBe(false);
  });
  test('fees always → can proceed', () => expect(canProceedToNext('fees', validData)).toBe(true));
  test('valid patient → can proceed', () => expect(canProceedToNext('patient', validData)).toBe(true));
});
