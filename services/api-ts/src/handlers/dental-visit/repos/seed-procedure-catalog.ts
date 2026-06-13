/**
 * seed-procedure-catalog.ts — global CDT procedure-code reference data.
 *
 * dental-org G2 (decision §5 = DRIVE pricing). The fee schedule is the active
 * CDT catalog with per-branch price overrides. That catalog (`dental_procedure_code`)
 * was never seeded, so the fee-schedule endpoints returned an empty list and PATCH
 * 404'd — the feature was inert. This seeds the canonical catalog idempotently on
 * server boot (alongside email templates), so operators can price procedures and
 * treatment creation can default from `defaultFeePhp`.
 *
 * Global reference data (not per-tenant). `defaultFeePhp` is a nationwide-neutral
 * starting point in centavos; clinics tune per-branch via the fee-schedule UI.
 */
import type { DatabaseInstance } from '@/core/database';
import { dentalProcedureCodes } from './procedure-code.schema';

interface CatalogEntry {
  cdtCode: string;
  description: string;
  category: string;
  defaultFeePhp: number; // centavos
}

export const PROCEDURE_CATALOG: CatalogEntry[] = [
  // Diagnostic
  { cdtCode: 'D0120', description: 'Periodic oral evaluation', category: 'diagnostic', defaultFeePhp: 50000 },
  { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', category: 'diagnostic', defaultFeePhp: 80000 },
  { cdtCode: 'D0210', description: 'Intraoral — complete series of radiographs', category: 'diagnostic', defaultFeePhp: 150000 },
  { cdtCode: 'D0220', description: 'Intraoral — periapical first radiograph', category: 'diagnostic', defaultFeePhp: 40000 },
  { cdtCode: 'D0274', description: 'Bitewings — four radiographs', category: 'diagnostic', defaultFeePhp: 80000 },
  // Preventive
  { cdtCode: 'D1110', description: 'Prophylaxis — adult', category: 'preventive', defaultFeePhp: 120000 },
  { cdtCode: 'D1120', description: 'Prophylaxis — child', category: 'preventive', defaultFeePhp: 90000 },
  { cdtCode: 'D1206', description: 'Topical application of fluoride varnish', category: 'preventive', defaultFeePhp: 60000 },
  { cdtCode: 'D1351', description: 'Sealant — per tooth', category: 'preventive', defaultFeePhp: 70000 },
  // Restorative
  { cdtCode: 'D2391', description: 'Resin-based composite — one surface, posterior', category: 'restorative', defaultFeePhp: 200000 },
  { cdtCode: 'D2392', description: 'Resin-based composite — two surfaces, posterior', category: 'restorative', defaultFeePhp: 260000 },
  { cdtCode: 'D2393', description: 'Resin-based composite — three surfaces, posterior', category: 'restorative', defaultFeePhp: 320000 },
  { cdtCode: 'D2740', description: 'Crown — porcelain/ceramic', category: 'restorative', defaultFeePhp: 1800000 },
  { cdtCode: 'D2750', description: 'Crown — porcelain fused to high noble metal', category: 'restorative', defaultFeePhp: 2000000 },
  // Endodontics
  { cdtCode: 'D3310', description: 'Endodontic therapy — anterior tooth', category: 'endodontics', defaultFeePhp: 800000 },
  { cdtCode: 'D3320', description: 'Endodontic therapy — premolar tooth', category: 'endodontics', defaultFeePhp: 1000000 },
  { cdtCode: 'D3330', description: 'Endodontic therapy — molar tooth', category: 'endodontics', defaultFeePhp: 1200000 },
  // Periodontics
  { cdtCode: 'D4341', description: 'Periodontal scaling and root planing — per quadrant', category: 'periodontics', defaultFeePhp: 350000 },
  { cdtCode: 'D4910', description: 'Periodontal maintenance', category: 'periodontics', defaultFeePhp: 250000 },
  // Prosthodontics / Implants
  { cdtCode: 'D6010', description: 'Surgical placement of implant body — endosteal', category: 'implant', defaultFeePhp: 5000000 },
  { cdtCode: 'D6065', description: 'Implant-supported porcelain/ceramic crown', category: 'implant', defaultFeePhp: 2500000 },
  // Oral surgery
  { cdtCode: 'D7140', description: 'Extraction — erupted tooth or exposed root', category: 'oral_surgery', defaultFeePhp: 150000 },
  { cdtCode: 'D7210', description: 'Surgical extraction — erupted tooth requiring removal of bone', category: 'oral_surgery', defaultFeePhp: 800000 },
  // Adjunctive
  { cdtCode: 'D9110', description: 'Palliative treatment of dental pain', category: 'adjunctive', defaultFeePhp: 120000 },
];

/**
 * Idempotently insert the canonical CDT catalog. Existing rows (matched by the
 * unique cdtCode) are left untouched, so clinic/operator edits to descriptions or
 * default fees are never clobbered on restart.
 */
export async function seedProcedureCatalog(db: DatabaseInstance): Promise<void> {
  await db.insert(dentalProcedureCodes).values(
    PROCEDURE_CATALOG.map((e) => ({
      cdtCode: e.cdtCode,
      description: e.description,
      category: e.category,
      defaultFeePhp: e.defaultFeePhp,
      active: true,
    })),
  ).onConflictDoNothing();
}
