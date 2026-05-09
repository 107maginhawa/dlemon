import React from 'react';

interface LicenseInfo {
  tier: 'solo' | 'group' | 'enterprise';
  maxDevices: number;
  activeDevices: number;
  maxUsers: number;
  activeUsers: number;
  maxBranches: number;
  activeBranches: number;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'trial';
}

export function getTierLabel(tier: LicenseInfo['tier']): string {
  const labels: Record<string, string> = { solo: 'Solo Practice', group: 'Group Practice', enterprise: 'Enterprise' };
  return labels[tier] ?? tier;
}

export function getDeviceUsagePercent(maxDevices: number, activeDevices: number): number {
  if (maxDevices === 0) return 0;
  return Math.round((activeDevices / maxDevices) * 100);
}

export function canUpgrade(tier: LicenseInfo['tier']): boolean {
  return tier !== 'enterprise';
}

export function getStatusBadgeClass(status: LicenseInfo['status']): string {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'expired') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

export function LicenseDashboard() {
  // In production, this would come from API
  const license: LicenseInfo = {
    tier: 'solo',
    maxDevices: 2,
    activeDevices: 1,
    maxUsers: 3,
    activeUsers: 1,
    maxBranches: 1,
    activeBranches: 1,
    expiresAt: null,
    status: 'active',
  };

  const usageItems = [
    { label: 'Devices', active: license.activeDevices, max: license.maxDevices },
    { label: 'Users', active: license.activeUsers, max: license.maxUsers },
    { label: 'Branches', active: license.activeBranches, max: license.maxBranches },
  ];

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">License</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your Dentalemon subscription</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(license.status)}`}>
          {license.status.charAt(0).toUpperCase() + license.status.slice(1)}
        </span>
      </div>

      {/* Tier Card */}
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Plan</p>
            <p className="text-2xl font-semibold mt-1">{getTierLabel(license.tier)}</p>
          </div>
          {canUpgrade(license.tier) && (
            <button className="h-9 px-4 rounded-lg bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors">
              Upgrade Plan
            </button>
          )}
        </div>

        {/* Usage bars */}
        <div className="grid gap-4 mt-4">
          {usageItems.map(item => {
            const pct = getDeviceUsagePercent(item.max, item.active);
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.active} / {item.max}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-[#FFE97D] transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <a href="/devices" className="rounded-xl border border-border p-4 hover:bg-secondary/50 transition-colors">
          <p className="text-sm font-medium">Manage Devices</p>
          <p className="text-xs text-muted-foreground mt-1">{license.activeDevices} active</p>
        </a>
        <a href="/storage" className="rounded-xl border border-border p-4 hover:bg-secondary/50 transition-colors">
          <p className="text-sm font-medium">Storage</p>
          <p className="text-xs text-muted-foreground mt-1">View usage & backups</p>
        </a>
      </div>
    </div>
  );
}
