/**
 * DiscardVisitDialog — PP-8 (ISSUE-041). Replaces the native window.prompt().
 * Pins the reason gate (min 5 / max 500, mirroring the backend DiscardVisitRequest)
 * and that a valid reason reaches onConfirm trimmed.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { DiscardVisitDialog } from './discard-visit-dialog';

afterEach(cleanup);

describe('DiscardVisitDialog', () => {
  test('does not render when closed', () => {
    render(React.createElement(DiscardVisitDialog, { open: false, onClose: () => {}, onConfirm: async () => {} }));
    expect(screen.queryByTestId('discard-visit-dialog')).toBeNull();
  });

  test('blocks confirm when reason is too short (<5 chars)', () => {
    const onConfirm = mock(async () => {});
    render(React.createElement(DiscardVisitDialog, { open: true, onClose: () => {}, onConfirm }));
    fireEvent.change(screen.getByTestId('discard-reason'), { target: { value: 'no' } });
    fireEvent.click(screen.getByTestId('discard-visit-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/must be 5–500 characters/)).not.toBeNull();
  });

  test('calls onConfirm with the trimmed reason when valid', () => {
    const onConfirm = mock(async () => {});
    render(React.createElement(DiscardVisitDialog, { open: true, onClose: () => {}, onConfirm }));
    fireEvent.change(screen.getByTestId('discard-reason'), { target: { value: '  patient left early  ' } });
    fireEvent.click(screen.getByTestId('discard-visit-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]![0]).toBe('patient left early');
  });

  test('Keep visit triggers onClose', () => {
    const onClose = mock(() => {});
    render(React.createElement(DiscardVisitDialog, { open: true, onClose, onConfirm: async () => {} }));
    fireEvent.click(screen.getByText('Keep visit'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
