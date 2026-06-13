/**
 * DataErasurePanel tests — data-governance Batch E (erasure admin queue).
 *
 * Props-driven presentational tests: platform-admin self-gate, queue rendering,
 * requested-only action gating, the reject-needs-reason rule, approve/reject
 * callbacks fire with the right ids, busy disabling, and empty/loading/error
 * states. The container's live react-query/session wiring is proven by the
 * admin-approval E2E journey.
 */
import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { DataErasurePanel } from './data-erasure';
import type { DentalErasureModuleErasureRequest as ErasureRequest } from '@monobase/sdk-ts/generated';

function req(over: Partial<ErasureRequest> = {}): ErasureRequest {
  return {
    id: 'er000000-0000-4000-8000-000000000001',
    version: 1,
    createdAt: '2026-06-12T08:00:00.000Z' as unknown as Date,
    updatedAt: '2026-06-12T08:00:00.000Z' as unknown as Date,
    subjectPersonId: 'pe000000-0000-4000-8000-000000000001',
    subjectPatientId: 'pa000000-0000-4000-8000-000000000001',
    tenantId: 'or000000-0000-4000-8000-000000000001',
    branchId: null,
    status: 'requested',
    reason: 'GDPR Art.17 request',
    requestedBy: 'rb000000-0000-4000-8000-000000000001',
    reviewedBy: null,
    reviewedAt: null,
    processedAt: null,
    rejectionReason: null,
    legalHoldBlocked: false,
    ...over,
  };
}

const noop = () => {};

function renderPanel(props: Partial<React.ComponentProps<typeof DataErasurePanel>> = {}) {
  const merged: React.ComponentProps<typeof DataErasurePanel> = {
    isPlatformAdmin: true,
    requests: [req()],
    isLoading: false,
    error: null,
    statusFilter: '',
    onChangeStatus: noop,
    onApprove: noop,
    onReject: noop,
    busyId: null,
    ...props,
  };
  render(React.createElement(DataErasurePanel, merged));
  return merged;
}

afterEach(() => cleanup());

describe('DataErasurePanel', () => {
  test('non-admin sees the admin-only notice and no queue', () => {
    renderPanel({ isPlatformAdmin: false });
    expect(screen.getByTestId('data-erasure-admin-only')).not.toBeNull();
    expect(screen.queryByTestId('data-erasure-table')).toBeNull();
  });

  test('renders a row per request with its status badge', () => {
    renderPanel({ requests: [req(), req({ id: 'er000000-0000-4000-8000-000000000002', status: 'anonymized' })] });
    expect(screen.getAllByTestId('data-erasure-row').length).toBe(2);
    const badges = screen.getAllByTestId('data-erasure-status').map((b) => b.textContent);
    expect(badges).toContain('requested');
    expect(badges).toContain('anonymized');
  });

  test('Approve/Reject affordances only appear on requested rows', () => {
    renderPanel({ requests: [req({ status: 'anonymized' })] });
    expect(screen.queryByTestId('data-erasure-approve')).toBeNull();
    expect(screen.queryByTestId('data-erasure-reject')).toBeNull();
  });

  test('Approve fires onApprove with the request id', () => {
    const onApprove = mock(() => {});
    renderPanel({ onApprove });
    fireEvent.click(screen.getByTestId('data-erasure-approve'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove.mock.calls[0]![0]).toBe('er000000-0000-4000-8000-000000000001');
  });

  test('Reject is disabled until a reason is typed, then fires onReject(id, reason)', () => {
    const onReject = mock(() => {});
    renderPanel({ onReject });
    const rejectBtn = screen.getByTestId('data-erasure-reject') as HTMLButtonElement;
    expect(rejectBtn.disabled).toBe(true);
    fireEvent.click(rejectBtn);
    expect(onReject).not.toHaveBeenCalled(); // disabled — no callback
    fireEvent.change(screen.getByTestId('data-erasure-reject-reason'), { target: { value: 'Insufficient documentation' } });
    expect((screen.getByTestId('data-erasure-reject') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('data-erasure-reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject.mock.calls[0]).toEqual(['er000000-0000-4000-8000-000000000001', 'Insufficient documentation']);
  });

  test('a legal-hold-blocked row is flagged', () => {
    renderPanel({ requests: [req({ status: 'rejected', legalHoldBlocked: true })] });
    expect(screen.getByTestId('data-erasure-hold')).not.toBeNull();
  });

  test('busyId disables that row Approve + reason input', () => {
    const id = 'er000000-0000-4000-8000-000000000001';
    renderPanel({ busyId: id });
    expect((screen.getByTestId('data-erasure-approve') as HTMLButtonElement).disabled).toBe(true);
    // The reason input must lock during the mutation so the shown value can't
    // diverge from the value already submitted.
    expect((screen.getByTestId('data-erasure-reject-reason') as HTMLInputElement).disabled).toBe(true);
  });

  test('status filter change calls onChangeStatus', () => {
    const onChangeStatus = mock(() => {});
    renderPanel({ onChangeStatus });
    fireEvent.change(screen.getByLabelText(/status filter/i), { target: { value: 'requested' } });
    expect(onChangeStatus).toHaveBeenCalledWith('requested');
  });

  test('empty / loading / error states', () => {
    renderPanel({ requests: [] });
    expect(screen.getByTestId('data-erasure-empty')).not.toBeNull();
    cleanup();
    renderPanel({ isLoading: true });
    expect(screen.getByTestId('data-erasure-loading')).not.toBeNull();
    cleanup();
    renderPanel({ error: new Error('boom') });
    expect(screen.getByTestId('data-erasure-error')).not.toBeNull();
  });
});
