/**
 * RLS posture drift gate (ADR-010 P5).
 *
 * Asserts that every PHI table the RLS migrations (0104–0107, 0115) armed STILL has
 * Row-Level-Security ENABLED + FORCED and carries at least one policy, by querying
 * the live catalog (pg_class / pg_policies) of a freshly-migrated database.
 *
 * This is the ratchet that keeps the RLS investment from silently rotting: if a
 * future migration disables RLS, drops a policy, or a table is recreated without
 * its policy, this gate fails. When a NEW PHI table is armed, add it to
 * EXPECTED_RLS_TABLES below (the human half of the ratchet) so the gate covers it.
 *
 * Usage (CI runs it against the migrated monobase_test):
 *   DATABASE_URL=postgres://… bun scripts/check-rls-posture.ts
 *
 * Exit 0 = every expected table is armed. Exit 1 = drift (lists the offenders).
 */

import { Client } from 'pg';

// The canonical PHI table set armed across the RLS migrations. Grouped by phase
// for maintainability; the gate keys off the flat set. Keep in sync when a new
// PHI table gets an RLS policy (mirror: ALTER TABLE … FORCE + CREATE POLICY).
const EXPECTED_RLS_TABLES: readonly string[] = [
  // P0 (0104) — pilot
  'dental_visit',
  // P1a (0105) — Tier-1 direct-tenant-column tables
  'dental_invoice',
  'dental_payment',
  'dental_payer_payment',
  'dental_insurance_claim',
  'dental_perio_chart',
  'dental_appointment',
  'dental_appointment_hold',
  'dental_queue_item',
  'dental_waitlist_entry',
  'dental_operatory',
  'dental_household',
  'dental_coverage_authorization',
  'imaging_study',
  'imaging_finding',
  'dental_inventory_item',
  'dental_consent_template',
  'dental_treatment_template',
  'dental_postop_template',
  'dental_audit_log',
  'dental_feature_permission',
  // P2 (0106) — Tier-2a visit-anchored
  'dental_chart',
  'dental_treatment',
  'dental_finding',
  'prescription',
  'consent_form',
  'consent_refusal',
  'amendment',
  'lab_order',
  'dental_attachment',
  // P3a (0107) — patient + patient-anchored
  'patient',
  'medical_history_entry',
  'medical_history_review',
  'dental_alert',
  'dental_recall',
  'dental_task',
  'dental_patient_contact',
  'dental_insurance_profile',
  'dental_claim_draft',
  'dental_case_presentation',
  'dental_treatment_plan',
  'treatment_plan_version',
  'dental_patient_chart_baseline',
  'dental_occlusion_screening',
  // P6 (0115) — chart-anchored perio reading (per-site probing depths / BOP / CAL)
  'dental_perio_tooth_reading',
];

interface PostureRow {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  policy_count: number;
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('check-rls-posture: DATABASE_URL is not set');
    process.exit(2);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<PostureRow>(
      `SELECT c.relname,
              c.relrowsecurity,
              c.relforcerowsecurity,
              (SELECT count(*)::int FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
      [EXPECTED_RLS_TABLES],
    );

    const byName = new Map(rows.map((r) => [r.relname, r]));
    const problems: string[] = [];

    for (const table of EXPECTED_RLS_TABLES) {
      const row = byName.get(table);
      if (!row) {
        problems.push(`${table}: table not found in public schema`);
        continue;
      }
      const flaws: string[] = [];
      if (!row.relrowsecurity) flaws.push('RLS not ENABLED');
      if (!row.relforcerowsecurity) flaws.push('RLS not FORCED');
      if (row.policy_count < 1) flaws.push('no policy');
      if (flaws.length > 0) problems.push(`${table}: ${flaws.join(', ')}`);
    }

    if (problems.length > 0) {
      console.error(`❌ RLS posture drift on ${problems.length}/${EXPECTED_RLS_TABLES.length} table(s):`);
      for (const p of problems) console.error(`   - ${p}`);
      console.error('\nEvery armed PHI table must keep ENABLE+FORCE ROW LEVEL SECURITY and ≥1 policy.');
      console.error('If a table was intentionally removed, drop it from EXPECTED_RLS_TABLES in this script.');
      process.exit(1);
    }

    console.info(`✅ RLS posture intact — all ${EXPECTED_RLS_TABLES.length} PHI tables ENABLE+FORCE RLS with ≥1 policy.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('check-rls-posture: unexpected error', err);
  process.exit(2);
});
