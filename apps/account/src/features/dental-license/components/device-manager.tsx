import React, { useState } from 'react';

interface Device {
  id: string;
  name: string;
  platform: 'macos' | 'windows' | 'ios' | 'android';
  lastSeen: string;
  status: 'active' | 'inactive';
  activatedAt: string;
}

export function getPlatformLabel(platform: Device['platform']): string {
  const labels: Record<string, string> = { macos: 'macOS', windows: 'Windows', ios: 'iOS', android: 'Android' };
  return labels[platform] ?? platform;
}

export function formatLastSeen(lastSeen: string): string {
  const diff = Date.now() - new Date(lastSeen).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DeviceManager() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // In production, this would come from API
  const devices: Device[] = [
    { id: '1', name: 'MacBook Pro', platform: 'macos', lastSeen: new Date().toISOString(), status: 'active', activatedAt: '2024-01-15' },
    { id: '2', name: 'iPad Pro', platform: 'ios', lastSeen: new Date(Date.now() - 3600000).toISOString(), status: 'active', activatedAt: '2024-03-01' },
  ];

  const filtered = filter === 'all' ? devices : devices.filter(d => d.status === filter);

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Devices</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage devices linked to your license</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Device list */}
      <div className="flex flex-col gap-3">
        {filtered.map(device => (
          <div key={device.id} className="rounded-xl border border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-sm">
                {device.platform === 'macos' || device.platform === 'windows' ? '💻' : '📱'}
              </div>
              <div>
                <p className="font-medium text-sm">{device.name}</p>
                <p className="text-xs text-muted-foreground">{getPlatformLabel(device.platform)} &middot; {formatLastSeen(device.lastSeen)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${device.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {device.status}
              </span>
              {device.status === 'active' && (
                <button className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Deactivate
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">No {filter} devices found.</div>
        )}
      </div>
    </div>
  );
}
