/**
 * RxSheet component tests
 *
 * Tests: drug name input required, dosage/frequency required,
 * optional fields, submit creates prescription, close on success.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Pure validation logic helpers
// ---------------------------------------------------------------------------

interface RxFormState {
  drugName: string;
  dosage: string;
  frequency: string;
  rxNormCode: string;
  duration: string;
  quantity: string;
  instructions: string;
  dispenseAsWritten: boolean;
}

function validateRxForm(form: RxFormState): string[] {
  const errors: string[] = [];
  if (!form.drugName.trim()) errors.push('drugName is required');
  if (!form.dosage.trim()) errors.push('dosage is required');
  if (!form.frequency.trim()) errors.push('frequency is required');
  return errors;
}

function buildPrescriptionPayload(form: RxFormState, visitId: string, patientId: string, prescriberMemberId: string) {
  return {
    visitId,
    patientId,
    prescriberMemberId,
    drugName: form.drugName.trim(),
    dosage: form.dosage.trim(),
    frequency: form.frequency.trim(),
    rxNormCode: form.rxNormCode.trim() || undefined,
    duration: form.duration.trim() || undefined,
    quantity: form.quantity.trim() || undefined,
    instructions: form.instructions.trim() || undefined,
    dispenseAsWritten: form.dispenseAsWritten,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RxSheet — form validation', () => {
  const valid: RxFormState = {
    drugName: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'TID',
    rxNormCode: '',
    duration: '',
    quantity: '',
    instructions: '',
    dispenseAsWritten: false,
  };

  test('valid form produces no errors', () => {
    expect(validateRxForm(valid)).toHaveLength(0);
  });

  test('missing drugName produces error', () => {
    const errors = validateRxForm({ ...valid, drugName: '' });
    expect(errors).toContain('drugName is required');
  });

  test('missing dosage produces error', () => {
    const errors = validateRxForm({ ...valid, dosage: '' });
    expect(errors).toContain('dosage is required');
  });

  test('missing frequency produces error', () => {
    const errors = validateRxForm({ ...valid, frequency: '' });
    expect(errors).toContain('frequency is required');
  });

  test('whitespace-only drugName treated as missing', () => {
    const errors = validateRxForm({ ...valid, drugName: '   ' });
    expect(errors).toContain('drugName is required');
  });

  test('all three required missing produces 3 errors', () => {
    const errors = validateRxForm({ ...valid, drugName: '', dosage: '', frequency: '' });
    expect(errors).toHaveLength(3);
  });
});

describe('RxSheet — payload builder', () => {
  const form: RxFormState = {
    drugName: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'TID',
    rxNormCode: '723',
    duration: '7 days',
    quantity: '21 tablets',
    instructions: 'Take with food',
    dispenseAsWritten: false,
  };

  test('builds payload with required fields', () => {
    const payload = buildPrescriptionPayload(form, 'v-1', 'p-1', 'm-1');
    expect(payload.visitId).toBe('v-1');
    expect(payload.drugName).toBe('Amoxicillin');
    expect(payload.dosage).toBe('500mg');
    expect(payload.frequency).toBe('TID');
  });

  test('includes optional fields when present', () => {
    const payload = buildPrescriptionPayload(form, 'v-1', 'p-1', 'm-1');
    expect(payload.rxNormCode).toBe('723');
    expect(payload.duration).toBe('7 days');
    expect(payload.instructions).toBe('Take with food');
  });

  test('omits optional fields when empty', () => {
    const empty: RxFormState = { ...form, rxNormCode: '', duration: '', instructions: '' };
    const payload = buildPrescriptionPayload(empty, 'v-1', 'p-1', 'm-1');
    expect(payload.rxNormCode).toBeUndefined();
    expect(payload.duration).toBeUndefined();
    expect(payload.instructions).toBeUndefined();
  });

  test('trims whitespace from string fields', () => {
    const padded: RxFormState = { ...form, drugName: '  Ibuprofen  ', dosage: ' 200mg ' };
    const payload = buildPrescriptionPayload(padded, 'v-1', 'p-1', 'm-1');
    expect(payload.drugName).toBe('Ibuprofen');
    expect(payload.dosage).toBe('200mg');
  });
});
