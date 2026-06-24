/**
 * TasksSheet component tests (PP-7 sub-slice 2 / ISSUE-043)
 *
 * Renders the shipped TasksSheet (driven by the real usePatientTasks hook)
 * against a mocked fetch:
 *   - lists tasks from GET /tasks and renders FSM transition buttons
 *   - the "New Task" form submits a POST /tasks with the entered fields
 *   - a transition button fires PATCH /tasks/:id with the next status
 *   - empty + error states render
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TasksSheet } from './tasks-sheet';
import type { PatientTask } from '../hooks/use-patient-tasks';

const PATIENT_ID = 'p-1';

function makeTask(overrides: Partial<PatientTask> = {}): PatientTask {
  return {
    id: 't-1',
    version: 1,
    patientId: PATIENT_ID,
    title: 'Call lab for crown',
    description: null,
    taskType: 'follow_up',
    status: 'open',
    dueDate: null,
    assignedTo: null,
    completedAt: null,
    createdAt: '2026-05-01T00:00:00.000Z' as unknown as Date,
    updatedAt: '2026-05-01T00:00:00.000Z' as unknown as Date,
    ...overrides,
  };
}

function installFetch(list: PatientTask[] = []) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const original = global.fetch;
  global.fetch = mock(async (req: Request | string | URL, init?: RequestInit) => {
    const url = req instanceof Request ? req.url : String(req);
    const method = (req instanceof Request ? req.method : init?.method ?? 'GET').toUpperCase();
    const raw = req instanceof Request ? await req.clone().text() : (init?.body as string | undefined);
    calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });
    if (method === 'GET') {
      return new Response(JSON.stringify({ data: list }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(makeTask({ id: 't-new', status: 'in_progress' })), {
      status: method === 'POST' ? 201 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => { global.fetch = original; } };
}

function renderSheet(props: Partial<React.ComponentProps<typeof TasksSheet>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(TasksSheet, {
        patientId: PATIENT_ID,
        open: true,
        onClose: () => {},
        ...props,
      }),
    ),
  );
}

afterEach(cleanup);

describe('TasksSheet — shipped component', () => {
  test('does not render when open=false', () => {
    const f = installFetch();
    try {
      renderSheet({ open: false });
      expect(screen.queryByTestId('tasks-sheet')).toBeNull();
    } finally {
      f.restore();
    }
  });

  test('renders the task list returned by GET with a Start transition button', async () => {
    const f = installFetch([makeTask({ title: 'Refer to ortho', taskType: 'referral', status: 'open' })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText('Refer to ortho')).not.toBeNull());
      // open → can be Started (in_progress)
      expect(screen.getByRole('button', { name: 'Start' })).not.toBeNull();
      expect(f.calls.some(c => c.method === 'GET' && c.url.includes(`/patients/${PATIENT_ID}/tasks`))).toBe(true);
    } finally {
      f.restore();
    }
  });

  test('shows empty state when there are no tasks', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No tasks/i)).not.toBeNull());
    } finally {
      f.restore();
    }
  });

  test('renders as a dialog with its testid preserved through the drawer conversion', async () => {
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByTestId('tasks-sheet')).not.toBeNull());
      expect(screen.getByRole('dialog')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('"Back to workspace" closes the modal', async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    const f = installFetch([]);
    try {
      renderSheet({ onClose });
      await user.click(await screen.findByTestId('tasks-back-btn'));
      expect(onClose).toHaveBeenCalled();
    } finally {
      f.restore();
    }
  });

  test('L6: empty state hosts a primary "New task" affordance that opens the form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/No tasks/i)).not.toBeNull());
      await user.click(screen.getByTestId('tasks-empty-new-btn'));
      expect(screen.getByLabelText('Title')).not.toBeNull();
    } finally {
      f.restore();
    }
  });

  test('submits a POST /tasks with the entered fields from the new-task form', async () => {
    const user = userEvent.setup();
    const f = installFetch([]);
    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /new task/i }));

      await user.type(screen.getByLabelText('Title'), 'Send referral letter');
      await user.selectOptions(screen.getByLabelText('Type'), 'Referral');
      const due = screen.getByLabelText(/Due Date/i) as HTMLInputElement;
      await user.type(due, '2026-08-15');

      await user.click(screen.getByRole('button', { name: /save task/i }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'POST' && c.url.includes('/tasks'))).toBe(true),
      );
      const post = f.calls.find(c => c.method === 'POST' && c.url.includes('/tasks'))!;
      expect((post.body as { title: string }).title).toBe('Send referral letter');
      expect((post.body as { taskType: string }).taskType).toBe('referral');
      expect((post.body as { dueDate: string }).dueDate).toBe('2026-08-15');
    } finally {
      f.restore();
    }
  });

  test('fires PATCH /tasks/:id with the next status on a transition button', async () => {
    const user = userEvent.setup();
    const f = installFetch([makeTask({ id: 't-42', status: 'in_progress' })]);
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Complete' })).not.toBeNull());
      await user.click(screen.getByRole('button', { name: 'Complete' }));

      await waitFor(() =>
        expect(f.calls.some(c => c.method === 'PATCH' && c.url.includes('/tasks/t-42'))).toBe(true),
      );
      const patch = f.calls.find(c => c.method === 'PATCH')!;
      expect((patch.body as { status: string }).status).toBe('done');
    } finally {
      f.restore();
    }
  });

  test('shows an error state when the tasks fetch fails', async () => {
    const original = global.fetch;
    global.fetch = mock(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    try {
      renderSheet();
      await waitFor(() => expect(screen.getByText(/Couldn’t load tasks/i)).not.toBeNull());
    } finally {
      global.fetch = original;
    }
  });
});
