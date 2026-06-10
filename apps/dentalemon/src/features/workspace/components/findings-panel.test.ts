/**
 * FindingsPanel — P0-C condition-vocabulary findings + finding→treatment (FE).
 * Written RED before the component exists.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper as makeWrapperBase } from '@/test-utils';

mock.module('sonner', () => ({ toast: { error: mock(() => {}), success: mock(() => {}) } }));

import { FindingsPanel } from './findings-panel';

function makeWrapper() {
  return makeWrapperBase(freshClientWithMutations());
}

const ACTIVE_FINDING = {
  id: 'find-1', visitId: 'visit-1', patientId: 'pat-1',
  toothNumber: 16, surface: 'occlusal', conditionCode: 'caries', status: 'active', linkedTreatmentId: null,
};

function installFetch(findings: unknown[]) {
  const calls: Array<{ method: string; url: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const rawBody = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ method, url, body: rawBody ? JSON.parse(rawBody) : undefined });
    if (method === 'POST' && url.includes('/treatment')) {
      return new Response(JSON.stringify({ id: 'tx-1', toothNumber: 16, cdtCode: 'D2391', status: 'diagnosed' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (method === 'POST') {
      return new Response(JSON.stringify({ id: 'find-new', toothNumber: 16, conditionCode: 'caries', status: 'active' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (method === 'PATCH') {
      return new Response(JSON.stringify({ ...ACTIVE_FINDING, status: 'resolved' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ data: findings, pagination: { total: findings.length } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

afterEach(cleanup);

function renderPanel() {
  return render(React.createElement(FindingsPanel, { visitId: 'visit-1', toothNumber: 16 }), { wrapper: makeWrapper() });
}

describe('FindingsPanel', () => {
  test('renders the curated vocabulary picker', async () => {
    const { restore } = installFetch([]);
    try {
      renderPanel();
      expect(await screen.findByTestId('findings-panel')).toBeTruthy();
      // a representative curated code is offered
      expect(screen.getByTestId('finding-code-caries')).toBeTruthy();
      expect(screen.getByTestId('finding-code-calculus')).toBeTruthy();
    } finally { restore(); }
  });

  test('adding a finding fires POST findings with the chosen code + tooth', async () => {
    const { calls, restore } = installFetch([]);
    try {
      renderPanel();
      await screen.findByTestId('findings-panel');
      await userEvent.click(screen.getByTestId('finding-code-caries'));
      await userEvent.click(screen.getByTestId('finding-add-btn'));
      await waitFor(() => {
        const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/findings'));
        expect(post).toBeTruthy();
        expect(post!.body.conditionCode).toBe('caries');
        expect(post!.body.toothNumber).toBe(16);
      });
    } finally { restore(); }
  });

  test("choosing 'other' requires a note before Add is enabled", async () => {
    const { restore } = installFetch([]);
    try {
      renderPanel();
      await screen.findByTestId('findings-panel');
      await userEvent.click(screen.getByTestId('finding-code-other'));
      const addBtn = screen.getByTestId('finding-add-btn') as HTMLButtonElement;
      expect(addBtn.disabled).toBe(true);
      await userEvent.type(screen.getByTestId('finding-note-input'), 'Enamel pearl');
      expect(addBtn.disabled).toBe(false);
    } finally { restore(); }
  });

  test('lists active findings and Resolve fires PATCH status=resolved', async () => {
    const { calls, restore } = installFetch([ACTIVE_FINDING]);
    try {
      renderPanel();
      const row = await screen.findByTestId('finding-row-find-1');
      expect(row.textContent?.toLowerCase()).toContain('caries');
      await userEvent.click(within(row).getByTestId('finding-resolve-find-1'));
      await waitFor(() => {
        const patch = calls.find(c => c.method === 'PATCH');
        expect(patch).toBeTruthy();
        expect(patch!.body.status).toBe('resolved');
      });
    } finally { restore(); }
  });

  test('Convert to treatment fires POST .../treatment', async () => {
    const { calls, restore } = installFetch([ACTIVE_FINDING]);
    try {
      renderPanel();
      const row = await screen.findByTestId('finding-row-find-1');
      await userEvent.click(within(row).getByTestId('finding-convert-find-1'));
      // a small convert form appears with a default CDT/description; confirm it
      await userEvent.click(await screen.findByTestId('finding-convert-confirm-find-1'));
      await waitFor(() => {
        const post = calls.find(c => c.method === 'POST' && c.url.includes('/treatment'));
        expect(post).toBeTruthy();
        expect(typeof post!.body.cdtCode).toBe('string');
        expect(post!.body.cdtCode.length).toBeGreaterThan(0);
      });
    } finally { restore(); }
  });
});
