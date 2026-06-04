import { eq, and, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalCoverageAuthorizations,
  type DentalCoverageAuthorization,
  type NewDentalCoverageAuthorization,
} from './coverage-authorization.schema';

export class CoverageAuthorizationRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async create(
    values: Omit<NewDentalCoverageAuthorization, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalCoverageAuthorization> {
    const [row] = await this.db.insert(dentalCoverageAuthorizations).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async findByPatientId(patientId: string): Promise<DentalCoverageAuthorization[]> {
    return this.db
      .select()
      .from(dentalCoverageAuthorizations)
      .where(eq(dentalCoverageAuthorizations.patientId, patientId))
      .orderBy(desc(dentalCoverageAuthorizations.createdAt));
  }

  async findOneById(id: string, patientId: string): Promise<DentalCoverageAuthorization | null> {
    const [row] = await this.db
      .select()
      .from(dentalCoverageAuthorizations)
      .where(and(
        eq(dentalCoverageAuthorizations.id, id),
        eq(dentalCoverageAuthorizations.patientId, patientId),
      ));
    return row ?? null;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalCoverageAuthorization,
      'status' | 'approvedAt' | 'validUntil' | 'approvedAmountCents' | 'coveredProcedures' | 'notes' | 'updatedBy'>>,
  ): Promise<DentalCoverageAuthorization | null> {
    const [row] = await this.db
      .update(dentalCoverageAuthorizations)
      .set({ ...values, updatedAt: new Date() })
      .where(and(
        eq(dentalCoverageAuthorizations.id, id),
        eq(dentalCoverageAuthorizations.patientId, patientId),
      ))
      .returning();
    return row ?? null;
  }
}
