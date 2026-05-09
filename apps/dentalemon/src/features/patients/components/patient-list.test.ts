/**
 * PatientList component tests
 *
 * Tests rendering of patient grid, search filtering, loading skeleton,
 * and empty state. Follow-up filtering is now done at the query level
 * (usePatients hook + PatientFilterTabs) — not in PatientList.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { PatientList } from './patient-list';

afterEach(cleanup);

const patients = [
  { id: 'p1', displayName: 'Maria Santos', age: 38, lastVisit: new Date('2026-03-01'), visitCount: 5, needsFollowUp: false, hasBalance: false },
  { id: 'p2', displayName: 'Ramon Cruz', age: 45, lastVisit: new Date('2026-04-10'), visitCount: 12, needsFollowUp: true, hasBalance: false },
  { id: 'p3', displayName: 'Ana Reyes', age: 28, lastVisit: new Date('2026-02-15'), visitCount: 2, needsFollowUp: false, hasBalance: true },
];

describe('PatientList', () => {
  test('renders a card for each patient (last name in caps)', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    // PatientFolderCard shows last name uppercase
    expect(screen.getByText('SANTOS')).toBeTruthy();
    expect(screen.getByText('CRUZ')).toBeTruthy();
    expect(screen.getByText('REYES')).toBeTruthy();
  });

  test('filters displayed patients by search query (matches displayName)', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: 'Maria' }));
    expect(screen.getByText('SANTOS')).toBeTruthy();
    expect(screen.queryByText('REYES')).toBeNull();
  });

  test('shows empty state when no patients match search', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: 'zzz' }));
    expect(screen.getByTestId('patient-list-empty')).toBeTruthy();
  });

  test('shows empty state when patients array is empty', () => {
    render(React.createElement(PatientList, { patients: [], onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByTestId('patient-list-empty')).toBeTruthy();
  });

  test('shows loading skeleton when isLoading is true', () => {
    render(React.createElement(PatientList, { patients: [], isLoading: true, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByTestId('patient-list-loading')).toBeTruthy();
  });

  test('does not show skeleton when isLoading is false', () => {
    render(React.createElement(PatientList, { patients, isLoading: false, onSelect: () => {}, searchQuery: '' }));
    expect(screen.queryByTestId('patient-list-loading')).toBeNull();
  });

  test('calls onSelect with patient when card is clicked', () => {
    let selected: any = null;
    render(React.createElement(PatientList, { patients, onSelect: (p) => { selected = p; }, searchQuery: '' }));
    // Click on the first card (Maria Santos → shows "SANTOS")
    fireEvent.click(screen.getAllByTestId('patient-folder-card')[0]!);
    expect(selected?.id).toBe('p1');
  });

  test('renders search input', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });
});
