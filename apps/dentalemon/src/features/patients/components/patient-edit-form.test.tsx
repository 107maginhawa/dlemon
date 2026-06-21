import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PatientEditForm, type PatientEditData } from './patient-edit-form';

function initial(overrides: Partial<PatientEditData> = {}): PatientEditData {
  return {
    firstName: 'Diego',
    lastName: 'Ramos',
    dateOfBirth: '1995-06-15',
    gender: 'male',
    email: '',
    phone: '',
    ...overrides,
  };
}

function setValue(label: string, value: string) {
  const el = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(el, { target: { value } });
}

describe('PatientEditForm', () => {
  afterEach(() => cleanup());

  // Regression: ISSUE-015 — the client allowed spaces in the phone (`/^\+?[\d\s]+$/`)
  // but the server requires strict E.164 (`^\+[1-9]\d{1,14}$`), so a natural
  // "+63 917 555 1234" passed client validation then 400'd with only a generic
  // "Could not save changes". Found by /qa on 2026-06-20.
  // Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
  test('normalizes a space-formatted phone to E.164 before submit', async () => {
    const onSubmit = mock(async () => {});
    render(
      <PatientEditForm
        open
        initial={initial()}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    );
    setValue('Phone', '+63 917 555 1234');
    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].phone).toBe('+639175551234');
  });

  test('accepts dashes/parens and still normalizes to E.164', () => {
    const onSubmit = mock(async () => {});
    render(
      <PatientEditForm open initial={initial()} onClose={() => {}} onSubmit={onSubmit} />,
    );
    setValue('Phone', '+63 (917) 555-1234');
    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSubmit.mock.calls[0][0].phone).toBe('+639175551234');
  });

  test('blocks a phone with no country code and shows actionable guidance', () => {
    const onSubmit = mock(async () => {});
    render(
      <PatientEditForm open initial={initial()} onClose={() => {}} onSubmit={onSubmit} />,
    );
    setValue('Phone', '0917 555 1234'); // no leading + → not valid E.164
    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/international format/i)).not.toBeNull();
  });

  test('first name is required', () => {
    const onSubmit = mock(async () => {});
    render(
      <PatientEditForm open initial={initial({ firstName: '' })} onClose={() => {}} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByText('Save Changes'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('First name is required')).not.toBeNull();
  });
});
