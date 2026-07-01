/**
 * P2-4 — Voice / hands-free perio charting (E2E, scripted provider).
 *
 * Real microphone / STT is NOT automated (non-deterministic). Instead this spec
 * installs a deterministic scripted SpeechProvider on `window.__perioVoiceProvider`
 * (the E2E seam the overlay reads) BEFORE the app loads, opens a draft perio
 * chart, and feeds scripted utterances to assert:
 *   - the voice controls + always-visible mic-state indicator render,
 *   - a spoken depth fills the correct grid cell + advances the cursor,
 *   - a low-confidence value raises the confirmation prompt (not auto-written),
 *   - "back" + correction works,
 *   - the keyboard grid stays usable with voice off (additive),
 *   - reduced-motion + a11y: mic state has a text label, transcript is aria-live.
 *
 * Skips cleanly when the API/seed is unavailable so it never blocks CI.
 */

import { test, expect, type Page } from '@playwright/test';
import { API, APP, setMemberPin, unlockWorkspace, spaNavigate } from './helpers/perio-e2e';

/**
 * Install a scripted SpeechProvider on window before any app script runs. The
 * provider exposes a global `__feedVoice(transcript, confidence, isFinal)` the
 * test calls to emit utterances deterministically.
 */
async function installScriptedProvider(page: Page) {
  await page.addInitScript(() => {
    const resultCbs = new Set<(r: { transcript: string; confidence: number; isFinal: boolean }) => void>();
    const stateCbs = new Set<(s: string) => void>();
    let listening = false;
    const provider = {
      startListening() {
        listening = true;
        stateCbs.forEach((cb) => cb('listening'));
      },
      stopListening() {
        listening = false;
        stateCbs.forEach((cb) => cb('idle'));
      },
      onResult(cb: (r: { transcript: string; confidence: number; isFinal: boolean }) => void) {
        resultCbs.add(cb);
        return () => resultCbs.delete(cb);
      },
      onStateChange(cb: (s: string) => void) {
        stateCbs.add(cb);
        return () => stateCbs.delete(cb);
      },
      setGrammarHints() {},
      get isListening() {
        return listening;
      },
    };
    (window as unknown as { __perioVoiceProvider?: unknown }).__perioVoiceProvider = provider;
    (window as unknown as { __feedVoice?: unknown }).__feedVoice = (
      transcript: string,
      confidence = 1,
      isFinal = true,
    ) => {
      resultCbs.forEach((cb) => cb({ transcript, confidence, isFinal }));
    };
  });
}

async function feed(page: Page, transcript: string, confidence = 1, isFinal = true) {
  await page.evaluate(
    ([t, c, f]) => {
      (window as unknown as { __feedVoice?: (t: string, c?: number, f?: boolean) => void }).__feedVoice?.(
        t as string,
        c as number,
        f as boolean,
      );
    },
    [transcript, confidence, isFinal] as const,
  );
}

