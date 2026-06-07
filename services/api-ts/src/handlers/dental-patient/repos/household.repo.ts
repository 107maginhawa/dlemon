/**
 * household.repo.ts — P1-27 household / guarantor data access
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalHouseholds,
  dentalHouseholdMembers,
  type DentalHousehold,
  type NewDentalHousehold,
  type DentalHouseholdMember,
  type NewDentalHouseholdMember,
} from './household.schema';

export class HouseholdRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: Logger,
  ) {}

  async findOneById(id: string): Promise<DentalHousehold | null> {
    const [row] = await this.db.select().from(dentalHouseholds).where(eq(dentalHouseholds.id, id));
    return row ?? null;
  }

  async findMembers(householdId: string): Promise<DentalHouseholdMember[]> {
    return this.db
      .select()
      .from(dentalHouseholdMembers)
      .where(eq(dentalHouseholdMembers.householdId, householdId));
  }

  /** The household a patient belongs to, if any (a patient has at most one). */
  async findByPatientId(patientId: string): Promise<DentalHousehold | null> {
    const [member] = await this.db
      .select()
      .from(dentalHouseholdMembers)
      .where(eq(dentalHouseholdMembers.patientId, patientId));
    if (!member) return null;
    return this.findOneById(member.householdId);
  }

  async findMembership(patientId: string): Promise<DentalHouseholdMember | null> {
    const [row] = await this.db
      .select()
      .from(dentalHouseholdMembers)
      .where(eq(dentalHouseholdMembers.patientId, patientId));
    return row ?? null;
  }

  /**
   * Create a household with its guarantor as the first member (isGuarantor=true,
   * relationship 'self'), in a single transaction.
   */
  async createWithGuarantor(
    household: Omit<NewDentalHousehold, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
    actorId: string,
  ): Promise<{ household: DentalHousehold; members: DentalHouseholdMember[] }> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(dentalHouseholds).values(household).returning();
      if (!created) throw new Error('Insert returned no household row');
      const [guarantorMember] = await tx
        .insert(dentalHouseholdMembers)
        .values({
          householdId: created.id,
          patientId: household.guarantorPatientId,
          relationship: 'self',
          isGuarantor: true,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      return { household: created, members: guarantorMember ? [guarantorMember] : [] };
    });
  }

  async addMember(
    values: Omit<NewDentalHouseholdMember, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalHouseholdMember> {
    const [row] = await this.db.insert(dentalHouseholdMembers).values(values).returning();
    if (!row) throw new Error('Insert returned no member row');
    return row;
  }

  async removeMember(householdId: string, patientId: string): Promise<DentalHouseholdMember | null> {
    const [row] = await this.db
      .delete(dentalHouseholdMembers)
      .where(
        and(
          eq(dentalHouseholdMembers.householdId, householdId),
          eq(dentalHouseholdMembers.patientId, patientId),
        ),
      )
      .returning();
    return row ?? null;
  }
}
