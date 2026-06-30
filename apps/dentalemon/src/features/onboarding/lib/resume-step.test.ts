/**
 * resume-step — G-26: the owner PIN is (correctly) NOT persisted to localStorage,
 * so on a wizard resume it is always empty. If the saved step is PAST the dentist
 * step (where the PIN is entered + validated), the user could reach Finish and
 * provision the org with no usable owner PIN. Clamp the resume step back to
 * 'dentist' so the PIN is always re-entered — never persist the credential.
 */

import { describe, test, expect } from 'bun:test';
import { resumeStep } from './resume-step';

describe('resumeStep', () => {
  test('clinic / dentist resume unchanged (PIN re-entry still ahead or here)', () => {
    expect(resumeStep('clinic')).toBe('clinic');
    expect(resumeStep('dentist')).toBe('dentist');
  });

  test('steps past dentist clamp back to dentist (force PIN re-entry)', () => {
    expect(resumeStep('fees')).toBe('dentist');
    expect(resumeStep('patient')).toBe('dentist');
  });

  test('missing/invalid saved step starts at clinic', () => {
    expect(resumeStep(undefined)).toBe('clinic');
    expect(resumeStep('bogus' as never)).toBe('clinic');
  });
});
