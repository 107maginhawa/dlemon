/**
 * E2E: Letter of Authorization (LOA) — add → approve → list, through the DOM.
 *
 * Closes the orphaned-UI gap (plan 013): the coverage-authorization backend + hooks
 * shipped but had no UI, so the flow was unreachable. This drives the real panel in
 * the patient profile Payment tab: seed a patient + insurance profile, add an
 * authorization (profile + LOA number), then approve it — asserting each state
 * materialises in the DOM (requested → approved). The unit RTL test mocks the SDK;
 * this proves the wired-in panel works against a live backend.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

/** Seed a patient with one insurance profile (the LOA create needs an insuranceProfileId). */
async function seedPatientWithInsurance(
  page: Page,
  branchId: string,
): Promise<{ patientId: string; insuranceProfileId: string }> {
  const result = await page.evaluate(
    async ({ api, branchId }: { api: string; branchId: string }) => {
      const post = (path: string, body: unknown) =>
        fetch(`${api}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });

      const patient = await (await post('/dental/patients', { displayName: 'LOA Patient', branchId, consentGiven: true })).json() as any;
      const profRes = await post(`/dental/patients/${patient.id}/insurance-profiles`, {
        insurerName: 'Maxicare', policyNumber: 'LOA-POL-1', subscriberName: 'LOA Patient', payerType: 'hmo',
      });
      if (!profRes.ok) return { error: `insurance-profile ${profRes.status}: ${(await profRes.text()).slice(0, 200)}` };
      const profile = await profRes.json() as any;
      return { patientId: patient.id as string, insuranceProfileId: profile.id as string };
    },
    { api: API, branchId },
  );

  expect((result as any).error, `Seeding failed: ${(result as any)?.error}`).toBeUndefined();
  return result as { patientId: string; insuranceProfileId: string };
}

test.describe('LOA authorizations: add → approve → list (plan 013 orphaned-UI closure)', () => {
  test('Add authorization (profile + LOA number) → requested row → Approve → approved', async ({ page }) => {
    const { branchId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'LOA' });
    const { patientId, insuranceProfileId } = await seedPatientWithInsurance(page, branchId);

    await spaNavigate(page, `/patients/${patientId}`);
    await page.getByTestId('tab-payment').click();

    const panel = page.getByTestId('patient-authorizations');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('authorizations-empty')).toBeVisible();

    // Add an authorization through the form.
    await panel.getByTestId('add-authorization-btn').click();
    await expect(panel.getByTestId('authorization-form')).toBeVisible();
    await panel.getByTestId('authorization-insurer-select').selectOption(insuranceProfileId);
    await panel.getByTestId('authorization-loa-input').fill('LOA-E2E-7');
    await panel.getByTestId('authorization-submit').click();

    // A 'requested' row materialises with the LOA number + Approve/Deny actions.
    await expect(panel).toContainText('LOA-E2E-7');
    const row = panel.locator('[data-testid^="authorization-row-"]').filter({ hasText: 'LOA-E2E-7' });
    await expect(row).toContainText('requested');
    const approveBtn = row.getByRole('button', { name: 'Approve' });
    await expect(approveBtn).toBeVisible();

    // Approve → the FSM advances to 'approved' and the requested-only actions disappear.
    await approveBtn.click();
    await expect(row).toContainText('approved');
    await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });
});
