<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-ui-blueprint --blueprint --all -->
<!-- based-on: ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md, MODULE_SPEC.md ×10 -->

# Navigation Map — Dentalemon

> Role-aware routing + sidebar structure for the dental clinic application.

---

## 1. Application Shells

| Shell | Route prefix | Used by |
|-------|-------------|---------|
| Auth shell | `/auth/*` | Unauthenticated |
| Clinic shell | `/` | All authenticated dental staff |
| Patient portal | `/portal/*` | Phase 2 — not yet implemented |

---

## 2. Sidebar Navigation Structure

### Sidebar items by role

| Nav Item | Icon | Route | `dentist_owner` | `dentist_associate` | `staff_full` | `staff_scheduling` |
|----------|------|-------|:---:|:---:|:---:|:---:|
| Dashboard | `LayoutDashboard` | `/dashboard` | ✅ | ✅ (filtered) | ❌ | ❌ |
| Patients | `Users` | `/patients` | ✅ | ✅ | ✅ | ❌ |
| Calendar | `Calendar` | `/calendar` | ✅ | ✅ | ✅ | ✅ |
| Workspace | `Stethoscope` | `/workspace/:visitId` | ✅ | ✅ | ✅ | ❌ |
| Billing | `Receipt` | `/billing` | ✅ | ❌ | ✅ | ❌ |
| Imaging | `Scan` | `/imaging` | ✅ | ✅ | ❌ | ❌ |
| Staff | `UserCog` | `/staff` | ✅ | ❌ | ❌ | ❌ |
| Reports | `BarChart` | `/reports` | ✅ | ❌ | ❌ | ❌ |
| Settings | `Settings` | `/settings` | ✅ | ❌ | ❌ | ❌ |

---

## 3. Route Tree

```
/
├── /auth
│   ├── /auth/login
│   └── /auth/pin           (PIN auth for locked sessions)
│
├── /dashboard              (dentist_owner, dentist_associate)
│
├── /patients               (staff_full+)
│   ├── /patients/new
│   ├── /patients/:id
│   │   ├── /patients/:id/profile
│   │   ├── /patients/:id/treatment-plan
│   │   ├── /patients/:id/imaging
│   │   ├── /patients/:id/documents   (PMD, EMR)
│   │   └── /patients/:id/billing
│   └── /patients/import
│
├── /calendar               (all roles)
│   ├── /calendar?date=today
│   └── /calendar/new       (book appointment)
│
├── /workspace/:visitId     (dentist+, staff_full)
│   ├── [Tab: Chart]        dental chart, treatment list
│   ├── [Tab: Clinical]     prescriptions, lab orders, consent, attachments
│   ├── [Tab: Notes]        clinical notes
│   ├── [Tab: Imaging]      imaging studies
│   └── [Tab: Billing]      invoice, payments (staff_full+)
│
├── /billing                (staff_full, dentist_owner)
│   ├── /billing/invoices
│   ├── /billing/invoices/:id
│   └── /billing/patients/:id/statement
│
├── /imaging                (dentist+)
│   ├── /imaging/studies
│   ├── /imaging/studies/:id
│   └── /imaging/ceph/:id
│
├── /staff                  (dentist_owner only)
│   ├── /staff/members
│   ├── /staff/invite
│   └── /staff/fee-schedule
│
├── /reports                (dentist_owner only)
│   └── /reports/audit-log
│
└── /settings               (dentist_owner only)
    ├── /settings/branch
    ├── /settings/consent-templates
    └── /settings/security   (PIN management)
```

---

## 4. Default Landing Pages

| Role | Default route |
|------|-------------|
| `dentist_owner` | `/dashboard` |
| `dentist_associate` | `/dashboard` |
| `staff_full` | `/patients` |
| `staff_scheduling` | `/calendar` |

---

## 5. Module → Route Mapping

| Module | Primary routes |
|--------|---------------|
| dental-org | `/staff`, `/settings` |
| dental-patient | `/patients` |
| dental-visit | `/workspace/:visitId` |
| dental-scheduling | `/calendar` |
| dental-billing | `/billing`, `/workspace/:visitId#billing` |
| dental-clinical | `/workspace/:visitId#clinical` |
| dental-imaging | `/imaging`, `/workspace/:visitId#imaging` |
| dental-pmd | `/patients/:id/documents` |
| dental-emr | `/patients/:id/documents` |
| dental-audit | `/reports/audit-log` |

---

## 6. Navigation State

- Active sidebar item: lemon (`#FFE97D`) text + 3px left border + soft bg
- Collapsed sidebar: shows icon rail; active item shows lemon icon
- Mobile (<768px): sidebar hidden by default, hamburger toggle
- Workspace: top tab bar replaces sidebar sub-navigation
