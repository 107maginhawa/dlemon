/**
 * authed-route-sweep.spec.ts — real-page route-error sweep.
 *
 * The oli-runtime-loop sweep reuses storageState across fresh pages, but the PIN
 * session is IN-MEMORY (cannot be seeded), so it lands on the PIN gate for every
 * _dashboard/_workspace route and never tests real pages — which is why it never
 * caught the calendar grid 400. This sweep PIN-unlocks ONCE and SPA-navigates each
 * authed route in a single page (PIN session persists), asserting that no page
 * hard-errors: no blocking 4xx/5xx to /dental/ (400 = malformed request / missing
 * required param — the calendar-class bug; 401/403 = auth; 5xx = server) and no
 * "Something went wrong" error state. A bare 404 is treated as benign (resource
 * not created yet).
 */
import { test, expect, type Page } from '@playwright/test';
import { authAdapter } from './oli-runtime.auth';
import { setMemberPin, spaNavigate, APP } from './helpers/perio-e2e';

const PIN = '123456';

// The demo org has multiple members, so /auth/pin-select is a profile PICKER
// ("Choose your profile") — pick the owner, THEN the keypad appears (pin-entry).
async function unlockAsOwner(page: Page): Promise<void> {
  await page.goto(`${APP}/auth/pin-select`);
  await page.waitForLoadState('networkidle');
  await page.getByText(/Dentist-Owner/i).first().click();
  await expect(page.getByRole('group', { name: /PIN keypad/i })).toBeVisible({ timeout: 15_000 });
  for (const digit of PIN) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => !url.pathname.includes('/auth/pin'), { timeout: 15_000 });
}

// Authed routes worth sweeping. `:patient` is substituted with the demo patient.
const ROUTES: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'dashboard' },
  { path: '/calendar', label: 'calendar' },
  { path: '/patients', label: 'patients-list' },
  { path: '/billing', label: 'billing' },
  { path: '/reports', label: 'reports' },
  { path: '/staff', label: 'staff' },
  { path: '/settings', label: 'settings' },
  { path: '/queue-board', label: 'queue-board' },
  { path: '/patients/:patient', label: 'patient-profile' },
  { path: '/:patient', label: 'workspace' },
];

function isBlocking(status: number): boolean {
  // 400 (bad request — FE sent malformed/missing-required), 401/403 (auth), 5xx
  // (server) are real bugs. 404 (missing resource) is benign-empty.
  return status === 400 || status === 401 || status === 403 || status >= 500;
}

test('authed route sweep — no page hard-errors (4xx/5xx / error-state)', async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Sign in (sets org-context localStorage) + resolve a demo patient.
  const { paramFixtures } = await authAdapter.setup(page);
  const patientId = paramFixtures?.patientId;
  expect(patientId, 'demo org must have a patient for the workspace/profile routes').toBeTruthy();
  const ctx = await page.evaluate(() => ({
    orgId: localStorage.getItem('currentOrgId') ?? '',
    branchId: localStorage.getItem('currentBranchId') ?? '',
    memberId: localStorage.getItem('currentMemberId') ?? '',
  }));

  // 2. Ensure a known PIN, then mint the in-memory pinSession through the UI.
  await setMemberPin(page, { ...ctx, pin: PIN }).catch(() => {});
  await unlockAsOwner(page);

  // 3. Capture blocking /dental responses + pageerrors per route.
  const blocking: { url: string; status: number }[] = [];
  const benign: { url: string; status: number }[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('response', (r) => {
    if (!r.url().includes('/dental/')) return;
    const s = r.status();
    if (s < 400) return;
    (isBlocking(s) ? blocking : benign).push({ url: r.url(), status: s });
  });

  const failures: string[] = [];

  for (const route of ROUTES) {
    const nav = route.path.replace(':patient', patientId!);
    blocking.length = 0;
    const errBefore = pageErrors.length;
    try {
      await spaNavigate(page, nav);
    } catch (e: any) {
      failures.push(`${route.label} (${nav}): navigation failed — ${e?.message ?? e}`);
      continue;
    }
    // Let async data queries settle so a fast 4xx is captured, not raced.
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);

    const hadError = await page.getByText(/something went wrong/i).count().catch(() => 0);
    const newPageErrors = pageErrors.slice(errBefore);

    if (blocking.length) {
      failures.push(`${route.label} (${nav}): blocking responses → ${blocking.map((b) => `${b.status} ${b.url}`).join(' | ')}`);
    }
    if (hadError > 0) {
      failures.push(`${route.label} (${nav}): "Something went wrong" error state visible`);
    }
    if (newPageErrors.length) {
      failures.push(`${route.label} (${nav}): pageerror → ${newPageErrors.join(' | ')}`);
    }
  }

  expect(failures, `\n${failures.join('\n')}\n`).toEqual([]);
});
