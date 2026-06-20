/**
 * usePatientTasks — fetch/create/advance patient follow-up tasks
 * (PP-7 sub-slice 2 / ISSUE-043).
 *
 * Patient-scoped to-do items (follow-up, lab order, referral, prescription, …)
 * with a status FSM (open → in_progress → done/cancelled). Writes invalidate the
 * list query; mutation failures are surfaced via toast (never swallowed).
 *
 * API: GET   /dental/patients/:patientId/tasks
 *      POST  /dental/patients/:patientId/tasks
 *      PATCH /dental/patients/:patientId/tasks/:taskId
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPatientTasksOptions,
  listPatientTasksQueryKey,
  createTaskMutation,
  updateTaskMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type {
  DentalPatientEngagementModulePatientTask,
  DentalPatientEngagementModuleCreateTaskRequest,
  DentalPatientEngagementModuleUpdateTaskRequest,
} from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';

export type PatientTask = DentalPatientEngagementModulePatientTask;
export type TaskType = PatientTask['taskType'];
export type TaskStatus = PatientTask['status'];
export type CreateTaskBody = DentalPatientEngagementModuleCreateTaskRequest;
export type UpdateTaskBody = DentalPatientEngagementModuleUpdateTaskRequest;

export const TASK_TYPES: TaskType[] = ['follow_up', 'lab_order', 'referral', 'prescription', 'other'];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  follow_up: 'Follow-up',
  lab_order: 'Lab order',
  referral: 'Referral',
  prescription: 'Prescription',
  other: 'Other',
};

export function usePatientTasks(patientId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    ...listPatientTasksOptions({ path: { patientId } }),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    select: (data): PatientTask[] => {
      // SDK response is Array<PatientTask> | ErrorResponse; also tolerate a
      // { data: [...] } wrapper. ErrorResponse is a non-array object.
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown }).data)) {
        return (data as { data: PatientTask[] }).data;
      }
      return [];
    },
  });

  const create = useMutation({
    ...createTaskMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listPatientTasksQueryKey({ path: { patientId } }) });
    },
    onError: (err) => toastError(err, 'Could not save the task.'),
  });

  const update = useMutation({
    ...updateTaskMutation(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listPatientTasksQueryKey({ path: { patientId } }) });
    },
    onError: (err) => toastError(err, 'Could not update the task.'),
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createTask: (body: CreateTaskBody) => create.mutate({ path: { patientId }, body }),
    updateTask: (taskId: string, body: UpdateTaskBody) =>
      update.mutate({ path: { patientId, taskId }, body }),
    isCreating: create.isPending,
    isUpdating: update.isPending,
  };
}
