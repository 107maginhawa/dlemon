import type { DatabaseInstance } from '@/core/database';
import { dentalProcedureCodes } from '@/handlers/dental-visit/repos/procedure-code.schema';
import { OWNER_PERSON_ID } from './ids';

const CDT_CODES = [
  { cdtCode: 'D0120', description: 'Periodic oral evaluation', category: 'Diagnostic', defaultFeePhp: 50000 },
  { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', category: 'Diagnostic', defaultFeePhp: 80000 },
  { cdtCode: 'D0210', description: 'Full mouth radiographic survey', category: 'Diagnostic', defaultFeePhp: 150000 },
  { cdtCode: 'D0272', description: 'Bitewing radiographic image — two images', category: 'Diagnostic', defaultFeePhp: 60000 },
  { cdtCode: 'D0330', description: 'Panoramic radiographic image', category: 'Diagnostic', defaultFeePhp: 120000 },
  { cdtCode: 'D1110', description: 'Prophylaxis — adult', category: 'Preventive', defaultFeePhp: 80000 },
  { cdtCode: 'D1120', description: 'Prophylaxis — child', category: 'Preventive', defaultFeePhp: 60000 },
  { cdtCode: 'D1206', description: 'Topical fluoride varnish', category: 'Preventive', defaultFeePhp: 40000 },
  { cdtCode: 'D1351', description: 'Sealant — per tooth', category: 'Preventive', defaultFeePhp: 35000 },
  { cdtCode: 'D2140', description: 'Amalgam restoration — one surface, primary or permanent', category: 'Restorative', defaultFeePhp: 100000 },
  { cdtCode: 'D2160', description: 'Amalgam restoration — three surfaces, primary or permanent', category: 'Restorative', defaultFeePhp: 180000 },
  { cdtCode: 'D2330', description: 'Resin-based composite — one surface, anterior', category: 'Restorative', defaultFeePhp: 120000 },
  { cdtCode: 'D2391', description: 'Resin-based composite — one surface, posterior', category: 'Restorative', defaultFeePhp: 130000 },
  { cdtCode: 'D2740', description: 'Crown — porcelain/ceramic substrate', category: 'Restorative', defaultFeePhp: 1200000 },
  { cdtCode: 'D2750', description: 'Crown — porcelain fused to high noble metal', category: 'Restorative', defaultFeePhp: 1000000 },
  { cdtCode: 'D3310', description: 'Endodontic therapy — anterior tooth', category: 'Endodontics', defaultFeePhp: 350000 },
  { cdtCode: 'D3330', description: 'Endodontic therapy — molar tooth', category: 'Endodontics', defaultFeePhp: 600000 },
  { cdtCode: 'D4341', description: 'Periodontal scaling and root planing — four or more teeth per quadrant', category: 'Periodontics', defaultFeePhp: 250000 },
  { cdtCode: 'D4910', description: 'Periodontal maintenance', category: 'Periodontics', defaultFeePhp: 150000 },
  { cdtCode: 'D5110', description: 'Complete denture — maxillary', category: 'Prosthodontics', defaultFeePhp: 2500000 },
  { cdtCode: 'D6010', description: 'Surgical placement of implant body', category: 'Implant Services', defaultFeePhp: 5000000 },
  { cdtCode: 'D7140', description: 'Extraction — erupted tooth or exposed root', category: 'Oral Surgery', defaultFeePhp: 80000 },
  { cdtCode: 'D7210', description: 'Surgical extraction — erupted tooth', category: 'Oral Surgery', defaultFeePhp: 200000 },
  { cdtCode: 'D7240', description: 'Removal of impacted tooth — completely bony', category: 'Oral Surgery', defaultFeePhp: 500000 },
  { cdtCode: 'D8080', description: 'Comprehensive orthodontic treatment — adolescent', category: 'Orthodontics', defaultFeePhp: 8000000 },
];

export async function seedProcedureCodes(db: DatabaseInstance): Promise<void> {
  const rows = CDT_CODES.map((c) => ({
    ...c,
    createdBy: OWNER_PERSON_ID,
    updatedBy: OWNER_PERSON_ID,
  }));
  await db.insert(dentalProcedureCodes).values(rows).onConflictDoNothing();
}
