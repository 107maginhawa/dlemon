/**
 * Billing onboarding flow unit tests
 *
 * Tests the pure helper functions: isOnboardingComplete, canAccessDashboard,
 * getAccountSetupStatus. The main flow requires mocking generated SDK calls.
 */

import { describe, test, expect } from 'bun:test';
import {
  isOnboardingComplete,
  canAccessDashboard,
  getAccountSetupStatus,
} from './billing-onboarding';
import type { MerchantAccount } from '../generated/types.gen';

// Helper to create a minimal MerchantAccount for testing
function makeMerchantAccount(metadata: Record<string, unknown> = {}): MerchantAccount {
  return {
    id: 'ma-1',
    person: 'person-1',
    active: true,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as MerchantAccount;
}

describe('isOnboardingComplete', () => {
  test('returns false for null account', () => {
    expect(isOnboardingComplete(null)).toBe(false);
  });

  test('returns false for undefined account', () => {
    expect(isOnboardingComplete(undefined)).toBe(false);
  });

  test('returns false when metadata has no onboardingComplete', () => {
    const account = makeMerchantAccount({});
    expect(isOnboardingComplete(account)).toBe(false);
  });

  test('returns false when onboardingComplete is false', () => {
    const account = makeMerchantAccount({ onboardingComplete: false });
    expect(isOnboardingComplete(account)).toBe(false);
  });

  test('returns true when onboardingComplete is true', () => {
    const account = makeMerchantAccount({ onboardingComplete: true });
    expect(isOnboardingComplete(account)).toBe(true);
  });
});

describe('canAccessDashboard', () => {
  test('returns false for null account', () => {
    expect(canAccessDashboard(null)).toBe(false);
  });

  test('returns false when no dashboardAccessEnabled', () => {
    const account = makeMerchantAccount({});
    expect(canAccessDashboard(account)).toBe(false);
  });

  test('returns true when dashboardAccessEnabled is true', () => {
    const account = makeMerchantAccount({ dashboardAccessEnabled: true });
    expect(canAccessDashboard(account)).toBe(true);
  });
});

describe('getAccountSetupStatus', () => {
  test('returns "none" for null account', () => {
    expect(getAccountSetupStatus(null)).toBe('none');
  });

  test('returns "none" for undefined account', () => {
    expect(getAccountSetupStatus(undefined)).toBe('none');
  });

  test('returns "incomplete" when onboarding not complete', () => {
    const account = makeMerchantAccount({ onboardingComplete: false });
    expect(getAccountSetupStatus(account)).toBe('incomplete');
  });

  test('returns "incomplete" when no metadata', () => {
    const account = makeMerchantAccount({});
    expect(getAccountSetupStatus(account)).toBe('incomplete');
  });

  test('returns "complete" when onboarding is complete', () => {
    const account = makeMerchantAccount({ onboardingComplete: true });
    expect(getAccountSetupStatus(account)).toBe('complete');
  });
});
