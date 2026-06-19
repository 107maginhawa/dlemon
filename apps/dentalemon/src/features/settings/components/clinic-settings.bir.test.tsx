/**
 * ClinicSettings — BIR receipt header fields (BR-055, PH).
 *
 * The owner sets registered name, business style and TIN here; they flow onto
 * the printed Official Receipt. Asserts the DOWNSTREAM effect: Save writes them.
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ClinicSettings } from './clinic-settings';

const BRANCH_ID = 'b0000000-0000-1000-8000-00000000bc55';
const originalFetch = global.fetch;
let putCalls: Array<{ body: Record<string, unknown> }> = [];

beforeEach(() => {
  putCalls = [];
  useOrgContextStore.setState({ branchId: BRANCH_ID });
  global.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : null;
    const url = req ? req.url : String(input);
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (method === 'PUT' && url.includes('/settings')) {
      let body: Record<string, unknown> = {};
      if (init?.body) body = JSON.parse(init.body as string);
      else if (req) { try { body = await req.clone().json(); } catch { /* none */ } }
      putCalls.push({ body });
      return jsonResponse({ branchId: BRANCH_ID, settings: body });
    }
    if (method === 'GET' && url.includes('/settings')) {
      return jsonResponse({ branchId: BRANCH_ID, settings: { clinicName: 'Existing', clinicAddress: 'Addr' } });
    }
    return jsonResponse({ branchId: BRANCH_ID, settings: {} });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null });
  cleanup();
});

describe('ClinicSettings — BIR fields (BR-055)', () => {
  test('saving persists registeredName, businessStyle and tin', async () => {
    const qc = freshClientWithMutations();
    render(React.createElement(ClinicSettings), { wrapper: makeWrapper(qc) });

    const tin = await screen.findByTestId('clinic-tin');
    fireEvent.change(screen.getByTestId('clinic-registered-name'), { target: { value: 'Dela Cruz Dental Clinic' } });
    fireEvent.change(screen.getByTestId('clinic-business-style'), { target: { value: 'Dentalemon' } });
    fireEvent.change(tin, { target: { value: '123-456-789-000' } });
    fireEvent.click(screen.getByTestId('save-clinic-settings'));

    await waitFor(() => expect(putCalls.length).toBeGreaterThan(0));
    expect(putCalls[0].body.registeredName).toBe('Dela Cruz Dental Clinic');
    expect(putCalls[0].body.businessStyle).toBe('Dentalemon');
    expect(putCalls[0].body.tin).toBe('123-456-789-000');
  });
});
