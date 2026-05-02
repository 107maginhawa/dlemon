import { describe, test, expect } from 'bun:test';

// --- Pure helpers inlined for testing ---

interface Device {
  id: string;
  name: string;
  platform: 'macos' | 'windows' | 'ios' | 'android';
  lastSeen: string;
  status: 'active' | 'inactive';
  activatedAt: string;
}

function getPlatformIcon(platform: Device['platform']): string {
  const icons: Record<string, string> = { macos: 'laptop', windows: 'monitor', ios: 'smartphone', android: 'smartphone' };
  return icons[platform] ?? 'monitor';
}

function getPlatformLabel(platform: Device['platform']): string {
  const labels: Record<string, string> = { macos: 'macOS', windows: 'Windows', ios: 'iOS', android: 'Android' };
  return labels[platform] ?? platform;
}

function formatLastSeen(lastSeen: string): string {
  const diff = Date.now() - new Date(lastSeen).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function canDeactivateDevice(device: Device): boolean {
  return device.status === 'active';
}

function sortDevicesByLastSeen(devices: Device[]): Device[] {
  return [...devices].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

function filterDevicesByStatus(devices: Device[], status: 'all' | 'active' | 'inactive'): Device[] {
  if (status === 'all') return devices;
  return devices.filter(d => d.status === status);
}

function getDeviceCountByStatus(devices: Device[]): { active: number; inactive: number } {
  return {
    active: devices.filter(d => d.status === 'active').length,
    inactive: devices.filter(d => d.status === 'inactive').length,
  };
}

// --- Tests ---

const now = new Date();
const device1: Device = { id: '1', name: 'MacBook Pro', platform: 'macos', lastSeen: new Date(now.getTime() - 30000).toISOString(), status: 'active', activatedAt: '2024-01-01' };
const device2: Device = { id: '2', name: 'iPad', platform: 'ios', lastSeen: new Date(now.getTime() - 7200000).toISOString(), status: 'active', activatedAt: '2024-02-01' };
const device3: Device = { id: '3', name: 'Old PC', platform: 'windows', lastSeen: new Date(now.getTime() - 172800000).toISOString(), status: 'inactive', activatedAt: '2023-06-01' };

describe('Device Manager — platform helpers', () => {
  test('getPlatformIcon returns laptop for macos', () => {
    expect(getPlatformIcon('macos')).toBe('laptop');
  });
  test('getPlatformIcon returns smartphone for ios', () => {
    expect(getPlatformIcon('ios')).toBe('smartphone');
  });
  test('getPlatformLabel returns macOS for macos', () => {
    expect(getPlatformLabel('macos')).toBe('macOS');
  });
  test('getPlatformLabel returns Windows for windows', () => {
    expect(getPlatformLabel('windows')).toBe('Windows');
  });
});

describe('Device Manager — formatLastSeen', () => {
  test('recent → Just now', () => {
    expect(formatLastSeen(new Date(Date.now() - 10000).toISOString())).toBe('Just now');
  });
  test('minutes ago', () => {
    expect(formatLastSeen(new Date(Date.now() - 300000).toISOString())).toBe('5m ago');
  });
  test('hours ago', () => {
    expect(formatLastSeen(new Date(Date.now() - 7200000).toISOString())).toBe('2h ago');
  });
  test('days ago', () => {
    expect(formatLastSeen(new Date(Date.now() - 172800000).toISOString())).toBe('2d ago');
  });
});

describe('Device Manager — device actions', () => {
  test('canDeactivateDevice true for active', () => {
    expect(canDeactivateDevice(device1)).toBe(true);
  });
  test('canDeactivateDevice false for inactive', () => {
    expect(canDeactivateDevice(device3)).toBe(false);
  });
});

describe('Device Manager — sorting & filtering', () => {
  test('sortDevicesByLastSeen orders most recent first', () => {
    const sorted = sortDevicesByLastSeen([device3, device1, device2]);
    expect(sorted[0]!.id).toBe('1');
    expect(sorted[2]!.id).toBe('3');
  });
  test('filterDevicesByStatus all returns all', () => {
    expect(filterDevicesByStatus([device1, device2, device3], 'all')).toHaveLength(3);
  });
  test('filterDevicesByStatus active returns 2', () => {
    expect(filterDevicesByStatus([device1, device2, device3], 'active')).toHaveLength(2);
  });
  test('filterDevicesByStatus inactive returns 1', () => {
    expect(filterDevicesByStatus([device1, device2, device3], 'inactive')).toHaveLength(1);
  });
  test('getDeviceCountByStatus counts correctly', () => {
    expect(getDeviceCountByStatus([device1, device2, device3])).toEqual({ active: 2, inactive: 1 });
  });
});
