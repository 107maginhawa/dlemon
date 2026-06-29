/**
 * seed-coherence-guard.ts — fail the reseed if the demo data is internally incoherent.
 *
 * Reads RAW DB snapshots (not derived/summary fields) and asserts cross-module
 * invariants. Exits non-zero with a clear message on the first violation so a bad
 * seed can never be mistaken for a logic bug later.
 *
 * Runs automatically as the last step of `bun run db:reseed`. Run standalone with:
 *   DATABASE_URL=postgres://postgres:password@localhost:5432/monobase bun services/api-ts/scripts/seed-coherence-guard.ts
 */

const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase'

function psql(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = Bun.spawn(['psql', DB_URL, '-tAc', sql], { stdout: 'pipe', stderr: 'pipe' })
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

const num = async (sql: string) => parseInt((await psql(sql)).match(/-?\d+/)?.[0] ?? 'NaN', 10)

type Check = { name: string; sql: string; explain: string }

// Each check counts VIOLATING rows — 0 means coherent.
const CHECKS: Check[] = [
  {
    name: 'no draft visits left by seed',
    // Seed hygiene: every visit the seed starts must be activated/completed, never
    // left half-created at 'draft' (the check-in flow activates its draft visit).
    sql: `SELECT count(*) FROM dental_visit WHERE status = 'draft'`,
    explain: 'seed left a half-created draft visit',
  },
  {
    name: 'at most one open visit per patient',
    // One-open-visit rule (clinical: a patient has one in-progress encounter at a time).
    // Counts patients holding more than one open (draft|active) visit.
    sql: `SELECT count(*) FROM (
            SELECT patient_id FROM dental_visit
            WHERE status IN ('draft','active')
            GROUP BY patient_id HAVING count(*) > 1
          ) t`,
    explain: 'a patient has more than one open visit (violates the one-open-visit rule)',
  },
  {
    name: 'invoice balance = total - paid',
    sql: `SELECT count(*) FROM dental_invoice WHERE status <> 'voided' AND balance_cents <> total_cents - paid_cents`,
    explain: 'invoice arithmetic is internally inconsistent',
  },
  {
    name: 'no orphan visits (patient exists)',
    sql: `SELECT count(*) FROM dental_visit v LEFT JOIN patient p ON p.id = v.patient_id WHERE p.id IS NULL`,
    explain: 'a visit points at a missing patient',
  },
  {
    name: 'no orphan treatments (visit exists)',
    sql: `SELECT count(*) FROM dental_treatment t LEFT JOIN dental_visit v ON v.id = t.visit_id WHERE v.id IS NULL`,
    explain: 'a treatment points at a missing visit',
  },
  {
    name: 'no orphan charts (visit exists)',
    sql: `SELECT count(*) FROM dental_chart c LEFT JOIN dental_visit v ON v.id = c.visit_id WHERE v.id IS NULL`,
    explain: 'a chart row points at a missing visit',
  },
  {
    name: 'no orphan invoices (patient exists)',
    sql: `SELECT count(*) FROM dental_invoice i LEFT JOIN patient p ON p.id = i.patient_id WHERE p.id IS NULL`,
    explain: 'an invoice points at a missing patient',
  },
]

async function main() {
  console.log('\n▶ Seed coherence guard')
  let failed = 0
  for (const c of CHECKS) {
    const violations = await num(c.sql)
    if (violations > 0) {
      failed++
      console.error(`  ✗ ${c.name}: ${violations} violation(s) — ${c.explain}`)
    } else {
      console.log(`  ✓ ${c.name}`)
    }
  }

  // ── Report (so the data volume is visible at a glance) ──────────────────────
  const patients = await num(`SELECT count(*) FROM patient`)
  const encounters = await num(`SELECT count(*) FROM dental_visit WHERE status IN ('completed','locked')`)
  const deepest = await num(`
    SELECT coalesce(max(c), 0) FROM (
      SELECT count(*) AS c FROM dental_visit
      WHERE status IN ('completed','locked') GROUP BY patient_id
    ) t`)
  const openVisits = await num(`SELECT count(*) FROM dental_visit WHERE status IN ('draft','active')`)
  const billing = await psql(`
    SELECT
      count(*) FILTER (WHERE status <> 'voided' AND balance_cents = 0 AND paid_cents > 0) AS paid,
      count(*) FILTER (WHERE status <> 'voided' AND balance_cents > 0 AND paid_cents > 0) AS partial,
      count(*) FILTER (WHERE status <> 'voided' AND paid_cents = 0 AND balance_cents > 0) AS outstanding
    FROM dental_invoice`)
  const [paid = '?', partial = '?', outstanding = '?'] = billing.split('|')
  console.log(`\n  Patients: ${patients} | counted visits (completed+locked): ${encounters} | deepest history: ${deepest} | open "Current" visits: ${openVisits}`)
  console.log(`  Invoices — paid: ${paid}, partial: ${partial}, outstanding: ${outstanding}`)

  if (failed > 0) {
    console.error(`\n✗ Coherence guard FAILED — ${failed} invariant(s) violated. Seed is incoherent.\n`)
    process.exit(1)
  }
  console.log('\n✓ Coherence guard passed — demo data is internally coherent\n')
}

main().catch(err => {
  console.error('\n✗ Coherence guard error:', err.message)
  process.exit(1)
})
