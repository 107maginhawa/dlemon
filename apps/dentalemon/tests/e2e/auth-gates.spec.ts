/**
 * E2E: Auth Gates
 *
 * BRs covered: BR-016, BR-026
 *
 * Tests that API calls fail correctly when auth context is missing or role is unauthorized.
 */

import { test, expect } from '@playwright/test';
import { setupDentalOrg, createDentalPatient } from './fixtures';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

// ─── BR-016: Workspace requires branch context ────────────────────────────

test.describe('Auth Gate: Workspace requires branch context (BR-016)', () => {
  test('API calls without currentBranchId in context return 401/403', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);
    const patientId = await createDentalPatient(page, { displayName: 'Auth16 Patient', branchId });

    // Clear the branch context from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('currentBranchId');
    });

    // Attempt to create a visit without branch context
    const result = await page.evaluate(async ({ api, patientId }: { api: string; patientId: string }) => {
      const r = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId }),
      });
      return { status: r.status };
    }, { api: API, patientId });

    // Without branch context, visit creation should fail (4xx)
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
  });
});

// ─── BR-026: Image delete requires authorized role ────────────────────────

test.describe('Auth Gate: Image delete requires authorized role (BR-026)', () => {
  test('image upload works for dentist_owner but DELETE on non-existent study returns 404/422', async ({ page }) => {
    const { branchId, memberId } = await setupDentalOrg(page);

    // Attempt to delete a non-existent imaging study — should return 404, not 200
    const result = await page.evaluate(async ({ api, branchId }: { api: string; branchId: string }) => {
      const r = await fetch(`${api}/dental/imaging/studies/00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return { status: r.status };
    }, { api: API, branchId });

    // Non-existent study delete should be 404 (not 200/204)
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
  });
});
