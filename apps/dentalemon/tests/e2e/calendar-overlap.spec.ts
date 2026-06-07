/**
 * E2E: concurrent appointments render side-by-side (not stacked)
 *
 * Regression guard for the calendar overlap nit: two appointments at the same
 * start time used to render full-width on top of each other. They must now
 * split into side-by-side columns (computeAppointmentColumns).
 *
 * Pattern: signUpOnboardAndUnlock → seed two same-time appts via API → open
 * /calendar (defaults to today / Day view) → assert the two cards' bounding
 * boxes do not horizontally overlap.
 */

import { test, expect } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

test.describe('Calendar — concurrent appointments render side-by-side', () => {
  test('two appointments at the same time split into non-overlapping columns', async ({ page }) => {
    const { branchId, memberId: ownerMemberId } = await signUpOnboardAndUnlock(page, {
      tier: 'clinic',
      label: 'Overlap',
    });

    const seeded = await page.evaluate(async ({ api, branchId, ownerMemberId }: { api: string; branchId: string; ownerMemberId: string }) => {
      const memberRes = await fetch(`${api}/dental/org/members`, { credentials: 'include' })
        .then(r => r.json() as any).catch(() => ({ items: [] }));
      const memberId = memberRes?.items?.[0]?.id ?? ownerMemberId;
      if (!memberId) return null;

      // Two appointments at the SAME start time today at 14:00 (inside the
      // calendar's 7AM-10PM display window). Provider overlap is non-blocking
      // (FR3.7 warns, does not reject), so both are created.
      const start = new Date();
      start.setHours(14, 0, 0, 0);
      const startAt = start.toISOString();
      const endAt = new Date(start.getTime() + 30 * 60000).toISOString();

      const ids: string[] = [];
      for (const name of ['Overlap Patient A', 'Overlap Patient B']) {
        const pt = await fetch(`${api}/dental/patients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ displayName: name, branchId, consentGiven: true }),
        });
        if (!pt.ok) return null;
        const patient = await pt.json() as any;
        const appt = await fetch(`${api}/dental/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patientId: patient.id, branchId, providerId: memberId, startAt, endAt, visitType: 'recall' }),
        });
        if (!appt.ok) return { ok: false, status: appt.status };
        ids.push((await appt.json() as any).id);
      }
      return { ok: true, ids };
    }, { api: API, branchId, ownerMemberId });

    if (!seeded || !('ok' in seeded) || !seeded.ok) {
      throw new Error(`Seeding two concurrent appointments failed: ${JSON.stringify(seeded)}`);
    }

    await spaNavigate(page, '/calendar');
    await expect(page.getByTestId('calendar-day')).toBeVisible({ timeout: 8000 });

    // Both appointments belong to one 2-column overlap cluster.
    const cards = page.locator('[data-appt-cols="2"]');
    await expect(cards).toHaveCount(2, { timeout: 8000 });

    const box0 = await cards.nth(0).boundingBox();
    const box1 = await cards.nth(1).boundingBox();
    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();

    // Side-by-side: one card's right edge is at/left of the other's left edge
    // (a 2px tolerance covers the inter-column gap rounding).
    const [left, right] = box0!.x <= box1!.x ? [box0!, box1!] : [box1!, box0!];
    expect(left.x + left.width).toBeLessThanOrEqual(right.x + 2);

    // And they occupy distinct columns (col 0 and col 1).
    const colValues = await cards.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.apptCol).sort(),
    );
    expect(colValues).toEqual(['0', '1']);
  });
});
