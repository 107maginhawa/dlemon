import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalTasks,
  type DentalTask,
  type NewDentalTask,
} from './task.schema';

export class TaskRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalTask[]> {
    return this.db
      .select()
      .from(dentalTasks)
      .where(eq(dentalTasks.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalTask | null> {
    const [row] = await this.db
      .select()
      .from(dentalTasks)
      .where(and(eq(dentalTasks.id, id), eq(dentalTasks.patientId, patientId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalTask, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalTask> {
    const [row] = await this.db.insert(dentalTasks).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalTask, 'title' | 'description' | 'taskType' | 'status' | 'dueDate' | 'assignedTo' | 'completedAt' | 'updatedBy'>>,
  ): Promise<DentalTask | null> {
    const [row] = await this.db
      .update(dentalTasks)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalTasks.id, id), eq(dentalTasks.patientId, patientId)))
      .returning();
    return row ?? null;
  }
}
