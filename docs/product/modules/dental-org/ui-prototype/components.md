<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->

# Components — dental-org

---

## StatCard

```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; direction: 'up' | 'down' };
  isLoading?: boolean;
}
```
WAI-ARIA: `role="figure"` + `aria-label`
Skeleton: `h-24 rounded-xl` when isLoading

---

## InviteStaffForm

```typescript
interface InviteStaffFormProps {
  branchId: string;
  onSuccess: () => void;
}
// Schema (Zod):
// email: z.string().email()
// role: z.enum(['staff_scheduling','staff_full','dentist_associate','dentist_owner'])
```

---

## StaffTable

```typescript
interface StaffTableProps {
  branchId: string;
  members: DentalMembership[];
  isLoading: boolean;
  onRoleChange: (id: string, role: DentalRole) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}
```

---

## FeeScheduleTable

```typescript
interface FeeScheduleTableProps {
  branchId: string;
  entries: FeeScheduleEntry[];
  onPriceUpdate: (cdtCode: string, priceCents: number) => Promise<void>;
  isLoading: boolean;
}
```
Inline-edit: `<input type="number">` on cell click, saves on blur

---

## AuditLogTable

```typescript
interface AuditLogTableProps {
  events: AuditEvent[];
  pagination: PaginationMeta;
  isLoading: boolean;
  filters: AuditFilters;
  onFilterChange: (filters: AuditFilters) => void;
}
```
