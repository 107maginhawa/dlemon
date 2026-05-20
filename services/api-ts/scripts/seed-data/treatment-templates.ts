/**
 * Seed: Treatment templates — 10 common dental procedures with CDT codes and PHP prices
 */
import type { DatabaseInstance } from './types';
import { dentalTreatmentTemplates } from '@/handlers/dental-visit/repos/treatment-template.schema';
import {
  BRANCH_ID, DR_REYES_MEMBERSHIP_ID,
  TEMPLATE_01, TEMPLATE_02, TEMPLATE_03, TEMPLATE_04, TEMPLATE_05,
  TEMPLATE_06, TEMPLATE_07, TEMPLATE_08, TEMPLATE_09, TEMPLATE_10,
} from './ids';

export async function seedTreatmentTemplates(db: DatabaseInstance): Promise<void> {
  console.log('   Seeding treatment templates...');

  await db.insert(dentalTreatmentTemplates).values([
    {
      id: TEMPLATE_01,
      branchId: BRANCH_ID,
      name: 'Oral Prophylaxis',
      description: 'Routine cleaning and polishing',
      items: [{ cdtCode: 'D1110', description: 'Oral Prophylaxis — adult', priceCents: 150000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_02,
      branchId: BRANCH_ID,
      name: 'Composite Filling (1-surface)',
      description: 'Resin-based composite — one surface, posterior',
      items: [{ cdtCode: 'D2391', description: 'Composite filling — 1 surface', priceCents: 250000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_03,
      branchId: BRANCH_ID,
      name: 'Composite Filling (2-surface)',
      description: 'Resin-based composite — two surfaces, posterior',
      items: [{ cdtCode: 'D2392', description: 'Composite filling — 2 surfaces', priceCents: 350000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_04,
      branchId: BRANCH_ID,
      name: 'Simple Extraction',
      description: 'Non-surgical extraction of erupted tooth',
      items: [{ cdtCode: 'D7140', description: 'Simple extraction — erupted tooth', priceCents: 300000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_05,
      branchId: BRANCH_ID,
      name: 'Surgical Extraction',
      description: 'Surgical extraction — soft tissue/bone impaction',
      items: [{ cdtCode: 'D7210', description: 'Surgical extraction', priceCents: 500000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_06,
      branchId: BRANCH_ID,
      name: 'Root Canal (Anterior)',
      description: 'Endodontic therapy — anterior tooth',
      items: [{ cdtCode: 'D3310', description: 'Root canal — anterior', priceCents: 1200000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_07,
      branchId: BRANCH_ID,
      name: 'Root Canal (Molar)',
      description: 'Endodontic therapy — molar',
      items: [{ cdtCode: 'D3330', description: 'Root canal — molar', priceCents: 1500000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_08,
      branchId: BRANCH_ID,
      name: 'PFM Crown',
      description: 'Porcelain-fused-to-metal crown — full coverage',
      items: [{ cdtCode: 'D2750', description: 'PFM Crown', priceCents: 2000000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_09,
      branchId: BRANCH_ID,
      name: 'Complete Denture (Upper)',
      description: 'Maxillary complete denture',
      items: [{ cdtCode: 'D5110', description: 'Complete denture — maxillary', priceCents: 2500000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
    {
      id: TEMPLATE_10,
      branchId: BRANCH_ID,
      name: 'Panoramic X-ray',
      description: 'Panoramic radiographic image',
      items: [{ cdtCode: 'D0330', description: 'Panoramic radiograph', priceCents: 80000 }],
      active: true,
      createdBy: DR_REYES_MEMBERSHIP_ID,
      updatedBy: DR_REYES_MEMBERSHIP_ID,
    },
  ]).onConflictDoNothing();

  console.log('   ✅ 10 treatment templates');
}
