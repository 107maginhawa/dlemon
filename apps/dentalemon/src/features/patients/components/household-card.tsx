/**
 * HouseholdCard — P1-27 household / guarantor (family file)
 *
 * PP-6 (ISSUE-040): made interactive. Reads the patient's household and lets staff
 * create one (this patient becomes the guarantor), add members (patient search →
 * relationship), and remove non-guarantor members. Writes go through
 * useHouseholdMutations, which invalidates the household query so the card
 * re-renders immediately. If the patient isn't in a household, an empty state
 * offers "Create household".
 */
import React, { useState } from 'react';
import { BRAND_GOLD_TEXT } from '@/constants/brand';
import { useHousehold, useHouseholdMutations } from '../hooks/use-household';
import { usePatients } from '../hooks/use-patients';
import { useOrgContextStore } from '@/stores/org-context.store';
import { getErrorMessage } from '@/lib/error-toast';

const RELATIONSHIP_OPTIONS = [
  { value: 'dependent', label: 'Dependent' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other' },
] as const;

const fieldClass = 'h-9 rounded-lg border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none';
const ghostBtn = 'h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50';
const lemonBtn = 'h-8 px-3 rounded-lg bg-lemon text-lemon-foreground text-xs font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50';

export function HouseholdCard({ patientId }: { patientId: string }) {
  const { data, isLoading, error } = useHousehold({ patientId });
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);

  if (isLoading) {
    return (
      <div data-testid="household-loading" className="rounded-xl border border-border bg-card p-4">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="household-error" className="rounded-xl border border-border bg-card p-4 text-sm text-destructive">
        Failed to load household.
      </div>
    );
  }

  if (!data || !data.household) {
    return (
      <div data-testid="household-empty" className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-1">Household</h3>
        <p className="text-sm text-muted-foreground mb-3">This patient is not linked to a household.</p>
        {creating ? (
          <CreateHouseholdForm patientId={patientId} onDone={() => setCreating(false)} />
        ) : (
          <button type="button" data-testid="create-household-btn" onClick={() => setCreating(true)} className={lemonBtn}>
            + Create household
          </button>
        )}
      </div>
    );
  }

  const { household, members } = data;

  return (
    <div data-testid="household-card" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Household</h3>
        <span data-testid="household-name" className="text-xs font-medium" style={{ color: BRAND_GOLD_TEXT }}>
          {household.name}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} data-testid="household-member" className="py-2 flex items-center justify-between gap-3">
            <span className="text-sm capitalize">{m.relationship}</span>
            <div className="flex items-center gap-2">
              {m.isGuarantor && (
                <span data-testid="guarantor-badge" className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-lemon text-lemon-foreground">
                  Guarantor
                </span>
              )}
              {!m.isGuarantor && (
                <RemoveMemberButton householdId={household.id} memberPatientId={m.patientId} cardPatientId={patientId} relationship={m.relationship} />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {adding ? (
          <AddMemberForm householdId={household.id} cardPatientId={patientId} branchId={household.branchId} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" data-testid="add-member-btn" onClick={() => setAdding(true)} className={ghostBtn}>
            + Add member
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Create household (current patient = guarantor) ──────────────────────────

function CreateHouseholdForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { create, isSaving } = useHouseholdMutations(patientId);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) { setErr('Household name is required'); return; }
    if (!branchId) { setErr('No active branch selected'); return; }
    setErr(null);
    try {
      await create({ branchId, name: name.trim(), guarantorPatientId: patientId });
      onDone();
    } catch (e) {
      setErr(getErrorMessage(e, 'Could not create the household. Please try again.'));
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="create-household-form">
      {err && <p className="text-sm text-destructive">{err}</p>}
      <input data-testid="household-name-input" className={fieldClass} placeholder="Family name (e.g. Santos Family)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" data-testid="create-household-submit" onClick={handleCreate} disabled={isSaving} className={lemonBtn}>
          {isSaving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onDone} className={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Add member (patient search → relationship) ──────────────────────────────

function AddMemberForm({ householdId, cardPatientId, branchId, onDone }: { householdId: string; cardPatientId: string; branchId: string; onDone: () => void }) {
  const { addMember, isSaving } = useHouseholdMutations(cardPatientId);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [relationship, setRelationship] = useState<string>('dependent');
  const [err, setErr] = useState<string | null>(null);

  const showResults = query.trim().length >= 2 && !selected;
  const { patients } = usePatients({ branchId, searchQuery: query });

  async function handleAdd() {
    if (!selected) return;
    setErr(null);
    try {
      await addMember({ householdId, patientId: selected.id, relationship });
      onDone();
    } catch (e) {
      setErr(getErrorMessage(e, 'Could not add the member. Please try again.'));
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="add-member-form">
      {err && <p className="text-sm text-destructive">{err}</p>}
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm font-medium">{selected.name}</span>
          <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Change</button>
        </div>
      ) : (
        <>
          <input data-testid="add-member-search" className={fieldClass} placeholder="Search a patient by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {showResults && (
            <ul className="rounded-lg border border-border divide-y divide-border max-h-40 overflow-y-auto">
              {patients.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No patients match “{query}”.</li>
              ) : (
                patients
                  .filter((p) => p.id !== cardPatientId)
                  .map((p) => (
                    <li key={p.id}>
                      <button type="button" data-testid={`add-member-opt-${p.id}`} onClick={() => { setSelected({ id: p.id, name: p.displayName }); setQuery(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 transition-colors">
                        {p.displayName}
                      </button>
                    </li>
                  ))
              )}
            </ul>
          )}
        </>
      )}

      {selected && (
        <select data-testid="add-member-relationship" className={fieldClass} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
          {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      <div className="flex gap-2">
        <button type="button" data-testid="add-member-submit" onClick={handleAdd} disabled={!selected || isSaving} className={lemonBtn}>
          {isSaving ? 'Adding…' : 'Add member'}
        </button>
        <button type="button" onClick={onDone} className={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Remove member ───────────────────────────────────────────────────────────

function RemoveMemberButton({ householdId, memberPatientId, cardPatientId, relationship }: { householdId: string; memberPatientId: string; cardPatientId: string; relationship: string }) {
  const { removeMember, isSaving } = useHouseholdMutations(cardPatientId);
  const [err, setErr] = useState(false);

  async function handleRemove() {
    setErr(false);
    try {
      await removeMember({ householdId, patientId: memberPatientId });
    } catch {
      setErr(true);
    }
  }

  return (
    <button
      type="button"
      data-testid={`remove-member-${memberPatientId}`}
      onClick={handleRemove}
      disabled={isSaving}
      className="text-xs text-destructive hover:underline disabled:opacity-50"
      aria-label={`Remove ${relationship} from household`}
      title={err ? 'Could not remove — try again' : undefined}
    >
      {err ? 'Retry' : 'Remove'}
    </button>
  );
}
