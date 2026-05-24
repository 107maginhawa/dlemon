<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->
<!-- WARNING: Non-authoritative demo data only. Not schema truth. -->

# Mock Data — dental-org

```typescript
// Branch
{ id: "01JXBRANCH01", org_id: "01JXORG001", name: "Sunshine Dental — City", timezone: "Australia/Sydney", created_at: "2026-01-15T00:00:00Z" }

// Memberships
[
  { id: "01JXMEM001", branch_id: "01JXBRANCH01", person_id: "01JXPERSON1", role: "dentist_owner", status: "active" },
  { id: "01JXMEM002", branch_id: "01JXBRANCH01", person_id: "01JXPERSON2", role: "dentist_associate", status: "active" },
  { id: "01JXMEM003", branch_id: "01JXBRANCH01", person_id: "01JXPERSON3", role: "staff_full", status: "active" },
  { id: "01JXMEM004", branch_id: "01JXBRANCH01", person_id: "01JXPERSON4", role: "staff_scheduling", status: "invited" }
]

// Dashboard stats
{ appointments_today: 12, active_patients: 847, outstanding_invoices: 23, outstanding_cents: 450000 }

// Fee schedule entries
[
  { cdt_code: "D0150", description: "Comprehensive Oral Evaluation", price_cents: 9000 },
  { cdt_code: "D0210", description: "Complete Series of Radiographic Images", price_cents: 22000 },
  { cdt_code: "D1110", description: "Prophylaxis — Adult", price_cents: 16000 },
  { cdt_code: "D2160", description: "Amalgam Restoration — 3 surfaces", price_cents: 25000 }
]
```
