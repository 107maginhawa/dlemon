/**
 * PatientQuickSearch tests — debounced typeahead → open patient workspace.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import { PatientQuickSearch } from './patient-quick-search';

const originalFetch = global.fetch;
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

// listDentalPatients returns a { data: [...] } envelope (the SDK transformer).
const PATIENTS = {
  data: [
    {
      id: 'p1',
      displayName: 'Sofia Cruz',
      person: { firstName: 'Sofia', lastName: 'Cruz', dateOfBirth: null },
      visitCount: 0,
      lastVisit: null,
      needsFollowUp: false,
      hasBalance: false,
      hasActivePaymentPlan: false,
      status: 'active',
    },
  ],
};

describe('PatientQuickSearch', () => {
  test('renders an accessible search input', () => {
    global.fetch = mock(() => jsonResponse([]));
    render(<PatientQuickSearch branchId="b1" onSelect={() => {}} />, {
      wrapper: makeWrapper(freshClient()),
    });
    expect(screen.getByLabelText('Search patients')).toBeTruthy();
  });

  test('shows no results dropdown below the minimum query length', () => {
    global.fetch = mock(() => jsonResponse(PATIENTS));
    render(<PatientQuickSearch branchId="b1" onSelect={() => {}} />, {
      wrapper: makeWrapper(freshClient()),
    });
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 's' } });
    expect(screen.queryByTestId('patient-search-results')).toBeNull();
  });

  test('typing a query surfaces a matching patient and selecting it fires onSelect', async () => {
    global.fetch = mock(() => jsonResponse(PATIENTS));
    const onSelect = mock(() => {});
    render(<PatientQuickSearch branchId="b1" onSelect={onSelect} />, {
      wrapper: makeWrapper(freshClient()),
    });

    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'sofia' } });

    const result = await screen.findByTestId('patient-search-result-p1', undefined, { timeout: 3000 });
    expect(result.textContent).toContain('Sofia Cruz');

    fireEvent.click(result);
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
  });
});
