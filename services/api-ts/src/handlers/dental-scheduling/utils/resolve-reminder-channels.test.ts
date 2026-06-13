/**
 * Unit tests for the reminder consent gate (P1-24, plan §3.3 / §7).
 *
 * Pure function — no DB. Verifies fail-closed semantics, in-app always allowed,
 * marketing-consent NOT required, preferredChannel honored, global opt-out.
 */

import { describe, test, expect } from 'bun:test';
import { resolveConsentedChannels, type ReminderChannel, type PersonConsent } from './resolve-reminder-channels';

const POLICY: ReminderChannel[] = ['email', 'sms', 'push', 'in-app'];

function consent(channels: PersonConsent['channels']): PersonConsent {
  return { registrationConsent: true, capturedAt: '2026-01-01T00:00:00Z', channels };
}

describe('resolveConsentedChannels — consent gate', () => {
  test('in-app is always allowed even with no consent record at all', () => {
    const res = resolveConsentedChannels({ consent: null, policyChannels: POLICY });
    expect(res.channels).toContain('in-app');
  });

  test('SMS suppressed when channels.sms !== true (undefined fails closed)', () => {
    const res = resolveConsentedChannels({ consent: consent({ email: true }), policyChannels: POLICY });
    expect(res.channels).not.toContain('sms');
    expect(res.suppressed.some((s) => s.channel === 'sms')).toBe(true);
  });

  test('SMS allowed only when channels.sms === true', () => {
    const res = resolveConsentedChannels({ consent: consent({ sms: true }), policyChannels: POLICY });
    expect(res.channels).toContain('sms');
  });

  test('undefined consent fails closed for ALL outbound channels but keeps in-app', () => {
    const res = resolveConsentedChannels({ consent: undefined, policyChannels: POLICY });
    expect(res.channels).toEqual(['in-app']);
    expect(res.suppressed.map((s) => s.channel).sort()).toEqual(['email', 'push', 'sms']);
  });

  test('marketing consent is NOT required for transactional reminders', () => {
    // email opted in, marketing explicitly false → email still allowed
    const res = resolveConsentedChannels({
      consent: consent({ email: true, marketing: false }),
      policyChannels: ['email', 'in-app'],
    });
    expect(res.channels).toContain('email');
  });

  test('global opt-out (all known outbound false) suppresses all outbound, keeps in-app', () => {
    const res = resolveConsentedChannels({
      consent: consent({ email: false, sms: false, phone: false }),
      policyChannels: POLICY,
    });
    expect(res.channels).toEqual(['in-app']);
    expect(res.suppressed.every((s) => s.reason === 'global-opt-out')).toBe(true);
  });

  test('preferredChannel honored as primary — only preferred outbound + in-app returned', () => {
    const res = resolveConsentedChannels({
      consent: consent({ email: true, sms: true }),
      policyChannels: POLICY,
      preferredChannel: 'sms',
    });
    expect(res.channels.sort()).toEqual(['in-app', 'sms']);
    expect(res.channels).not.toContain('email');
  });

  test('preferred channel not eligible → falls back to other consented channels', () => {
    const res = resolveConsentedChannels({
      consent: consent({ email: true }), // sms NOT consented
      policyChannels: POLICY,
      preferredChannel: 'sms',
    });
    expect(res.channels).toContain('email');
    expect(res.channels).not.toContain('sms');
  });

  test("preferredChannel 'phone'/'none' impose no preference", () => {
    const res = resolveConsentedChannels({
      consent: consent({ email: true, sms: true }),
      policyChannels: POLICY,
      preferredChannel: 'phone',
    });
    expect(res.channels).toContain('email');
    expect(res.channels).toContain('sms');
  });

  test('only policy channels are considered (sms out of policy → never returned)', () => {
    const res = resolveConsentedChannels({
      consent: consent({ sms: true, email: true }),
      policyChannels: ['email', 'in-app'],
    });
    expect(res.channels).not.toContain('sms');
    expect(res.channels.sort()).toEqual(['email', 'in-app']);
  });
});

/**
 * FIX-006 (settings-relabel coherence): the clinic-wide "Notification Settings"
 * panel (apps/dentalemon notification-settings.tsx) stores DEFAULT preference
 * toggles, but this resolver is the SINGLE enforced gate and reads only per-patient
 * consent + branch policy. These pins make that honesty property regression-proof:
 * the resolver's contract has no clinic-preferences input, so a clinic "enabling" a
 * channel in the defaults panel can never override an unconsented patient.
 */
describe('resolveConsentedChannels — clinic defaults cannot override consent (FIX-006)', () => {
  test('a channel in branch policy is still suppressed when the patient has not consented', () => {
    // Branch policy "enables" email + sms (the clinic default posture), but the
    // patient consented to neither → both suppressed, only in-app transmits.
    const res = resolveConsentedChannels({
      consent: consent({}),
      policyChannels: ['email', 'sms', 'in-app'],
    });
    expect(res.channels).toEqual(['in-app']);
    expect(res.suppressed.map((s) => s.channel).sort()).toEqual(['email', 'sms']);
  });

  test('consent is the gate: identical policy yields different channels per patient consent', () => {
    const policyChannels: ReminderChannel[] = ['email', 'sms', 'in-app'];
    const consented = resolveConsentedChannels({ consent: consent({ email: true }), policyChannels });
    const notConsented = resolveConsentedChannels({ consent: consent({ email: false }), policyChannels });
    expect(consented.channels).toContain('email');
    expect(notConsented.channels).not.toContain('email');
  });
});
