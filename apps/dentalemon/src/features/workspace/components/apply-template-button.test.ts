/**
 * ApplyTemplateButton — dental-visit GAP-2 / decision #13 (WIRE FE).
 *
 * The clinical half of treatment templates: from an active visit a clinician
 * applies a reusable template (created in Settings → Treatment Templates) in one
 * action, which creates the template's items as `planned` treatments on the visit
 * via POST /dental/visits/{visitId}/apply-template/{templateId}.
 *
 * Gating mirrors the backend: applyTemplate is owner/associate-only
 * (assertBranchRole), so the affordance is hidden for read-only / assistant roles.
 *
 * RED-first: fails until apply-template-button.tsx + use-apply-template.ts exist.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase, jsonResponse } from '@/test-utils';
import { useOrgContextStore } from '@/stores/org-context.store';
import { ApplyTemplateButton } from './apply-template-button';

const _toastSuccess = mock(() => {});
const _toastError = mock(() => {});
mock.module('sonner', () => ({ toast: { success: _toastSuccess, error: _toastError } }));

const BRANCH_ID = 'b0000000-0000-4000-8000-0000000c0n5t';
const VISIT_ID = 'v0000000-0000-4000-8000-00000000v1s1';
const TEMPLATES = [
  { id: 'tpl-exam', branchId: BRANCH_ID, name: 'New Patient Exam', description: '', items: [{ cdtCode: 'D0150', description: 'Eval', priceCents: 150000 }], active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'tpl-crown', branchId: BRANCH_ID, name: 'Crown Workflow', description: '', items: [{ cdtCode: 'D2740', description: 'Crown', priceCents: 1800000 }], active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

const originalFetch = global.fetch;
let applyCalls: string[] = [];

function installFetch(role: string, templates = TEMPLATES) {
  useOrgContextStore.setState({ branchId: BRANCH_ID, role });
  applyCalls = [];
  global.fetch = (async (input: any, init?: any) => {
    const req = typeof input === 'string' ? null : input;
    const url = req ? req.url : input;
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase();
    if (url.includes('/apply-template/')) {
      applyCalls.push(url);
      return jsonResponse({ applied: [{ id: 'tx-1', status: 'planned' }], count: 1 }, 201);
    }
    if (url.includes('/treatment-templates')) return jsonResponse({ templates });
    return jsonResponse({});
  }) as typeof fetch;
}

function renderButton(props: Partial<{ visitId: string; patientId: string }> = {}) {
  render(
    React.createElement(ApplyTemplateButton, { visitId: VISIT_ID, patientId: 'patient-1', ...props }),
    { wrapper: makeWrapperBase(freshClientWithMutations()) },
  );
}

afterEach(() => {
  global.fetch = originalFetch;
  useOrgContextStore.setState({ branchId: null, role: null });
  cleanup();
});

describe('ApplyTemplateButton — apply a template to the active visit', () => {
  test('owner sees the Apply Template button and can open the template list', async () => {
    installFetch('dentist_owner');
    renderButton();
    const btn = await screen.findByRole('button', { name: /apply template/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText('New Patient Exam')).toBeDefined());
    expect(screen.getByText('Crown Workflow')).toBeDefined();
  });

  test('associate can apply — selecting a template POSTs to apply-template/{templateId}', async () => {
    installFetch('dentist_associate');
    renderButton();
    fireEvent.click(await screen.findByRole('button', { name: /apply template/i }));
    fireEvent.click(await screen.findByText('Crown Workflow'));
    await waitFor(() => expect(applyCalls.length).toBe(1));
    expect(applyCalls[0]).toContain(`/dental/visits/${VISIT_ID}/apply-template/tpl-crown`);
  });

  test('hidden for read-only / assistant roles (parity with backend owner/associate gate)', async () => {
    installFetch('staff_full');
    renderButton();
    // Give the query a tick; the button must never appear for a non-clinical role.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: /apply template/i })).toBeNull();
  });

  test('with no templates, opening shows a Settings nudge and fires no apply call', async () => {
    installFetch('dentist_owner', []);
    renderButton();
    fireEvent.click(await screen.findByRole('button', { name: /apply template/i }));
    await waitFor(() => expect(screen.getByText(/no treatment templates/i)).toBeDefined());
    expect(applyCalls.length).toBe(0);
  });
});
