/**
 * PatientRegistrationModal component tests
 *
 * Tests form validation (name required, DOB format),
 * consent checkbox required, and submit creates patient.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PatientRegistrationModal } from './patient-registration-modal';

afterEach(cleanup);

describe('PatientRegistrationModal', () => {
  test('renders name input', () => {
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.getByLabelText(/full name/i)).not.toBeNull();
  });

  test('renders date of birth input', () => {
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.getByLabelText(/date of birth/i)).not.toBeNull();
  });

  test('renders consent checkbox', () => { // [BR-015]
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.getByTestId('consent-checkbox')).not.toBeNull();
  });

  test('does not call onSubmit when name is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = mock(async () => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit }));
    await user.click(screen.getByRole('button', { name: /register/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('does not call onSubmit when consent not checked', async () => { // [BR-015]
    const user = userEvent.setup();
    const onSubmit = mock(async () => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit }));
    await user.clear(screen.getByLabelText(/full name/i));
    await user.type(screen.getByLabelText(/full name/i), 'Maria Santos');
    await user.clear(screen.getByLabelText(/date of birth/i));
    await user.type(screen.getByLabelText(/date of birth/i), '1990-01-15');
    // Don't check consent
    await user.click(screen.getByRole('button', { name: /register/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('calls onSubmit with patient data when valid form submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = mock(async () => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose: () => {}, onSubmit }));
    await user.clear(screen.getByLabelText(/full name/i));
    await user.type(screen.getByLabelText(/full name/i), 'Maria Santos');
    await user.clear(screen.getByLabelText(/date of birth/i));
    await user.type(screen.getByLabelText(/date of birth/i), '1990-01-15');
    await user.selectOptions(screen.getByLabelText(/gender/i), 'female');
    await user.click(screen.getByTestId('consent-checkbox'));
    await user.click(screen.getByRole('button', { name: /register/i }));
    await new Promise(r => setTimeout(r, 50));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ displayName: 'Maria Santos' });
  });

  test('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(React.createElement(PatientRegistrationModal, { open: true, onClose, onSubmit: async () => {} }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not render when open is false', () => {
    render(React.createElement(PatientRegistrationModal, { open: false, onClose: () => {}, onSubmit: async () => {} }));
    expect(screen.queryByLabelText(/full name/i)).toBeNull();
  });
});
