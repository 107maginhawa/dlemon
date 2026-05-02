/**
 * PatientFolderCard component tests
 *
 * Tests rendering of patient name, avatar/initials, status badge,
 * visit count, and overdue indicator.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { PatientFolderCard } from './patient-folder-card';

afterEach(cleanup);

const basePatient = {
  id: 'pat-1',
  displayName: 'Maria Santos',
  age: 38,
  lastVisit: new Date('2026-03-01'),
  visitCount: 5,
  needsFollowUp: false,
  hasBalance: false,
};

describe('PatientFolderCard', () => {
  test('renders patient display name', () => {
    render(React.createElement(PatientFolderCard, { patient: basePatient, onClick: () => {} }));
    expect(screen.getByText('Maria Santos')).toBeTruthy();
  });

  test('renders avatar initials from display name', () => {
    render(React.createElement(PatientFolderCard, { patient: basePatient, onClick: () => {} }));
    const avatar = screen.getByTestId('patient-avatar');
    expect(avatar.textContent?.trim()).toBeTruthy();
    // "Maria Santos" → "MS"
    expect(avatar.textContent?.trim()).toBe('MS');
  });

  test('renders visit count', () => {
    render(React.createElement(PatientFolderCard, { patient: basePatient, onClick: () => {} }));
    expect(screen.getByText(/5/)).toBeTruthy();
  });

  test('shows follow-up indicator when needsFollowUp is true', () => {
    render(React.createElement(PatientFolderCard, {
      patient: { ...basePatient, needsFollowUp: true },
      onClick: () => {},
    }));
    expect(screen.getByTestId('follow-up-indicator')).toBeTruthy();
  });

  test('does not show follow-up indicator when needsFollowUp is false', () => {
    render(React.createElement(PatientFolderCard, { patient: basePatient, onClick: () => {} }));
    expect(screen.queryByTestId('follow-up-indicator')).toBeNull();
  });

  test('shows balance badge when hasBalance is true', () => {
    render(React.createElement(PatientFolderCard, {
      patient: { ...basePatient, hasBalance: true },
      onClick: () => {},
    }));
    expect(screen.getByTestId('balance-badge')).toBeTruthy();
  });

  test('calls onClick when card is clicked', () => {
    let clicked = false;
    render(React.createElement(PatientFolderCard, {
      patient: basePatient,
      onClick: () => { clicked = true; },
    }));
    fireEvent.click(screen.getByTestId('patient-folder-card'));
    expect(clicked).toBe(true);
  });

  test('has accessible button role', () => {
    render(React.createElement(PatientFolderCard, { patient: basePatient, onClick: () => {} }));
    const card = screen.getByTestId('patient-folder-card');
    expect(card.getAttribute('role')).toBe('button');
  });
});
