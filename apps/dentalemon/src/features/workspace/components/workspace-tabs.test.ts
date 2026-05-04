/**
 * WorkspaceTabs component tests
 *
 * Four tabs: Odontogram | Periodontal | Treatment Plan | Notes
 * Matches the ws-toolbar in wireframes (ws-tooth-slideout.html, ws-tooth-history.html).
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { WorkspaceTabs, type WorkspaceTab } from './workspace-tabs';

afterEach(cleanup);

describe('WorkspaceTabs', () => {
  test('renders all four tabs', () => {
    render(React.createElement(WorkspaceTabs, { activeTab: 'odontogram', onTabChange: () => {} }));
    expect(screen.getByRole('tab', { name: /Odontogram/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Periodontal/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Treatment/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Notes/i })).toBeTruthy();
  });

  test('active tab has aria-selected=true', () => {
    render(React.createElement(WorkspaceTabs, { activeTab: 'treatment-plan', onTabChange: () => {} }));
    const active = screen.getByRole('tab', { name: /Treatment/i });
    expect(active.getAttribute('aria-selected')).toBe('true');
  });

  test('inactive tabs have aria-selected=false', () => {
    render(React.createElement(WorkspaceTabs, { activeTab: 'odontogram', onTabChange: () => {} }));
    const notes = screen.getByRole('tab', { name: /Notes/i });
    expect(notes.getAttribute('aria-selected')).toBe('false');
  });

  test('calls onTabChange with correct tab id on click', () => {
    let received: WorkspaceTab | null = null;
    render(React.createElement(WorkspaceTabs, {
      activeTab: 'odontogram',
      onTabChange: (t) => { received = t; },
    }));
    fireEvent.click(screen.getByRole('tab', { name: /Notes/i }));
    expect(received).toBe('notes');
  });

  test('calls onTabChange with "periodontal" when Periodontal clicked', () => {
    let received: WorkspaceTab | null = null;
    render(React.createElement(WorkspaceTabs, {
      activeTab: 'odontogram',
      onTabChange: (t) => { received = t; },
    }));
    fireEvent.click(screen.getByRole('tab', { name: /Periodontal/i }));
    expect(received).toBe('periodontal');
  });
});
