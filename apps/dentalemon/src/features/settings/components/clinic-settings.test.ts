import { describe, test, expect } from 'bun:test';

interface ClinicSettingsForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  licenseNumber: string;
}

function validateClinicSettings(form: ClinicSettingsForm): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push('Clinic name is required');
  if (!form.address.trim()) errors.push('Address is required');
  if (form.phone.trim() && !/^[\d+\-() ]{7,}$/.test(form.phone.trim())) errors.push('Invalid phone format');
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.push('Invalid email format');
  return errors;
}

function buildClinicPayload(form: ClinicSettingsForm) {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    logoUrl: form.logoUrl.trim() || undefined,
    licenseNumber: form.licenseNumber.trim() || undefined,
  };
}

describe('Clinic Settings — validation', () => {
  const valid: ClinicSettingsForm = { name: 'Test Clinic', address: '123 Main St', phone: '+63 2 1234567', email: 'test@clinic.com', logoUrl: '', licenseNumber: '' };

  test('missing name → error', () => {
    expect(validateClinicSettings({ ...valid, name: '' })).toContain('Clinic name is required');
  });
  test('missing address → error', () => {
    expect(validateClinicSettings({ ...valid, address: '' })).toContain('Address is required');
  });
  test('valid data → no errors', () => {
    expect(validateClinicSettings(valid)).toHaveLength(0);
  });
  test('invalid phone → error', () => {
    expect(validateClinicSettings({ ...valid, phone: 'abc' })).toContain('Invalid phone format');
  });
  test('invalid email → error', () => {
    expect(validateClinicSettings({ ...valid, email: 'notanemail' })).toContain('Invalid email format');
  });
  test('optional email empty → no error', () => {
    expect(validateClinicSettings({ ...valid, email: '' })).toHaveLength(0);
  });
});

describe('Clinic Settings — buildClinicPayload', () => {
  test('trims name', () => {
    const p = buildClinicPayload({ name: '  Test  ', address: 'Addr', phone: '', email: '', logoUrl: '', licenseNumber: '' });
    expect(p.name).toBe('Test');
  });
  test('empty optional fields are undefined', () => {
    const p = buildClinicPayload({ name: 'Test', address: 'Addr', phone: '', email: '', logoUrl: '', licenseNumber: '' });
    expect(p.phone).toBeUndefined();
    expect(p.email).toBeUndefined();
  });
});
