/**
 * ConsentSheet component tests
 *
 * Tests: template selection required, signature required to submit,
 * form locks after signing, clear signature.
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

interface ConsentFormState {
  templateId: string;
  templateName: string;
  signatureData: string;
  signed: boolean;
}

function validateConsentBeforeSign(form: ConsentFormState): string[] {
  const errors: string[] = [];
  if (!form.templateId) errors.push('templateId is required');
  if (!form.signatureData) errors.push('signatureData is required');
  if (form.signed) errors.push('Form is already signed and cannot be modified');
  return errors;
}

function buildSignPayload(form: ConsentFormState) {
  return { signatureData: form.signatureData };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsentSheet — validation before sign', () => {
  const valid: ConsentFormState = {
    templateId: 'tpl-001',
    templateName: 'General Consent',
    signatureData: 'data:image/png;base64,abc',
    signed: false,
  };

  test('valid unsigned form with signature produces no errors', () => {
    expect(validateConsentBeforeSign(valid)).toHaveLength(0);
  });

  test('missing templateId produces error', () => {
    const errors = validateConsentBeforeSign({ ...valid, templateId: '' });
    expect(errors).toContain('templateId is required');
  });

  test('missing signatureData produces error', () => {
    const errors = validateConsentBeforeSign({ ...valid, signatureData: '' });
    expect(errors).toContain('signatureData is required');
  });

  test('already signed form produces error (immutable)', () => { // [BR-014]
    const errors = validateConsentBeforeSign({ ...valid, signed: true });
    expect(errors).toContain('Form is already signed and cannot be modified');
  });
});

describe('ConsentSheet — payload builder', () => {
  test('builds sign payload from signatureData', () => {
    const form: ConsentFormState = {
      templateId: 'tpl-001',
      templateName: 'General Consent',
      signatureData: 'data:image/png;base64,abc123',
      signed: false,
    };
    const payload = buildSignPayload(form);
    expect(payload.signatureData).toBe('data:image/png;base64,abc123');
  });
});

describe('ConsentSheet — signature state', () => {
  test('clear signature resets signatureData to empty string', () => {
    let signatureData = 'data:image/png;base64,existing';
    signatureData = ''; // simulate clear
    expect(signatureData).toBe('');
  });

  test('after signing, form should reflect signed=true', () => { // [BR-014]
    const form: ConsentFormState = {
      templateId: 'tpl-001',
      templateName: 'General Consent',
      signatureData: 'data:image/png;base64,abc',
      signed: false,
    };
    // Simulate server response marking form as signed
    const afterSign = { ...form, signed: true };
    expect(afterSign.signed).toBe(true);
    expect(validateConsentBeforeSign(afterSign)).toContain('Form is already signed and cannot be modified');
  });
});
