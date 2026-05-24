<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-audit, DOMAIN_MODEL §5, PRD_AUDIT_REPORT, ASVS_L2 -->
<!-- condition: generated because project is healthcare/regulated -->

# Audit Contracts — Dentalemon

> HIPAA-mandated audit trail contracts. All modules must produce compliant audit events.
> Audit events are append-only, immutable, PHI-free, and retained for 7 years.

---

## 1. Compliance Basis

| Regulation | Requirement | Implementation |
|------------|-------------|---------------|
| HIPAA § 164.312(b) | Audit controls | dental-audit module, 7-year retention |
| HIPAA § 164.312(a)(2)(i) | Unique user identification | actor_id = person UUID |
| HIPAA § 164.308(a)(5) | Login monitoring | Better-Auth session events |
| PHI-logging gap G-005 | No PHI in audit fields | Enforced by schema + AI rule |

---

## 2. Audit Event Schema

```typescript
interface AuditEvent {
  id: string;             // ULID — immutable primary key
  event_type: string;     // Matches domain event catalog (DE-001–DE-024) or ACCESS_* codes
  actor_id: string;       // Person UUID — who performed the action ("system" for automated)
  actor_role: string;     // Membership role at time of event
  branch_id: string;      // Branch where event occurred
  aggregate_type: string; // Entity name (Visit, Invoice, Patient, etc.)
  aggregate_id: string;   // UUID of the affected entity
  action: string;         // CREATED | READ | UPDATED | DELETED | ACCESSED | GENERATED
  occurred_at: string;    // ISO 8601 UTC — immutable
  ip_address?: string;    // Source IP (web requests only; null for offline-first)
  user_agent?: string;    // Client UA (web only)
  metadata: Record<string, string | number | boolean>; // Safe non-PHI context
}
```

**PHI rules (G-005):**
- `metadata` MUST NOT contain: patient names, DOB, email, phone, address, SSN, diagnosis text, medication names
- Only IDs, counts, status codes, CDT codes, and boolean flags allowed in metadata

---

## 3. Mandatory Audit Events per Module

| Module | Operation | Event Action | Audit Required |
|--------|-----------|-------------|---------------|
| dental-org | Create org/branch | CREATED | YES |
| dental-org | Assign membership | CREATED | YES |
| dental-org | Revoke membership | DELETED | YES |
| dental-org | View audit log | ACCESSED | YES (self-audit) |
| dental-patient | Create patient | CREATED | YES |
| dental-patient | View patient profile | READ | YES |
| dental-patient | Archive patient | UPDATED | YES |
| dental-patient | Export patient data | ACCESSED | YES |
| dental-visit | Create visit | CREATED | YES |
| dental-visit | Complete visit | UPDATED | YES |
| dental-visit | Lock visit | UPDATED | YES |
| dental-scheduling | Book appointment | CREATED | YES |
| dental-scheduling | Cancel appointment | DELETED | YES |
| dental-billing | Create invoice | CREATED | YES |
| dental-billing | Record payment | UPDATED | YES |
| dental-billing | Void invoice | UPDATED | YES |
| dental-clinical | Write prescription | CREATED | YES |
| dental-clinical | Sign consent | UPDATED | YES |
| dental-clinical | Revoke consent | UPDATED | YES |
| dental-imaging | Upload imaging study | CREATED | YES |
| dental-imaging | Access imaging study | READ | YES |
| dental-pmd | Generate PMD | CREATED | YES |
| dental-pmd | Download PMD | ACCESSED | YES |
| dental-emr | Import EMR record | CREATED | YES |
| dental-emr | View EMR record | READ | YES |

---

## 4. Audit Event Delivery

- Delivery: async via pg-boss (`dental-audit` queue)
- Timing: < 5s after triggering operation (SLA)
- Blocking: audit event emission MUST NOT block main request (fire-and-forget after transaction commit)
- Failure handling: audit write failure → DLQ alert, but original operation succeeds (audit lag tolerated)

---

## 5. Audit Log Query Contract

**Endpoint:** `GET /api/v1/dental/audit-events`

**Auth:** `dentist_owner` only

**Query params:**

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `branch_id` | uuid | YES | Branch scope — guards cross-branch access |
| `actor_id` | uuid | NO | Filter by specific staff member |
| `event_type` | string | NO | Filter by DE-code or ACCESS_* |
| `aggregate_type` | string | NO | Filter by entity (Visit, Invoice, etc.) |
| `aggregate_id` | uuid | NO | Filter by specific entity |
| `date_from` | date | NO | ISO 8601 date (YYYY-MM-DD) |
| `date_to` | date | NO | ISO 8601 date (YYYY-MM-DD) |
| `page` | integer | NO | Default: 1 |
| `per_page` | integer | NO | Default: 20, max: 100 |

**Response:** Standard paginated collection envelope (API_CONVENTIONS.md §2.2)

**Rules:**
- Returns only events for requesting user's branch (`AC-AUD-003`)
- Maximum 7 years of history returned
- No PHI in any field (`AC-AUD-004`)

---

## 6. Audit Record Immutability

- `PATCH`, `PUT`, `DELETE` on audit events return `405 Method Not Allowed`
- Database-level: append-only via trigger or RLS policy prohibiting UPDATE/DELETE
- Error code: `AUDIT_EVENT_IMMUTABLE`
