/**
 * PatientFilterTabs component tests
 *
 * Four tabs: All | Active | Needs Follow-Up | Archived
 * Active tab is visually highlighted. Clicking a tab calls onFilterChange.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { PatientFilterTabs, type PatientFilter } from './patient-filter-tabs';

afterEach(cleanup);

describe('PatientFilterTabs', () => {
  test('renders all four filter tabs', () => {
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'all',
      onFilterChange: () => {},
    }));
    expect(screen.getByText(/All/)).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText(/Follow/)).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
  });

  test('marks the active tab with aria-selected=true', () => {
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'active',
      onFilterChange: () => {},
    }));
    const activeTab = screen.getByRole('tab', { name: /^Active$/ });
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
  });

  test('marks non-active tabs with aria-selected=false', () => {
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'active',
      onFilterChange: () => {},
    }));
    const allTab = screen.getByRole('tab', { name: /^All/ });
    expect(allTab.getAttribute('aria-selected')).toBe('false');
  });

  test('calls onFilterChange with "active" when Active is clicked', () => {
    let received: PatientFilter | null = null;
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'all',
      onFilterChange: (f) => { received = f; },
    }));
    fireEvent.click(screen.getByRole('tab', { name: /^Active$/ }));
    expect(received).toBe('active');
  });

  test('calls onFilterChange with "needs-follow-up" when Follow-Up is clicked', () => {
    let received: PatientFilter | null = null;
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'all',
      onFilterChange: (f) => { received = f; },
    }));
    fireEvent.click(screen.getByRole('tab', { name: /Follow/ }));
    expect(received).toBe('needs-follow-up');
  });

  test('calls onFilterChange with "archived" when Archived is clicked', () => {
    let received: PatientFilter | null = null;
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'all',
      onFilterChange: (f) => { received = f; },
    }));
    fireEvent.click(screen.getByRole('tab', { name: /Archived/ }));
    expect(received).toBe('archived');
  });

  test('shows count badge when count is provided', () => {
    render(React.createElement(PatientFilterTabs, {
      activeFilter: 'all',
      counts: { all: 47, active: 0, 'needs-follow-up': 6, archived: 0 },
      onFilterChange: () => {},
    }));
    expect(screen.getByText('47')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });
});
