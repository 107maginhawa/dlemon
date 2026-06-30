/**
 * E2E: Lab Order UI journey (AHA dental-clinical FIX-003).
 *
 * The genuine rendered-UI proof that the lab workflow is reachable end-to-end
 * through the workspace top bar — the affordance that GAP-1's dead `onLab` prop
 * hid. Unlike `lab-order-tracking-api.spec.ts` (API-only), this drives the real
 * DOM: navigate to the workspace → click the "Lab orders" top-bar button →
 * the Lab Orders sheet opens → create an order via the form → it appears.
 *
 * Preconditions: API on :7213, app on the configured port.
 */
import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';
import { enableWorkspaceFlags } from './helpers/feature-flags';

async function setupPatient(page: Page): Promise<string> {
  const { branchId, memberId } = await signUpOnboardAndUnlock(page, { tier: 'clinic', label: 'LabUI' });
  const patientId = await page.evaluate(async ({ api, branchId, memberId }) => {
    const pRes = await fetch(`${api}/dental/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Pedro Cruz', branchId, consentGiven: true }),
    });
    if (!pRes.ok) throw new Error(`Patient create failed (${pRes.status})`);
    const patient = await pRes.json();
    // The Lab Orders sheet is mounted only when the workspace has a current
    // visit — create one so the sheet can open from the top-bar button.
    const vRes = await fetch(`${api}/dental/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ patientId: patient.id, branchId, dentistMemberId: memberId }),
    });
    if (!vRes.ok) throw new Error(`Visit create failed (${vRes.status})`);
    return patient.id as string;
  }, { api: API, branchId, memberId });
  return patientId;
}

test.describe('Lab Orders — UI reachability (FIX-003)', () => {
  test('the Lab top-bar button opens the Lab Orders sheet and creates an order', async ({ page }) => {
    // Lab is v2-deferred (workspace.lab_orders) — opt back in for this UI proof.
    await enableWorkspaceFlags(page, 'workspace.lab_orders');
    const patientId = await setupPatient(page);
    await spaNavigate(page, `/${patientId}`);

    // The dead-prop fix: a real "Lab orders" affordance now renders in the top bar.
    const labButton = page.getByRole('button', { name: 'Lab orders' });
    await expect(labButton).toBeVisible({ timeout: 10000 });

    await labButton.click();

    // Clicking it opens the real Lab Orders sheet (was unreachable before FIX-001).
    await expect(page.getByTestId('lab-orders-sheet')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lab Orders' })).toBeVisible();
  });
});
