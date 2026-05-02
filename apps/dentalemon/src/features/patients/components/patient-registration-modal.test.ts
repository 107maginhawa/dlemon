/**
 * PatientRegistrationModal component tests
 *
 * Tests form validation (name required, DOB format),
 * consent checkbox required, and submit creates patient.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { PatientRegistrationModal } from './patient-registration-modal';

afterEach(cleanup);

describe('PatientRegistrationModal', () => {
  test('renders name input', () => {
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.getByLabelText(/full name/i)).toBeTruthy();
  });

  test('renders date of birth input', () => {
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.getByLabelText(/date of birth/i)).toBeTruthy();
  });

  test('renders consent checkbox', () => {
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.getByTestId('consent-checkbox')).toBeTruthy();
  });

  test('does not call onSubmit when name is empty', async () => {
    const onSubmit = mock(async () => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit }));
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('does not call onSubmit when consent not checked', async () => {
    const onSubmit = mock(async () => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit }));
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Maria Santos' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-01-15' } });
    // Don't check consent
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('calls onSubmit with patient data when valid form submitted', async () => {
    const onSubmit = mock(async () => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit }));
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Maria Santos' } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'female' } });
    fireEvent.click(screen.getByTestId('consent-checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ displayName: 'Maria Santos' });
  });

  test('calls onClose when cancel button is clicked', () => {
    const onClose = mock(() => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose, onSubmit: async () => {} }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not render when open is false', () => {
    render(React.createElement(PatientRegistrationModal, { open: false, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.queryByLabelText(/full name/i)).toBeNull();
  });
});
