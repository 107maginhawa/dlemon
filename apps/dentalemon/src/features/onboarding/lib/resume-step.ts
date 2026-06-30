/**
 * resume-step (G-26) — decide which wizard step a resumed onboarding session lands
 * on, given the persisted step. The owner PIN is deliberately NOT persisted (a
 * credential in localStorage is a security anti-pattern), so it is empty on every
 * mount. To guarantee a valid PIN is set before the org is provisioned, any saved
 * step PAST the dentist step (where the PIN is entered + validated) clamps back to
 * 'dentist' — forcing PIN re-entry rather than persisting it.
 */

export type WizardStep = 'clinic' | 'dentist' | 'fees' | 'patient';

const STEP_ORDER: WizardStep[] = ['clinic', 'dentist', 'fees', 'patient'];

export function resumeStep(savedStep: WizardStep | undefined): WizardStep {
  const idx = savedStep ? STEP_ORDER.indexOf(savedStep) : -1;
  if (idx < 0) return 'clinic';
  // Anything beyond 'dentist' (the PIN step) must drop back to 'dentist'.
  return idx > STEP_ORDER.indexOf('dentist') ? 'dentist' : savedStep!;
}
