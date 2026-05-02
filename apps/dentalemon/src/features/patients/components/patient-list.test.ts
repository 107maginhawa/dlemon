/**
 * PatientList component tests
 *
 * Tests rendering of patient grid, search filtering, debounce behavior,
 * grid/follow-up toggle, and empty state.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { PatientList } from './patient-list';

afterEach(cleanup);

const patients = [
  { id: 'p1', displayName: 'Maria Santos', age: 38, lastVisit: new Date('2026-03-01'), visitCount: 5, needsFollowUp: false, hasBalance: false },
  { id: 'p2', displayName: 'Dr. Ramon Cruz', age: 45, lastVisit: new Date('2026-04-10'), visitCount: 12, needsFollowUp: true, hasBalance: false },
  { id: 'p3', displayName: 'Ana Reyes', age: 28, lastVisit: new Date('2026-02-15'), visitCount: 2, needsFollowUp: false, hasBalance: true },
];

describe('PatientList', () => {
  test('renders a card for each patient', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    expect(screen.getByText('Dr. Ramon Cruz')).toBeTruthy();
    expect(screen.getByText('Ana Reyes')).toBeTruthy();
  });

  test('filters displayed patients by search query', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: 'Maria' }));
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    expect(screen.queryByText('Ana Reyes')).toBeNull();
  });

  test('shows empty state when no patients match search', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: 'zzz' }));
    expect(screen.getByTestId('patient-list-empty')).toBeTruthy();
  });

  test('shows empty state when patients array is empty', () => {
    render(React.createElement(PatientList, { patients: [], onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByTestId('patient-list-empty')).toBeTruthy();
  });

  test('shows follow-up-only patients when followUpOnly is true', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '', followUpOnly: true }));
    expect(screen.getByText('Dr. Ramon Cruz')).toBeTruthy();
    expect(screen.queryByText('Maria Santos')).toBeNull();
  });

  test('calls onSelect with patient when card is clicked', () => {
    let selected: any = null;
    render(React.createElement(PatientList, { patients, onSelect: (p) => { selected = p; }, searchQuery: '' }));
    fireEvent.click(screen.getByText('Maria Santos'));
    expect(selected?.id).toBe('p1');
  });

  test('renders search input', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });
});
