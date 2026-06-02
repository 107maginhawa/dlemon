/**
 * E2E: Online / self-service patient booking (P1-25)
 *
 * A prospect books after-hours via the public /book/:branchId page:
 *   service -> slot -> contact details -> confirmation code.
 * The booking then appears on the staff calendar (list API) and can be checked
 * in by staff exactly like a staff-created appointment.
 *
 * Per memory feedback_playwright_over_human_checkpoint: this Playwright flow
 * replaces a human-verify checkpoint for the booking UI.
 */

import { test, expect, API, APP } from './fixtures';
import { setupDentalOrg } from './fixtures';

test.describe('Online self-service booking (P1-25)', () => {
  test('prospect books a slot -> appears on staff calendar -> staff checks in', async ({ page }) => {
    // Staff sets up org/branch/provider (and is signed in via the fixture session).
    const { branchId, memberId } = await setupDentalOrg(page);

    // Configure 24/7 working hours + enable online booking with zero lead-time so
    // the contract can book a near-future slot.
    await page.evaluate(async ({ api, branchId }) => {
      const wh: Record<string, unknown> = {};
      for (const d of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
        wh[d] = { enabled: true, open: '00:00', close: '23:59' };
      }
      await fetch(`${api}/dental/branches/${branchId}/working-hours`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ workingHours: wh }),
      });
      await fetch(`${api}/dental/branches/${branchId}/settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          onlineBooking: {
            enabled: true,
            bookableVisitTypes: ['checkup', 'recall'],
            leadTimeMinutes: 0,
            horizonDays: 365,
            slotStepMinutes: 30,
            requirePatientAuth: false,
          },
        }),
      });
    }, { api: API, branchId });

    // ── Public booking page (unauthenticated UX, but session cookie may exist;
    //    the public endpoints don't require it either way). ──
    await page.goto(`${APP}/book/${branchId}`);

    // Service step: pick checkup, then see times.
    await page.getByTestId('visit-type-checkup').click();
    await page.getByTestId('to-slots').click();

    // Slot step: pick the first available slot, hold it.
    const firstSlot = page.getByTestId('slot-option').first();
    await expect(firstSlot).toBeVisible();
    await firstSlot.click();
    await page.getByTestId('hold-slot').click();

    // Details step: enter name, confirm.
    await page.getByTestId('input-firstName').fill('Prospect Patient');
    await page.getByTestId('confirm-booking').click();

    // Confirmation shows a code.
    await expect(page.getByTestId('booking-confirmed')).toBeVisible();
    const code = (await page.getByTestId('confirmation-code').textContent())?.trim();
    expect(code && code.length).toBeGreaterThanOrEqual(6);

    // ── Staff side: the appointment is on the calendar (list API). ──
    const listed = await page.evaluate(async ({ api, branchId }) => {
      const today = new Date();
      const to = new Date(); to.setDate(to.getDate() + 31);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const r = await fetch(`${api}/dental/appointments?branchId=${branchId}&date_from=${fmt(today)}&date_to=${fmt(to)}`, {
        credentials: 'include',
      });
      return { status: r.status, body: await r.json() };
    }, { api: API, branchId });
    expect(listed.status).toBe(200);
    const online = (listed.body as Array<{ id: string; status: string }>).find((a) => a.status === 'scheduled');
    expect(online).toBeTruthy();

    // Staff checks the online booking in → draft visit created.
    const checkin = await page.evaluate(async ({ api, id }) => {
      const r = await fetch(`${api}/dental/appointments/${id}/check-in`, { method: 'POST', credentials: 'include' });
      return { status: r.status, body: await r.json() };
    }, { api: API, id: online!.id });
    expect(checkin.status).toBe(200);
    expect((checkin.body as { visitId?: string }).visitId).toBeTruthy();
  });
});
