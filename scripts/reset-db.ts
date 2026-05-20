/**
 * reset-db.ts — Wipe all patient-related demo data from the dev DB.
 *
 * Preserves: person, user, org/branch/membership rows (clinician login intact).
 * Clears: imaging_study (no FK to patient), patient (cascades to all children).
 *
 * Usage:
 *   bun scripts/reset-db.ts
 *
 * Or via:
 *   bun run db:reseed   (reset + seed in one shot — API must be running)
 */

const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase'

function psql(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = Bun.spawn(['psql', DB_URL, '-c', sql], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]).then(([out, err, code]) => {
      if (code !== 0) reject(new Error(err.trim() || out.trim()))
      else resolve(out.trim())
    }).catch(reject)
  })
}

async function main() {
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║     Dentalemon DB Reset Script       ║')
  console.log('╚══════════════════════════════════════╝')

  const before = await psql(`
    SELECT
      (SELECT COUNT(*) FROM patient)       AS patients,
      (SELECT COUNT(*) FROM imaging_study) AS studies;
  `)
  // Extract the numbers from psql tabular output
  const nums = before.match(/\d+/g) ?? []
  console.log(`\nBefore: ${nums[0] ?? '?'} patient(s), ${nums[1] ?? '?'} imaging study(ies)`)

  // imaging_study has no FK to patient (imaging.schema.ts:58) — must be
  // truncated explicitly; TRUNCATE patient CASCADE will not clear it.
  // review has no FK to patient either — clear it so NPS reviews can be re-seeded.
  // dental_treatment_template survives reset intentionally (org-level config).
  // dental_consent_template survives reset intentionally (org-level config).
  await psql('TRUNCATE TABLE imaging_study, review, patient CASCADE;')

  const after = await psql(`
    SELECT
      (SELECT COUNT(*) FROM patient)       AS patients,
      (SELECT COUNT(*) FROM imaging_study) AS studies;
  `)
  const nums2 = after.match(/\d+/g) ?? []
  console.log(`After:  ${nums2[0] ?? '?'} patient(s), ${nums2[1] ?? '?'} imaging study(ies)`)
  console.log('\n✓ DB reset complete — all patient data cleared')

  // ── Org/branch garbage sweep ───────────────────────────────────────────────
  // Preserve the demo org; delete all test orgs accumulated during dev/testing.
  // CASCADE: dental_organization → dental_branch → dental_membership (verified).
  // SAFETY: person/user rows are NOT deleted (patient.person_id FK cascade risk).
  console.log('\n▶ Org/branch cleanup')
  const keepOrgRaw = await psql(`
    SELECT o.id
    FROM "user" u
    JOIN dental_membership m ON m.person_id::text = u.id
    JOIN dental_branch b ON b.id = m.branch_id
    JOIN dental_organization o ON o.id = b.organization_id
    WHERE u.email = 'demo@dentalemon.com'
    LIMIT 1;
  `).catch(() => '')
  const keepOrgId = keepOrgRaw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]

  if (!keepOrgId) {
    console.log('  ⚠ Demo org not found — skipping cleanup (seed has not run yet)')
  } else {
    const beforeCounts = await psql(`
      SELECT
        (SELECT COUNT(*) FROM dental_organization) AS orgs,
        (SELECT COUNT(*) FROM dental_branch)       AS branches;
    `)
    const bc = beforeCounts.match(/\d+/g) ?? []
    console.log(`  Before: ${bc[0] ?? '?'} org(s), ${bc[1] ?? '?'} branch(es)`)
    console.log(`  Preserving: org ${keepOrgId.slice(0, 8)}…`)
    await psql(`DELETE FROM dental_organization WHERE id != '${keepOrgId}';`)
    const afterCounts = await psql(`
      SELECT
        (SELECT COUNT(*) FROM dental_organization) AS orgs,
        (SELECT COUNT(*) FROM dental_branch)       AS branches;
    `)
    const ac = afterCounts.match(/\d+/g) ?? []
    console.log(`  After:  ${ac[0] ?? '?'} org(s), ${ac[1] ?? '?'} branch(es)`)
    console.log('  ✓ Org/branch cleanup complete')
  }
  console.log()
}

main().catch(err => {
  console.error('\n✗ Reset failed:', err.message)
  process.exit(1)
})
