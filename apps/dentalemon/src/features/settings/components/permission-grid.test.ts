/**
 * PermissionGrid helper tests (P2-17) — pure logic only (indexCells / diffOverrides).
 */
import { describe, test, expect } from 'bun:test';
import { indexCells, diffOverrides } from './permission-grid';
import type { PermissionGrid } from '../hooks/use-permissions';

const grid: PermissionGrid = {
  organizationId: 'org-1',
  catalog: [
    { feature: 'billing.invoice.void', label: 'Void invoices', category: 'Billing', defaultAllowedRoles: ['dentist_owner'] },
    { feature: 'reports.view', label: 'View reports', category: 'Reports', defaultAllowedRoles: ['dentist_owner'] },
  ],
  cells: [
    { role: 'dentist_owner', feature: 'billing.invoice.void', allowed: true, source: 'default' },
    { role: 'dentist_associate', feature: 'billing.invoice.void', allowed: false, source: 'default' },
    { role: 'dentist_owner', feature: 'reports.view', allowed: true, source: 'default' },
    { role: 'staff_full', feature: 'reports.view', allowed: false, source: 'default' },
  ],
};

describe('indexCells', () => {
  test('keys cells by role::feature', () => {
    const map = indexCells(grid);
    expect(map.get('dentist_owner::billing.invoice.void')).toBe(true);
    expect(map.get('dentist_associate::billing.invoice.void')).toBe(false);
    expect(map.size).toBe(4);
  });
});

describe('diffOverrides', () => {
  test('returns empty when nothing changed', () => {
    const edited = indexCells(grid);
    expect(diffOverrides(grid, edited)).toEqual([]);
  });

  test('returns only the changed cells', () => {
    const edited = indexCells(grid);
    edited.set('dentist_associate::billing.invoice.void', true); // grant
    edited.set('staff_full::reports.view', true); // grant
    const diff = diffOverrides(grid, edited);
    expect(diff).toHaveLength(2);
    expect(diff).toContainEqual({ role: 'dentist_associate', feature: 'billing.invoice.void', allowed: true });
    expect(diff).toContainEqual({ role: 'staff_full', feature: 'reports.view', allowed: true });
  });

  test('flipping a cell back to its original value produces no diff', () => {
    const edited = indexCells(grid);
    edited.set('dentist_associate::billing.invoice.void', true);
    edited.set('dentist_associate::billing.invoice.void', false); // back to original
    expect(diffOverrides(grid, edited)).toEqual([]);
  });
});