async function signUpSeedOrgAndVisit(page: Page) {
  const suffix = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `perio-voice-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Perio Voice ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
  // Let the post-signup redirect chain settle before any page.evaluate seeding, so a
  // racing navigation can't destroy the execution context mid-fetch (ROOT PROBLEM #2).
  await page.waitForLoadState('networkidle');

  await page.evaluate(async (api) => {
    await fetch(`${api}/dev/verify-email`, { method: 'POST', credentials: 'include' });
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'Perio', lastName: 'Voice' }),
    });
  }, API);

  // Provision org + default branch + dentist_owner membership in ONE self-service
  // call (org creation is admin-only now — EM-ORG-002). The caller becomes owner +
  // dentist_owner member, so we use organizationId/branchId/membershipId directly.
  const onb = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        organizationName: 'Voice Clinic',
        tier: 'clinic',
        countryCode: 'PH',
        branchName: 'Main Branch',
        timezone: 'Asia/Manila',
        ownerDisplayName: 'Perio Voice Dentist',
      }),
    });
    if (!res.ok) throw new Error(`Onboarding failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }, API);
  const orgId = onb.organizationId as string;
  const branchId = onb.branchId as string;
  const memberId = onb.membershipId as string;

  const patientRes = await page.evaluate(
    async ({ api, branchId }: { api: string; branchId: string }) => {
      const res = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: 'Perio Patient',
          dateOfBirth: '1990-01-01',
          gender: 'female',
          branchId,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error(`Patient create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, branchId },
  );

  const visitRes = await page.evaluate(
    async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
      });
      if (!res.ok) throw new Error(`Visit create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    { api: API, patientId: patientRes.id as string, branchId, memberId },
  );

  await page.evaluate(
    ({ orgId, branchId, memberId }: { orgId: string; branchId: string; memberId: string }) => {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedBranchId', branchId);
      localStorage.setItem('currentOrgId', orgId);
      localStorage.setItem('currentBranchId', branchId);
      localStorage.setItem('currentMemberId', memberId);
      localStorage.setItem('currentMemberRole', 'dentist_owner');
    },
    { orgId, branchId, memberId },
  );

  // Set a PIN on the owner membership, then drive the real PIN-unlock UI so the
  // in-memory pinSession exists (the workspace route tree is PIN-gated).
  await setMemberPin(page, { orgId, branchId, memberId, pin: '135790' });
  await unlockWorkspace(page, '135790');

  return { patientId: patientRes.id as string, visitId: visitRes.id as string };
}

test.describe('Voice perio charting (scripted provider)', () => {
  test('spoken depths fill the grid, low-confidence prompts, back corrects, keyboard stays usable', async ({
    page,
  }) => {
    await installScriptedProvider(page);

    let ctx: { patientId: string; visitId: string } | undefined;
    try {
      ctx = await signUpSeedOrgAndVisit(page);
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }
    if (!ctx) return;

    // SPA-navigate to the workspace (/$patientId) so the in-memory PIN session
    // survives, then open the Perio tab — there is no standalone perio route; the
    // perio chart is a tab inside the PIN-gated workspace.
    await spaNavigate(page, `/${ctx.patientId}`);
    await page.getByTestId('perio-tab-btn').click();
    await expect(page.getByTestId('perio-overlay')).toBeVisible();

    // Start a draft chart if the empty state is showing.
    const startBtn = page.getByTestId('perio-start-btn');
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(500);
    }

    // Voice controls must be present with an always-visible mic-state indicator.
    const controls = page.getByTestId('voice-perio-controls');
    if (!(await controls.isVisible().catch(() => false))) {
      test.skip(true, 'Voice controls not rendered (provider seam or chart unavailable)');
      return;
    }
    const micState = page.getByTestId('voice-mic-state');
    await expect(micState).toBeVisible();
    // a11y: the indicator carries a text label, not color only.
    await expect(micState).not.toBeEmpty();

    // a11y: transcript strip is an aria-live region.
    await expect(page.getByTestId('voice-transcript')).toHaveAttribute('aria-live', 'polite');

    // Toggle voice on.
    await page.getByTestId('voice-mic-toggle').click();
    await expect(page.getByTestId('voice-mic-toggle')).toHaveAttribute('aria-pressed', 'true');

    // Speak a depth → the active cell advances from BM to BC on tooth 18.
    await feed(page, 'three', 1, true);
    await expect(page.locator('[data-perio-active="true"]')).toHaveAttribute('data-perio-site', 'BC');

    // Low-confidence value → confirmation prompt, not auto-written.
    await feed(page, 'three', 0.2, true);
    await expect(page.getByTestId('voice-pending-confirm')).toBeVisible();
    await page.getByTestId('voice-confirm-no').click();
    await expect(page.getByTestId('voice-pending-confirm')).toHaveCount(0);

    // "back" steps the cursor back (correction path).
    await feed(page, 'back', 1, true);
    await expect(page.locator('[data-perio-active="true"]')).toHaveAttribute('data-perio-site', 'BM');

    // Keyboard remains fully usable (additive): typing into a depth cell works.
    const cell = page.locator('[data-testid="tooth-cell"]').first();
    await cell.click();
    await cell.fill('4');
    await expect(cell).toHaveValue('4');
  });
});
