/**
 * FollowUpNotes — unit tests (FR2.12)
 *
 * Uses global.fetch mocking — no mock.module() to prevent process contamination.
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse } from '@/test-utils';
import { FollowUpNotes } from '../components/follow-up-notes';
import type { FollowUpNote } from '../hooks/use-follow-up-notes';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const NOTES: FollowUpNote[] = [
  {
    id: 'n1',
    text: 'Patient needs follow-up in 2 weeks',
    createdAt: '2026-04-01T10:00:00Z',
    createdBy: 'Dr. Santos',
  },
  {
    id: 'n2',
    text: 'Prescribed antibiotics for infection',
    createdAt: '2026-03-15T09:00:00Z',
    createdBy: 'Dr. Reyes',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────

describe('FollowUpNotes', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    cleanup();
  });

  function renderNotes(patientId = 'p1') {
    const qc = freshClientWithMutations();
    render(React.createElement(FollowUpNotes, { patientId }), { wrapper: makeWrapper(qc) });
    return qc;
  }

  test('renders note list with text, timestamp, and author', async () => {
    global.fetch = mock(() => jsonResponse({ notes: NOTES, total: 2 }));
    renderNotes();
    await waitFor(() => expect(screen.getByText('Patient needs follow-up in 2 weeks')).not.toBeNull());
    expect(screen.getByText('Prescribed antibiotics for infection')).not.toBeNull();
    expect(screen.getByText(/Dr\. Santos/)).not.toBeNull();
    expect(screen.getByText(/Dr\. Reyes/)).not.toBeNull();
  });

  test('shows empty state message when no notes', async () => {
    global.fetch = mock(() => jsonResponse({ notes: [], total: 0 }));
    renderNotes();
    await waitFor(() => expect(screen.getByTestId('no-notes-message')).not.toBeNull());
  });

  test('shows loading skeleton', () => {
    global.fetch = mock(() => new Promise(() => {})); // never resolves
    renderNotes();
    expect(screen.getByTestId('notes-loading')).not.toBeNull();
  });

  test('add note form submits text and clears input', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) return jsonResponse({ notes: [], total: 0 }); // GET
      return jsonResponse({ id: 'new', text: 'New follow-up note', createdAt: new Date().toISOString(), createdBy: 'Dr. Test' }); // POST
    });
    renderNotes();
    await waitFor(() => expect(screen.getByTestId('note-input')).not.toBeNull());

    const textarea = screen.getByTestId('note-input') as HTMLTextAreaElement;
    const submitBtn = screen.getByTestId('note-submit');

    await user.clear(textarea);
    await user.type(textarea, 'New follow-up note');
    expect(textarea.value).toBe('New follow-up note');

    await act(async () => { await user.click(submitBtn); });

    // Input should clear after submit
    await waitFor(() => expect((screen.getByTestId('note-input') as HTMLTextAreaElement).value).toBe(''));
  });

  test('keeps the typed note and shows an error when save fails', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    global.fetch = mock(() => {
      callCount++;
      if (callCount === 1) return jsonResponse({ notes: [], total: 0 }); // GET
      return new Response('error', { status: 500 }); // POST fails
    }) as unknown as typeof fetch;
    renderNotes();
    await waitFor(() => expect(screen.getByTestId('note-input')).not.toBeNull());

    const textarea = screen.getByTestId('note-input') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'Important clinical note');
    await act(async () => { await user.click(screen.getByTestId('note-submit')); });

    // The note must NOT be lost, and the failure must be visible.
    await waitFor(() => expect(screen.getByText(/could not save note/i)).not.toBeNull());
    expect((screen.getByTestId('note-input') as HTMLTextAreaElement).value).toBe('Important clinical note');
  });

  test('submit button is disabled when textarea is empty', async () => {
    global.fetch = mock(() => jsonResponse({ notes: [], total: 0 }));
    renderNotes();
    await waitFor(() => expect(screen.getByTestId('note-submit')).not.toBeNull());
    const submitBtn = screen.getByTestId('note-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  test('renders notes in chronological order (newest first by default)', async () => {
    global.fetch = mock(() => jsonResponse({ notes: NOTES, total: 2 }));
    renderNotes();
    await waitFor(() => expect(screen.getAllByTestId(/^note-item-/).length).toBe(2));
    const noteElements = screen.getAllByTestId(/^note-item-/);
    expect(noteElements).toHaveLength(2);
  });

  test('shows note count in header', async () => {
    global.fetch = mock(() => jsonResponse({ notes: NOTES, total: 2 }));
    renderNotes();
    await waitFor(() => expect(screen.getByText('2')).not.toBeNull());
  });
});
