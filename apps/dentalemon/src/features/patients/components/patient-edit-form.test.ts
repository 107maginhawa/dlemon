/**
 * PatientEditForm component tests (FIX-001 / FR2.4)
 *
 * Demographics-correction form: name / DOB / gender, prefilled from the current
 * patient. Pure presentational form (the profile page owns the mutation), mirroring
 * PatientRegistrationModal. Archived patients are read-only (BR-015b).
 */

import { describe, test, expect, mock, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PatientEditForm } from './patient-edit-form';

afterEach(cleanup);

const initial = {
  firstName: 'Maria',
  lastName: 'Santos',
  dateOfBirth: '1990-04-22',
  gender: 'female',
};

describe('PatientEditForm', () => {
  test('renders prefilled demographics', () => {
    render(
      React.createElement(PatientEditForm, {
        open: true,
        initial,
        onClose: () => {},
        onSubmit: async () => {},
      }),
    );
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('Maria');
    expect((screen.getByLabelText(/last name/i) as HTMLInputElement).value).toBe('Santos');
    expect((screen.getByLabelText(/date of birth/i) as HTMLInputElement).value).toBe('1990-04-22');
    expect((screen.getByLabelText(/gender/i) as HTMLSelectElement).value).toBe('female');
  });

  test('does not render when open is false', () => {
    render(
      React.createElement(PatientEditForm, {
        open: false,
        initial,
        onClose: () => {},
        onSubmit: async () => {},
      }),
    );
    expect(screen.queryByLabelText(/first name/i)).toBeNull();
  });

  test('does not call onSubmit when first name is blank', async () => {
    const user = userEvent.setup();
    const onSubmit = mock(async () => {});
    render(
      React.createElement(PatientEditForm, { open: true, initial, onClose: () => {}, onSubmit }),
    );
    await user.clear(screen.getByLabelText(/first name/i));
    await user.click(screen.getByRole('button', { name: /save/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('calls onSubmit with edited demographics', async () => {
    const user = userEvent.setup();
    const onSubmit = mock(async () => {});
    render(
      React.createElement(PatientEditForm, { open: true, initial, onClose: () => {}, onSubmit }),
    );
    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), 'Mariana');
    await user.clear(screen.getByLabelText(/last name/i));
    await user.type(screen.getByLabelText(/last name/i), 'Reyes');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ firstName: 'Mariana', lastName: 'Reyes' });
  });

  test('archived patient is read-only: Save disabled and onSubmit not called', async () => {
    const user = userEvent.setup();
    const onSubmit = mock(async () => {});
    render(
      React.createElement(PatientEditForm, {
        open: true,
        initial,
        disabled: true,
        onClose: () => {},
        onSubmit,
      }),
    );
    const save = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.click(save);
    await new Promise((r) => setTimeout(r, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('surfaces a save error', () => {
    render(
      React.createElement(PatientEditForm, {
        open: true,
        initial,
        error: 'Could not save changes',
        onClose: () => {},
        onSubmit: async () => {},
      }),
    );
    expect(screen.getByText(/could not save changes/i)).not.toBeNull();
  });

  test('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(
      React.createElement(PatientEditForm, { open: true, initial, onClose, onSubmit: async () => {} }),
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
