/**
 * SettingsPage shell tests — dental-org AHA FIX-003 (settings panel registry).
 *
 * The route hardcoded a 5-tab union + inline array, so three pending modules
 * (consent-templates here, data-governance retention, dental-pmd cert) would
 * each have to restructure the same file. These tests pin a minimal registry:
 *   1. every registered panel renders a tab (no regression of the 5 existing);
 *   2. selecting a tab mounts that panel;
 *   3. the RBAC gate still denies non-settings roles.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { SettingsPage } from './settings-page';
import { SETTINGS_PANELS } from '../settings-panels';

const originalFetch = global.fetch;

beforeEach(() => {
  useOrgContextStore.setState({ branchId: 'b0000000-0000-4000-8000-00000000s3tt', role: 'dentist_owner' });
  global.fetch = (async () => jsonResponse([])) as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null, role: null });
  cleanup();
});

function renderPage(role = 'dentist_owner') {
  const qc = freshClientWithMutations();
  render(React.createElement(SettingsPage, { role }), { wrapper: makeWrapper(qc) });
}

describe('SettingsPage — panel registry (FIX-003)', () => {
  test('renders a tab for every registered panel including the 5 originals', () => {
    renderPage();
    for (const label of ['Clinic', 'Working Hours', 'Fee Schedule', 'Locale', 'Notifications']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });

  test('registry includes the new Consent Forms panel', () => {
    expect(SETTINGS_PANELS.some(p => /consent/i.test(p.label))).toBe(true);
    renderPage();
    expect(screen.getByRole('button', { name: /consent forms/i })).toBeDefined();
  });

  test('selecting the Consent Forms tab mounts the consent panel', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /consent forms/i }));
    await waitFor(() => expect(screen.getByTestId('consent-templates-panel')).toBeDefined());
  });

  test('non-settings role sees the access-denied message, no tabs', () => {
    renderPage('staff_scheduling');
    expect(screen.getByText(/do not have access to settings/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clinic' })).toBeNull();
  });
});
