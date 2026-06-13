/**
 * FIX-003 (GAP-4): communication-consent persistence must SURFACE failures.
 *
 * The post-registration consent PATCH previously used a raw fetch with a silent
 * `.catch(() => {})` — staff believed per-channel comms preferences saved when they
 * had not (Phase-2 reminders act on this consent). These tests pin that a failure
 * is surfaced (error toast) with a Retry affordance, and that the success path is
 * quiet. Drives via the global.fetch mock (SDK fns route through it), sonner mocked.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { jsonResponse } from '@/test-utils';
import {
  saveCommunicationConsent,
  persistCommunicationConsentWithRetry,
} from './communication-consent';

const _toastError = mock((_msg?: string, _opts?: unknown) => {});
const _toastSuccess = mock((_msg?: string) => {});
mock.module('sonner', () => ({ toast: { error: _toastError, success: _toastSuccess } }));

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  _toastError.mockClear();
  _toastSuccess.mockClear();
});

const CONSENT = { sms: true, email: false, phone: true, marketing: false };

describe('saveCommunicationConsent', () => {
  test('resolves on a 2xx', async () => {
    global.fetch = mock(() => jsonResponse({ ok: true }, 200)) as unknown as typeof fetch;
    await expect(saveCommunicationConsent('p1', CONSENT)).resolves.toBeUndefined();
  });

  test('throws on a non-2xx so the caller can surface it (not swallowed)', async () => {
    global.fetch = mock(() =>
      jsonResponse({ code: 'X', message: 'nope', statusCode: 500 }, 500),
    ) as unknown as typeof fetch;
    await expect(saveCommunicationConsent('p1', CONSENT)).rejects.toBeDefined();
  });
});

describe('persistCommunicationConsentWithRetry (FIX-003)', () => {
  test('success path surfaces NO error toast', async () => {
    global.fetch = mock(() => jsonResponse({ ok: true }, 200)) as unknown as typeof fetch;
    await persistCommunicationConsentWithRetry('p1', CONSENT);
    expect(_toastError).not.toHaveBeenCalled();
    // The initial (non-retry) success is silent — pins the isRetry guard so a
    // first-attempt success never spuriously toasts "preferences saved".
    expect(_toastSuccess).not.toHaveBeenCalled();
  });

  test('failure surfaces an error toast carrying the backend message + a Retry action', async () => {
    global.fetch = mock(() =>
      jsonResponse({ code: 'X', message: 'Consent save failed', statusCode: 500 }, 500),
    ) as unknown as typeof fetch;
    await persistCommunicationConsentWithRetry('p1', CONSENT);

    expect(_toastError).toHaveBeenCalledTimes(1);
    const [msg, opts] = _toastError.mock.calls[0] as [string, { action?: { label?: string; onClick?: unknown } }];
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).toMatch(/Consent save failed|communication/i);
    expect(opts?.action?.label).toBe('Retry');
    expect(typeof opts?.action?.onClick).toBe('function');
  });

  test('Retry action re-attempts and confirms success on a subsequent 2xx', async () => {
    global.fetch = mock(() =>
      jsonResponse({ code: 'X', message: 'fail', statusCode: 500 }, 500),
    ) as unknown as typeof fetch;
    await persistCommunicationConsentWithRetry('p1', CONSENT);
    const opts = _toastError.mock.calls[0]![1] as { action: { onClick: () => void } };

    // The network now recovers; clicking Retry should re-attempt and confirm.
    global.fetch = mock(() => jsonResponse({ ok: true }, 200)) as unknown as typeof fetch;
    opts.action.onClick();

    await waitFor(() => expect(_toastSuccess).toHaveBeenCalledTimes(1));
  });
});
