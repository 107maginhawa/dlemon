/**
 * PMDImport component tests
 *
 * Renders the SHIPPED PMDImport and drives its real three-step flow
 * (form → preview → confirm) against a mocked fetch. The previous version
 * asserted re-declared copies of validateImportForm / extractSafetyFloorPreview
 * that the component does not export — it proved nothing about shipped behaviour.
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PMDImport } from './pmd-import';

function makeWrapper(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

function installFetch(ok = true) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    return new Response(JSON.stringify(ok ? { id: 'pmd-1' } : { message: 'fail' }), {
      status: ok ? 201 : 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderImport(props: Partial<React.ComponentProps<typeof PMDImport>> = {}) {
  const onImported = props.onImported ?? mock(() => {});
  render(
    makeWrapper(React.createElement(PMDImport, {
      patientId: 'p-1',
      open: true,
      onClose: () => {},
      onImported,
      ...props,
    })),
  );
  return { onImported };
}

afterEach(cleanup);

describe('PMDImport — shipped component', () => {
  test('does not render when open=false', () => {
    const f = installFetch();
    try {
      renderImport({ open: false });
      expect(screen.queryByTestId('pmd-import')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('Preview surfaces validation errors for an empty form and stays on step 1', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderImport();
      await user.click(screen.getByRole('button', { name: /^preview$/i }));

      expect(screen.getByText('Source facility is required')).not.toBeNull();
      expect(screen.getByText('Source software/system is required')).not.toBeNull();
      expect(screen.getByText('PMD content is required')).not.toBeNull();
      // never reached the import call
      expect(f.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });

  test('rejects invalid-JSON content', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderImport();
      await user.type(screen.getByLabelText(/Source Facility/i), 'City Dental');
      await user.type(screen.getByLabelText(/Source Software/i), 'Open Dental v21.1');
      await user.type(screen.getByLabelText(/PMD Content/i), 'not-json');
      await user.click(screen.getByRole('button', { name: /^preview$/i }));

      expect(screen.getByText('PMD content must be valid JSON')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('previews the Safety Floor items then confirms the import POST', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      const { onImported } = renderImport();
      await user.type(screen.getByLabelText(/Source Facility/i), 'City Dental Clinic');
      await user.type(screen.getByLabelText(/Source Software/i), 'Open Dental v21.1');
      // JSON braces confuse userEvent.type's keyboard syntax → set the value directly.
      fireEvent.change(screen.getByLabelText(/PMD Content/i), {
        target: { value: '{"conditions":["I10"],"medications":["Amoxicillin"],"allergies":["Penicillin"]}' },
      });
      await user.click(screen.getByRole('button', { name: /^preview$/i }));

      // preview step renders the extracted items
      await waitFor(() => expect(screen.getByText('I10')).not.toBeNull());
      expect(screen.getByText('Amoxicillin')).not.toBeNull();
      expect(screen.getByText('Penicillin')).not.toBeNull();
      // no request yet — preview is client-side only
      expect(f.calls.length).toBe(0);

      await user.click(screen.getByRole('button', { name: /confirm import/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.endsWith('/dental/pmd/import'))).toBe(true),
      );
      const post = f.calls.find(c => c.url.endsWith('/dental/pmd/import'))!;
      expect(post.body.patientId).toBe('p-1');
      expect(post.body.sourceFacility).toBe('City Dental Clinic');
      expect(post.body.sourceDescription).toBe('Open Dental v21.1');
      expect(post.body.content).toContain('"conditions"');

      await waitFor(() => expect(screen.getByText(/imported successfully/i)).not.toBeNull());
      expect((onImported as any).mock.calls.length).toBe(1);
    } finally {
      f.restore();
    }
  });

  test('confirm imports AND merges the imported PMD safety floor (FIX-003 — no longer inert)', async () => {
    const user = userEvent.setup();
    const f = installFetch();
    try {
      renderImport();
      await user.type(screen.getByLabelText(/Source Facility/i), 'City Dental Clinic');
      await user.type(screen.getByLabelText(/Source Software/i), 'Open Dental v21.1');
      fireEvent.change(screen.getByLabelText(/PMD Content/i), {
        target: { value: '{"allergies":["Penicillin"]}' },
      });
      await user.click(screen.getByRole('button', { name: /^preview$/i }));
      await user.click(await screen.findByRole('button', { name: /confirm import/i }));

      // The import POST returns { id: 'pmd-1' }; the component must then merge it so
      // the previewed Safety Floor items actually land (the "Safety Floor updated" claim).
      await waitFor(() =>
        expect(f.calls.some(c =>
          c.method === 'POST' && c.url.endsWith('/dental/pmd/imported/pmd-1/merge-safety-floor'),
        )).toBe(true),
      );
      await waitFor(() => expect(screen.getByText(/imported successfully/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });

  test('a failed import returns to the form with an error and does not call onImported', async () => {
    const user = userEvent.setup();
    const f = installFetch(false);
    try {
      const { onImported } = renderImport();
      await user.type(screen.getByLabelText(/Source Facility/i), 'City Dental Clinic');
      await user.type(screen.getByLabelText(/Source Software/i), 'Dentrix G7');
      fireEvent.change(screen.getByLabelText(/PMD Content/i), {
        target: { value: '{"conditions":["K02"]}' },
      });
      await user.click(screen.getByRole('button', { name: /^preview$/i }));
      await user.click(await screen.findByRole('button', { name: /confirm import/i }));

      await waitFor(() => expect(screen.getByText('Failed to import PMD')).not.toBeNull());
      expect((onImported as any).mock.calls.length).toBe(0);
    } finally {
      f.restore();
    }
  });
});
