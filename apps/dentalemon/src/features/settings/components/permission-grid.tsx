/**
 * PermissionGrid — granular feature-permission matrix (P2-17).
 *
 * Renders a role × feature grid. Each cell toggles allow/deny for that role.
 * Cells default to the catalog defaults; the owner can override any cell.
 * Only the owner may save changes (the server also enforces this).
 *
 * Lemon design tokens only (bg-background / text-foreground / accent #FFE97D
 * via the `accent`/`primary` Tailwind tokens).
 */
import React, { useMemo, useState } from 'react';
import { Switch, Button } from '@monobase/ui';
import { useOrgContextStore } from '@/stores/org-context.store';
import {
  usePermissionGrid,
  useUpdatePermissions,
  type PermissionGrid as Grid,
  type PermissionOverrideInput,
} from '../hooks/use-permissions';

// Roles shown as columns, in display order.
const ROLE_COLUMNS = [
  'dentist_owner',
  'dentist_associate',
  'hygienist',
  'staff_full',
  'staff_scheduling',
  'dental_assistant',
  'front_desk',
  'billing_staff',
  'treatment_coordinator',
  'read_only',
] as const;

const ROLE_LABELS: Record<string, string> = {
  dentist_owner: 'Owner',
  dentist_associate: 'Associate',
  hygienist: 'Hygienist',
  staff_full: 'Staff (Full)',
  staff_scheduling: 'Scheduling',
  dental_assistant: 'Assistant',
  front_desk: 'Front Desk',
  billing_staff: 'Billing',
  treatment_coordinator: 'Coordinator',
  read_only: 'Read-only',
};

/** Index grid cells by `${role}::${feature}` → allowed. Exported for tests. */
export function indexCells(grid: Grid): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const c of grid.cells) map.set(`${c.role}::${c.feature}`, c.allowed);
  return map;
}

/**
 * Diff the current (edited) state against the server grid and produce the
 * minimal set of overrides to PUT. Exported for tests.
 */
export function diffOverrides(grid: Grid, edited: Map<string, boolean>): PermissionOverrideInput[] {
  const base = indexCells(grid);
  const out: PermissionOverrideInput[] = [];
  for (const [key, allowed] of edited) {
    if (base.get(key) !== allowed) {
      const [role, feature] = key.split('::');
      out.push({ role: role!, feature: feature!, allowed });
    }
  }
  return out;
}

export function PermissionGrid() {
  const orgId = useOrgContextStore((s) => s.orgId);
  const role = useOrgContextStore((s) => s.role);
  const isOwner = role === 'dentist_owner';

  const { grid, isLoading, error } = usePermissionGrid(orgId);
  const { save, isSaving, saveError, isSuccess, reset } = useUpdatePermissions(orgId);

  // Local edit state, keyed by `${role}::${feature}`.
  const [edited, setEdited] = useState<Map<string, boolean> | null>(null);

  const effective = useMemo(() => {
    if (!grid) return new Map<string, boolean>();
    return edited ?? indexCells(grid);
  }, [grid, edited]);

  const pending = useMemo(() => (grid ? diffOverrides(grid, effective) : []), [grid, effective]);

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading permissions…</div>;
  if (error) return <div className="p-4 text-destructive">Failed to load permissions: {error.message}</div>;
  if (!grid) return <div className="p-4 text-muted-foreground">No organization selected.</div>;

  const toggle = (role: string, feature: string, value: boolean) => {
    reset();
    setEdited((prev) => {
      const next = new Map(prev ?? indexCells(grid));
      next.set(`${role}::${feature}`, value);
      return next;
    });
  };

  const onSave = async () => {
    if (pending.length === 0) return;
    await save(pending);
    setEdited(null);
  };

  // Group catalog by category for readable sections.
  const byCategory = new Map<string, typeof grid.catalog>();
  for (const entry of grid.catalog) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Control which roles can perform each action. Unset cells use the recommended default.
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-3">
            {isSuccess && pending.length === 0 && (
              <span className="text-sm text-muted-foreground">Saved</span>
            )}
            <Button onClick={onSave} disabled={pending.length === 0 || isSaving}>
              {isSaving ? 'Saving…' : `Save${pending.length ? ` (${pending.length})` : ''}`}
            </Button>
          </div>
        )}
      </div>

      {saveError && <div className="text-sm text-destructive">{saveError.message}</div>}
      {!isOwner && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
          Only the practice owner can change permissions. You are viewing the current grid.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-secondary/50">
              <th className="sticky left-0 z-10 bg-secondary/50 px-3 py-2 text-left font-medium">Feature</th>
              {ROLE_COLUMNS.map((r) => (
                <th key={r} className="px-2 py-2 text-center font-medium whitespace-nowrap">{ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...byCategory.entries()].map(([category, entries]) => (
              <React.Fragment key={category}>
                <tr>
                  <td colSpan={ROLE_COLUMNS.length + 1} className="bg-background px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </td>
                </tr>
                {entries.map((entry) => (
                  <tr key={entry.feature} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">{entry.label}</td>
                    {ROLE_COLUMNS.map((r) => {
                      const key = `${r}::${entry.feature}`;
                      const allowed = effective.get(key) ?? false;
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          <Switch
                            checked={allowed}
                            disabled={!isOwner}
                            onCheckedChange={(v: boolean) => toggle(r, entry.feature, v)}
                            aria-label={`${ROLE_LABELS[r]} — ${entry.label}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
