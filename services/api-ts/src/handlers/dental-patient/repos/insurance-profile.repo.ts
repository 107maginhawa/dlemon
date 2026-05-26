import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalInsuranceProfiles,
  type DentalInsuranceProfile,
  type NewDentalInsuranceProfile,
} from './insurance-profile.schema';

export class InsuranceProfileRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalInsuranceProfile[]> {
    return this.db
      .select()
      .from(dentalInsuranceProfiles)
      .where(eq(dentalInsuranceProfiles.patientId, patientId));
  }

  async findActiveByPatientId(patientId: string): Promise<DentalInsuranceProfile[]> {
    return this.db
      .select()
      .from(dentalInsuranceProfiles)
      .where(and(
        eq(dentalInsuranceProfiles.patientId, patientId),
        eq(dentalInsuranceProfiles.active, true),
      ));
  }

  async findOneById(id: string, patientId: string): Promise<DentalInsuranceProfile | null> {
    const [row] = await this.db
      .select()
      .from(dentalInsuranceProfiles)
      .where(and(
        eq(dentalInsuranceProfiles.id, id),
        eq(dentalInsuranceProfiles.patientId, patientId),
      ));
    return row ?? null;
  }

  async findOneByIdOnly(id: string): Promise<DentalInsuranceProfile | null> {
    const [row] = await this.db
      .select()
      .from(dentalInsuranceProfiles)
      .where(eq(dentalInsuranceProfiles.id, id));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalInsuranceProfile, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalInsuranceProfile> {
    const [row] = await this.db.insert(dentalInsuranceProfiles).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalInsuranceProfile, 'insurerName' | 'policyNumber' | 'groupNumber' | 'subscriberName' | 'subscriberDob' | 'relationship' | 'active' | 'notes'>>,
  ): Promise<DentalInsuranceProfile | null> {
    const [row] = await this.db
      .update(dentalInsuranceProfiles)
      .set({ ...values, updatedAt: new Date() })
      .where(and(
        eq(dentalInsuranceProfiles.id, id),
        eq(dentalInsuranceProfiles.patientId, patientId),
      ))
      .returning();
    return row ?? null;
  }
}
