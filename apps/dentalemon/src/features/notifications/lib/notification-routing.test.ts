/**
 * notification-routing pure-logic tests (notifications FIX-002 / GAP-2).
 */
import { describe, test, expect } from 'bun:test';
import { resolveNotificationDeepLink, makeNotificationClickHandler } from './notification-routing';

describe('resolveNotificationDeepLink', () => {
  test('appointment/booking types route to the calendar', () => {
    expect(resolveNotificationDeepLink({ type: 'booking.created' })).toBe('/calendar');
    expect(resolveNotificationDeepLink({ type: 'booking.cancelled' })).toBe('/calendar');
    expect(resolveNotificationDeepLink({ type: 'appointment.reminder' })).toBe('/calendar');
  });

  test('recall types route to patients', () => {
    expect(resolveNotificationDeepLink({ type: 'recall.due' })).toBe('/patients');
  });

  test('money types route to billing', () => {
    // The real producer emits the bare type 'billing' (finalizeInvoice / Stripe webhook).
    expect(resolveNotificationDeepLink({ type: 'billing' })).toBe('/billing');
    // invoice.*/payment.* are defensive forward-compat branches (no current producer).
    expect(resolveNotificationDeepLink({ type: 'invoice.finalized' })).toBe('/billing');
    expect(resolveNotificationDeepLink({ type: 'payment.received' })).toBe('/billing');
  });

  test('unknown / missing payload falls back to the dashboard — never a dead tap', () => {
    expect(resolveNotificationDeepLink({ type: 'system' })).toBe('/dashboard');
    expect(resolveNotificationDeepLink(undefined)).toBe('/dashboard');
    expect(resolveNotificationDeepLink({})).toBe('/dashboard');
  });
});

describe('makeNotificationClickHandler', () => {
  test('navigates to the deep link from the event additionalData', () => {
    const calls: Array<{ to: string }> = [];
    const handler = makeNotificationClickHandler((opts) => calls.push(opts));

    handler({ notification: { additionalData: { type: 'invoice.finalized', relatedEntity: 'inv-1' } } });
    expect(calls).toEqual([{ to: '/billing' }]);
  });

  test('reads additionalData from the top level too, and is robust to junk', () => {
    const calls: Array<{ to: string }> = [];
    const handler = makeNotificationClickHandler((opts) => calls.push(opts));

    handler({ additionalData: { type: 'recall.due' } });
    handler({ notification: { additionalData: 'not-an-object' as unknown as object } });
    handler(undefined);

    expect(calls).toEqual([{ to: '/patients' }, { to: '/dashboard' }, { to: '/dashboard' }]);
  });
});
