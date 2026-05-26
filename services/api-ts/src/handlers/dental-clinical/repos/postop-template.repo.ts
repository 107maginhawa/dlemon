import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalPostopTemplates,
  type DentalPostopTemplate,
  type NewDentalPostopTemplate,
  type PostopCategory,
} from './postop-template.schema';

export class PostopTemplateRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByBranchId(branchId: string, category?: PostopCategory): Promise<DentalPostopTemplate[]> {
    if (category) {
      return this.db
        .select()
        .from(dentalPostopTemplates)
        .where(and(eq(dentalPostopTemplates.branchId, branchId), eq(dentalPostopTemplates.category, category)));
    }
    return this.db
      .select()
      .from(dentalPostopTemplates)
      .where(eq(dentalPostopTemplates.branchId, branchId));
  }

  async findOneById(id: string, branchId: string): Promise<DentalPostopTemplate | null> {
    const [row] = await this.db
      .select()
      .from(dentalPostopTemplates)
      .where(and(eq(dentalPostopTemplates.id, id), eq(dentalPostopTemplates.branchId, branchId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalPostopTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalPostopTemplate> {
    const [row] = await this.db.insert(dentalPostopTemplates).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    branchId: string,
    values: Partial<Pick<DentalPostopTemplate, 'category' | 'title' | 'content' | 'active'>>,
  ): Promise<DentalPostopTemplate | null> {
    const [row] = await this.db
      .update(dentalPostopTemplates)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalPostopTemplates.id, id), eq(dentalPostopTemplates.branchId, branchId)))
      .returning();
    return row ?? null;
  }
}
