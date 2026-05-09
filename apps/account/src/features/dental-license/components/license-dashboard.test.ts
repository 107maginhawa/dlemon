import { describe, test, expect } from 'bun:test';

// --- Pure helpers inlined for testing ---

interface LicenseInfo {
  tier: 'solo' | 'group' | 'enterprise';
  maxDevices: number;
  activeDevices: number;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'trial';
}

function getTierLabel(tier: LicenseInfo['tier']): string {
  const labels: Record<string, string> = { solo: 'Solo Practice', group: 'Group Practice', enterprise: 'Enterprise' };
  return labels[tier] ?? tier;
}

function getTierLimits(tier: LicenseInfo['tier']): { maxUsers: number; maxDevices: number; maxBranches: number } {
  const limits: Record<string, { maxUsers: number; maxDevices: number; maxBranches: number }> = {
    solo: { maxUsers: 3, maxDevices: 2, maxBranches: 1 },
    group: { maxUsers: 15, maxDevices: 10, maxBranches: 5 },
    enterprise: { maxUsers: 999, maxDevices: 999, maxBranches: 999 },
  };
  return limits[tier] ?? limits.solo!;
}

function getDeviceUsagePercent(info: LicenseInfo): number {
  if (info.maxDevices === 0) return 0;
  return Math.round((info.activeDevices / info.maxDevices) * 100);
}

function canAddDevice(info: LicenseInfo): boolean {
  return info.status === 'active' && info.activeDevices < info.maxDevices;
}

function isNearDeviceLimit(info: LicenseInfo): boolean {
  return info.activeDevices >= info.maxDevices - 1 && info.activeDevices < info.maxDevices;
}

function getStatusBadgeVariant(status: LicenseInfo['status']): 'default' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'expired') return 'destructive';
  return 'outline';
}

function canUpgrade(tier: LicenseInfo['tier']): boolean {
  return tier !== 'enterprise';
}

function getDaysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// --- Tests ---

describe('License Dashboard — getTierLabel', () => {
  test('solo → Solo Practice', () => {
    expect(getTierLabel('solo')).toBe('Solo Practice');
  });
  test('group → Group Practice', () => {
    expect(getTierLabel('group')).toBe('Group Practice');
  });
  test('enterprise → Enterprise', () => {
    expect(getTierLabel('enterprise')).toBe('Enterprise');
  });
});

describe('License Dashboard — getTierLimits', () => {
  test('solo limits', () => {
    expect(getTierLimits('solo')).toEqual({ maxUsers: 3, maxDevices: 2, maxBranches: 1 });
  });
  test('group limits', () => {
    expect(getTierLimits('group')).toEqual({ maxUsers: 15, maxDevices: 10, maxBranches: 5 });
  });
  test('enterprise limits', () => {
    expect(getTierLimits('enterprise')).toEqual({ maxUsers: 999, maxDevices: 999, maxBranches: 999 });
  });
});

describe('License Dashboard — device usage', () => {
  test('getDeviceUsagePercent calculates correctly', () => {
    expect(getDeviceUsagePercent({ tier: 'solo', maxDevices: 2, activeDevices: 1, expiresAt: null, status: 'active' })).toBe(50);
  });
  test('canAddDevice true when under limit', () => {
    expect(canAddDevice({ tier: 'solo', maxDevices: 2, activeDevices: 1, expiresAt: null, status: 'active' })).toBe(true);
  });
  test('canAddDevice false when at limit', () => {
    expect(canAddDevice({ tier: 'solo', maxDevices: 2, activeDevices: 2, expiresAt: null, status: 'active' })).toBe(false);
  });
  test('canAddDevice false when expired', () => {
    expect(canAddDevice({ tier: 'solo', maxDevices: 2, activeDevices: 0, expiresAt: null, status: 'expired' })).toBe(false);
  });
  test('isNearDeviceLimit true when one below max', () => {
    expect(isNearDeviceLimit({ tier: 'solo', maxDevices: 2, activeDevices: 1, expiresAt: null, status: 'active' })).toBe(true);
  });
});

describe('License Dashboard — status & upgrade', () => {
  test('active → default badge', () => {
    expect(getStatusBadgeVariant('active')).toBe('default');
  });
  test('expired → destructive badge', () => {
    expect(getStatusBadgeVariant('expired')).toBe('destructive');
  });
  test('trial → outline badge', () => {
    expect(getStatusBadgeVariant('trial')).toBe('outline');
  });
  test('canUpgrade true for solo', () => {
    expect(canUpgrade('solo')).toBe(true);
  });
  test('canUpgrade false for enterprise', () => {
    expect(canUpgrade('enterprise')).toBe(false);
  });
  test('getDaysUntilExpiry returns null for no expiry', () => {
    expect(getDaysUntilExpiry(null)).toBeNull();
  });
  test('getDaysUntilExpiry calculates positive days', () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    const days = getDaysUntilExpiry(future);
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(11);
  });
});
