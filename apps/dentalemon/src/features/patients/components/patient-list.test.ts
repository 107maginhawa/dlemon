/**
 * PatientList component tests
 *
 * Tests rendering of patient grid, search filtering, loading skeleton,
 * empty state, and action buttons (archive, restore, bulk select, export).
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PatientList } from './patient-list';

afterEach(cleanup);

const patients = [
  { id: 'p1', displayName: 'Maria Santos', age: 38, lastVisit: new Date('2026-03-01'), visitCount: 5, needsFollowUp: false, hasBalance: false, status: 'active' as const },
  { id: 'p2', displayName: 'Ramon Cruz', age: 45, lastVisit: new Date('2026-04-10'), visitCount: 12, needsFollowUp: true, hasBalance: false, status: 'active' as const },
  { id: 'p3', displayName: 'Ana Reyes', age: 28, lastVisit: new Date('2026-02-15'), visitCount: 2, needsFollowUp: false, hasBalance: true, status: 'active' as const },
];

const archivedPatients = [
  { id: 'p4', displayName: 'Jose Garcia', age: 55, lastVisit: new Date('2025-12-01'), visitCount: 8, needsFollowUp: false, hasBalance: false, status: 'archived' as const },
];

describe('PatientList', () => {
  test('renders a card for each patient (last name in caps)', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByText('SANTOS')).not.toBeNull();
    expect(screen.getByText('CRUZ')).not.toBeNull();
    expect(screen.getByText('REYES')).not.toBeNull();
  });

  test('filters displayed patients by search query (matches displayName)', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: 'Maria' }));
    expect(screen.getByText('SANTOS')).not.toBeNull();
    expect(screen.queryByText('REYES')).toBeNull();
  });

  test('shows empty state when no patients match search', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: 'zzz' }));
    expect(screen.getByTestId('patient-list-empty')).not.toBeNull();
  });

  test('shows empty state when patients array is empty', () => {
    render(React.createElement(PatientList, { patients: [], onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByTestId('patient-list-empty')).not.toBeNull();
  });

  test('shows loading skeleton when isLoading is true', () => {
    render(React.createElement(PatientList, { patients: [], isLoading: true, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByTestId('patient-list-loading')).not.toBeNull();
  });

  test('does not show skeleton when isLoading is false', () => {
    render(React.createElement(PatientList, { patients, isLoading: false, onSelect: () => {}, searchQuery: '' }));
    expect(screen.queryByTestId('patient-list-loading')).toBeNull();
  });

  test('calls onSelect with patient when card is clicked', async () => {
    const user = userEvent.setup();
    let selected: any = null;
    render(React.createElement(PatientList, { patients, onSelect: (p) => { selected = p; }, searchQuery: '' }));
    await user.click(screen.getAllByTestId('patient-folder-card')[0]!);
    expect(selected?.id).toBe('p1');
  });

  test('renders search input', () => {
    render(React.createElement(PatientList, { patients, onSelect: () => {}, searchQuery: '' }));
    expect(screen.getByPlaceholderText(/search/i)).not.toBeNull();
  });
});

// ─── Archive/Restore action tests ───────────────────────────────────────

describe('PatientList — archive actions', () => {
  test('shows archive button on active patients when activeFilter is "active"', () => {
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onArchive: () => {},
      }),
    );
    expect(screen.getByTestId('archive-btn-p1')).not.toBeNull();
    expect(screen.getByTestId('archive-btn-p2')).not.toBeNull();
  });

  test('archive button calls onArchive after confirm', async () => {
    const user = userEvent.setup();
    const onArchive = mock(() => {});
    const confirmMock = mock(() => true);
    window.confirm = confirmMock;

    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onArchive,
      }),
    );

    await user.click(screen.getByTestId('archive-btn-p1'));
    expect(confirmMock).toHaveBeenCalled();
    expect(onArchive).toHaveBeenCalledWith('p1');
  });

  test('archive button does NOT call onArchive when confirm is cancelled', async () => {
    const user = userEvent.setup();
    const onArchive = mock(() => {});
    window.confirm = mock(() => false);

    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onArchive,
      }),
    );

    await user.click(screen.getByTestId('archive-btn-p1'));
    expect(onArchive).not.toHaveBeenCalled();
  });
});

describe('PatientList — restore actions', () => {
  test('shows restore button on archived patients when activeFilter is "archived"', () => {
    render(
      React.createElement(PatientList, {
        patients: archivedPatients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'archived',
        onRestore: () => {},
      }),
    );
    expect(screen.getByTestId('restore-btn-p4')).not.toBeNull();
  });

  test('restore button calls onRestore after confirm', async () => {
    const user = userEvent.setup();
    const onRestore = mock(() => {});
    window.confirm = mock(() => true);

    render(
      React.createElement(PatientList, {
        patients: archivedPatients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'archived',
        onRestore,
      }),
    );

    await user.click(screen.getByTestId('restore-btn-p4'));
    expect(onRestore).toHaveBeenCalledWith('p4');
  });
});

// ─── Bulk select tests ──────────────────────────────────────────────────

describe('PatientList — bulk select', () => {
  test('shows select-all checkbox when activeFilter is "active" and onBulkArchive provided', () => {
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onBulkArchive: () => {},
      }),
    );
    expect(screen.getByTestId('select-all-checkbox')).not.toBeNull();
  });

  test('shows per-patient checkboxes', () => {
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onBulkArchive: () => {},
      }),
    );
    expect(screen.getByTestId('select-patient-p1')).not.toBeNull();
    expect(screen.getByTestId('select-patient-p2')).not.toBeNull();
  });

  test('bulk archive button appears when patients are selected', async () => {
    const user = userEvent.setup();
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onBulkArchive: () => {},
      }),
    );

    // Select first patient
    const checkbox = screen.getByTestId('select-patient-p1').querySelector('input');
    if (checkbox) await user.click(checkbox);

    expect(screen.getByTestId('bulk-archive-btn')).not.toBeNull();
    expect(screen.getByTestId('bulk-archive-btn').textContent).toContain('1');
  });

  test('bulk archive button calls onBulkArchive with selected IDs', async () => {
    const user = userEvent.setup();
    const onBulkArchive = mock(() => {});
    window.confirm = mock(() => true);

    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        activeFilter: 'active',
        onBulkArchive,
      }),
    );

    // Select two patients
    const cb1 = screen.getByTestId('select-patient-p1').querySelector('input');
    const cb2 = screen.getByTestId('select-patient-p2').querySelector('input');
    if (cb1) await user.click(cb1);
    if (cb2) await user.click(cb2);

    await user.click(screen.getByTestId('bulk-archive-btn'));
    expect(onBulkArchive).toHaveBeenCalled();
    const calledWith = (onBulkArchive as any).mock.calls[0][0] as string[];
    expect(calledWith.sort()).toEqual(['p1', 'p2']);
  });
});

// ─── Export button tests ────────────────────────────────────────────────

describe('PatientList — export', () => {
  test('shows export button when onExport is provided', () => {
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        onExport: () => {},
      }),
    );
    expect(screen.getByTestId('export-patients-btn')).not.toBeNull();
  });

  test('export button calls onExport when clicked', async () => {
    const user = userEvent.setup();
    const onExport = mock(() => {});
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        onExport,
      }),
    );

    await user.click(screen.getByTestId('export-patients-btn'));
    expect(onExport).toHaveBeenCalled();
  });

  test('export button shows "Exporting..." when isExporting is true', () => {
    render(
      React.createElement(PatientList, {
        patients,
        onSelect: () => {},
        searchQuery: '',
        onExport: () => {},
        isExporting: true,
      }),
    );

    expect(screen.getByTestId('export-patients-btn').textContent).toContain('Exporting');
  });
});
