/**
 * TasksSheet — bottom sheet for managing patient follow-up tasks
 * (PP-7 sub-slice 2 / ISSUE-043).
 *
 * Lists a patient's tasks, lets staff add one (title + type + optional due date
 * / description), and advance status via FSM buttons (open → in_progress →
 * done/cancelled). Mirrors RecallsSheet.
 */
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, useIsMobile } from '@monobase/ui';
import { CheckCircle2, Plus } from 'lucide-react';
import {
  usePatientTasks,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskType,
  type TaskStatus,
  type PatientTask,
  type CreateTaskBody,
} from '../hooks/use-patient-tasks';

interface TasksSheetProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

// FSM: valid next statuses per current status (mirrors the backend TASK_FSM).
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

// Label for the non-cancel forward transition, keyed by current status.
const FORWARD_LABEL: Record<TaskStatus, string> = {
  open: 'Start',
  in_progress: 'Complete',
  done: 'Done',
  cancelled: 'Cancelled',
};

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: PatientTask;
  onUpdateStatus: (taskId: string, body: { status: TaskStatus }) => void;
  isUpdating: boolean;
}

function TaskRow({ task, onUpdateStatus, isUpdating }: TaskRowProps) {
  const transitions = TASK_TRANSITIONS[task.status];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{task.title}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[task.status]}`}
          >
            {STATUS_LABELS[task.status]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {TASK_TYPE_LABELS[task.taskType]}
          {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ''}
        </p>
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
      </div>

      {transitions.length > 0 && (
        <div className="flex flex-col gap-1 shrink-0">
          {transitions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(task.id, { status: next })}
              className="rounded px-2 py-1 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
            >
              {next === 'cancelled' ? 'Cancel' : FORWARD_LABEL[task.status]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export function TasksSheet({ patientId, open, onClose }: TasksSheetProps) {
  // L5/L7: right-side drawer on tablet/desktop, bottom-sheet fallback on narrow
  // screens. Radix Dialog handles Escape + focus restore.
  const isMobile = useIsMobile();

  const { tasks, isLoading, isError, createTask, updateTask, isCreating, isUpdating } =
    usePatientTasks(patientId);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<TaskType>('follow_up');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const body: CreateTaskBody = {
      title: formTitle.trim(),
      taskType: formType,
      ...(formDueDate ? { dueDate: formDueDate } : {}),
      ...(formDescription.trim() ? { description: formDescription.trim() } : {}),
    };
    createTask(body);
    setShowForm(false);
    setFormTitle('');
    setFormType('follow_up');
    setFormDueDate('');
    setFormDescription('');
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        aria-describedby={undefined}
        className={`flex flex-col gap-0 p-0 ${isMobile ? 'max-h-[85dvh] rounded-t-2xl' : 'w-[360px] sm:max-w-[360px]'}`}
      >
        {/* Radix supplies role=dialog on SheetContent; the test/E2E handle lives
            on this inner wrapper (the harness stubs Radix Content + drops props). */}
        <div data-testid="tasks-sheet" className="flex flex-1 flex-col min-h-0">
        {/* Header (pr-10 clears the drawer's built-in close button) */}
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 border-b shrink-0 pr-10 text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-sm font-semibold">Tasks</SheetTitle>
            {tasks.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {tasks.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-label="New task"
            className="flex h-8 items-center gap-1 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </button>
        </SheetHeader>

        {/* New task form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="shrink-0 border-b bg-muted/30 px-4 py-3 flex flex-col gap-2"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New Task
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="task-title">
                Title
              </label>
              <input
                id="task-title"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Send referral letter"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="task-type">
                  Type
                </label>
                <select
                  id="task-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as TaskType)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                  required
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground" htmlFor="task-due">
                  Due Date (optional)
                </label>
                <input
                  id="task-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="task-desc">
                Description (optional)
              </label>
              <textarea
                id="task-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Add a note…"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded px-3 py-1.5 text-xs font-semibold bg-muted text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !formTitle.trim()}
                className="rounded px-3 py-1.5 text-xs font-semibold bg-lemon text-lemon-foreground hover:bg-lemon-hover disabled:opacity-50"
              >
                {isCreating ? 'Saving…' : 'Save Task'}
              </button>
            </div>
          </form>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading tasks…</p>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-destructive/50" />
              <p className="text-sm text-destructive">Couldn’t load tasks. Please try again.</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No tasks yet. Add a follow-up, referral, or lab order.
              </p>
              {/* L6: co-locate the primary action with the empty state. */}
              <button
                type="button"
                onClick={() => setShowForm(true)}
                data-testid="tasks-empty-new-btn"
                className="flex items-center gap-1 rounded-lg bg-lemon px-3 py-2 text-xs font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Task
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onUpdateStatus={(id, body) => updateTask(id, body)}
                  isUpdating={isUpdating}
                />
              ))}
            </div>
          )}
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
