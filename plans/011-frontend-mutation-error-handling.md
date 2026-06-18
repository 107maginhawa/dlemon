# Plan 011: Surface two silent frontend failures (image-compare blob-load + follow-up-note save)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- apps/dentalemon/src/features/imaging/components/comparison-view.tsx apps/dentalemon/src/features/patients/components/follow-up-notes.tsx apps/dentalemon/src/features/patients/hooks/use-follow-up-notes.ts`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (frontend)
- **Planned at**: commit `9524a2d3`, 2026-06-18

## Why this matters

Two frontend paths swallow a failure and leave the user with no feedback — the
same class as the calibration bug fixed in plan 008 (unhandled mutation/async
outcome → silent failure).

1. **Image comparison viewer** (`comparison-view.tsx`): the effect that loads the
   two cached image blobs does `void Promise.all([...]).then(...)` with **no
   `.catch()`**. `getCachedBlob` resolves `null` on a per-image cache miss
   (handled), but it `await openDB()` first, and `openDB()` *rejects* when
   IndexedDB can't be opened (private-browsing, storage disabled/blocked, quota).
   On that rejection the `.then` never runs, so `urlA`/`urlB` stay in their
   initial `'loading'` state **forever** — both panes show the skeleton
   indefinitely — and the browser logs an unhandled promise rejection.

2. **Follow-up notes** (`follow-up-notes.tsx`): `handleSubmit` calls
   `addNote(trimmed)` then **immediately** `setText('')`, clearing the textarea
   before the mutation resolves. The `useAddFollowUpNote` mutation has an
   `onSuccess` but **no `onError`**, and the component reads `addNote`/`isPending`
   but never the mutation `error`. So when a save fails (network/500), the typed
   note is gone, no error is shown anywhere, and the user believes it saved. For
   a clinical note this is silent data loss.

This plan brings both to parity with the app's convention: a failure must be
visible, and an optimistic clear must only happen on success.

## Current state

### Bug 1 — `apps/dentalemon/src/features/imaging/components/comparison-view.tsx`

State is `useState<string | null | 'loading'>('loading')` for both panes
(`:56-57`). The offending effect (`:80-102`):

```ts
useEffect(() => {
  let cancelled = false
  const objectUrls: string[] = []

  void Promise.all([getCachedBlob(imageA.id), getCachedBlob(imageB.id)]).then(
    ([blobA, blobB]) => {
      if (cancelled) return
      if (blobA) { const url = URL.createObjectURL(blobA); objectUrls.push(url); setUrlA(url) }
      else { setUrlA(null) }
      if (blobB) { const url = URL.createObjectURL(blobB); objectUrls.push(url); setUrlB(url) }
      else { setUrlB(null) }
    },
  )           // ← no .catch — an openDB() rejection leaves urlA/urlB === 'loading' forever
  return () => { cancelled = true /* …revokes objectUrls… */ }
}, [/* … */])
```

`getCachedBlob` (`apps/dentalemon/src/features/imaging/hooks/use-offline-cache.ts`)
resolves `null` on a get-miss but rejects when `openDB()` fails — so `Promise.all`
can reject. When a pane's url is `null`, the component renders `<OfflinePlaceholder>`
("Image not available offline", `:24-33`); when `'loading'` it renders a skeleton.
**So the correct failure behavior already exists — route the rejection to it by
setting both urls to `null`.**

### Bug 2 — `apps/dentalemon/src/features/patients/components/follow-up-notes.tsx`

```ts
const { notes, isLoading, error } = useFollowUpNotes({ patientId });
const { addNote, isPending } = useAddFollowUpNote({ patientId });   // ← no `error`
const [text, setText] = useState('');
// …
const handleSubmit = () => {
  const trimmed = text.trim();
  if (!isValid) return;
  addNote(trimmed);
  setText('');                 // ← clears BEFORE the mutation resolves
};
```

The list-query error is already rendered inline (`:102-105`):
```tsx
) : error ? (
  <div className="p-4 text-sm text-destructive">
    Failed to load follow-up notes.
  </div>
) : …
```
Match that inline-destructive style for the new add-error (do NOT use a toast here
— this component surfaces errors inline, and an inline message is what the test
asserts).

### Bug 2 hook — `apps/dentalemon/src/features/patients/hooks/use-follow-up-notes.ts`

```ts
export function useAddFollowUpNote({ patientId }: UseAddFollowUpNoteOptions) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...addFollowUpNoteMutation(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: listFollowUpNotesQueryKey({ path: { id: patientId } }) }); },
  });
  const addNote = (text: string) => { mutation.mutate({ path: { id: patientId }, body: { text } }); };
  return { addNote, isPending: mutation.isPending, error: mutation.error as Error | null };
}
```
The hook already *returns* `error`; the component just never uses it. `addNote`
needs to forward a per-call `onSuccess` so the component can clear the textarea
only after the save succeeds.

**Conventions**: FE tests run on Bun + happy-dom + `@testing-library/react`, live
next to the source under `__tests__/` (note: a sibling dir, NOT co-located).
Component tests mock the network via `global.fetch` + `freshClientWithMutations`/
`makeWrapper`/`jsonResponse` from `@/test-utils` (NOT `mock.module` — it
contaminates the process). Both target components already have test files — extend
them, don't create new ones.

## Commands you will need

| Purpose        | Command                                                                                          | Expected            |
|----------------|--------------------------------------------------------------------------------------------------|---------------------|
| FE typecheck   | `bun run --filter dentalemon typecheck`                                                          | exit 0              |
| FE lint        | `bun run --filter dentalemon lint`                                                               | exit 0              |
| FE test (file) | `cd apps/dentalemon && bunx bun test src/features/<path>/__tests__/<file>.test.ts`               | all pass            |

> **Test-runner gotcha**: the app's `bun run test` script is `bun test src/` and
> **ignores any file argument** (runs the whole suite). To target one file, use
> `bunx bun test <file>` from inside `apps/dentalemon`, exactly as shown above.

## Suggested executor toolkit

- Invoke `superpowers:test-driven-development`: for each bug, add the failing
  test first (RED), then the fix (GREEN).
- Invoke `superpowers:verification-before-completion` before claiming done — run
  every command in "Done criteria".

## Scope

**In scope** (the only files you may modify):
- `apps/dentalemon/src/features/imaging/components/comparison-view.tsx` (Bug 1 — only the blob-load effect)
- `apps/dentalemon/src/features/imaging/__tests__/comparison-view.test.ts` (Bug 1 test)
- `apps/dentalemon/src/features/patients/components/follow-up-notes.tsx` (Bug 2 — `handleSubmit` + add-error render)
- `apps/dentalemon/src/features/patients/hooks/use-follow-up-notes.ts` (Bug 2 — `addNote` onSuccess passthrough)
- `apps/dentalemon/src/features/patients/__tests__/follow-up-notes.test.ts` (Bug 2 test)

**Out of scope** (do NOT touch):
- `use-offline-cache.ts` — `getCachedBlob`'s resolve-null-on-miss / reject-on-openDB-failure is correct; only the *caller* must handle the rejection.
- The success-path behavior of either component (blob-present rendering; the existing "clears input on success" test must keep passing).
- The list-query error display in follow-up-notes (already correct).
- Any toast wiring — Bug 2 surfaces its error inline, matching the component's existing list-error treatment.

## Git workflow

- Branch: `advisor/011-frontend-mutation-error-handling`
- One commit: `fix(dentalemon): surface silent failures in image-compare load and follow-up-note save`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (Bug 1): Add a failing test for the openDB-rejection path (RED)

In `comparison-view.test.ts`, the `createFakeIndexedDB` helper currently supports
a blob, `null` (miss), or `'hang'`. Add a rejection path: make the fake `open()`
fire `onerror` (rejecting `openDB()`). Add a `'reject-open'` mode — in the returned
object's `open()`, when in reject mode, set `req.error` and call `req.onerror`
instead of `req.onsuccess`:

```ts
// inside createFakeIndexedDB(...), the open() method:
open(_name: string, _version?: number) {
  const req: Record<string, unknown> = { result: fakeDB, error: new Error('blocked') };
  queueMicrotask(() => {
    if (resolveWith === 'reject-open') { if (typeof req.onerror === 'function') (req.onerror as () => void)(); }
    else if (typeof req.onsuccess === 'function') (req.onsuccess as () => void)();
  });
  return req;
}
```
(Widen the `resolveWith` parameter type to include `'reject-open'`.)

Then add a test mirroring "shows offline message when blob not available":
```ts
test('shows offline message when IndexedDB cannot be opened (no infinite skeleton)', async () => {
  (globalThis as Record<string, unknown>).indexedDB =
    createFakeIndexedDB('reject-open') as unknown as IDBFactory;
  renderCV({ imageA: IMAGE_A, imageB: IMAGE_B });
  await waitFor(() => {
    expect(screen.getAllByText(/not available offline/i).length).toBe(2);
  });
});
```

**Verify**: `cd apps/dentalemon && bunx bun test src/features/imaging/__tests__/comparison-view.test.ts`
→ the new test FAILS (times out / never finds the offline message — panes stay on
skeleton). This is the expected RED. (The other tests still pass.)

### Step 2 (Bug 1): Route the rejection to the offline fallback (GREEN)

Add a `.catch` to the `Promise.all` chain in the effect that, when not cancelled,
sets both panes to `null` (→ `OfflinePlaceholder`):

```ts
void Promise.all([getCachedBlob(imageA.id), getCachedBlob(imageB.id)])
  .then(([blobA, blobB]) => { /* …unchanged… */ })
  .catch(() => {
    if (cancelled) return
    setUrlA(null)
    setUrlB(null)
  })
```

Do NOT change the `.then` body, the cleanup, or the dependency array.

**Verify**: `cd apps/dentalemon && bunx bun test src/features/imaging/__tests__/comparison-view.test.ts`
→ all tests pass (GREEN), including the new one.

### Step 3 (Bug 2): Add a failing test for the save-failure path (RED)

In `follow-up-notes.test.ts`, add a test modeled on "add note form submits text
and clears input" but with the POST failing:

```ts
test('keeps the typed note and shows an error when save fails', async () => {
  const user = userEvent.setup();
  let callCount = 0;
  global.fetch = mock(() => {
    callCount++;
    if (callCount === 1) return jsonResponse({ notes: [], total: 0 });   // GET
    return new Response('error', { status: 500 });                        // POST fails
  }) as unknown as typeof fetch;
  renderNotes();
  await waitFor(() => expect(screen.getByTestId('note-input')).not.toBeNull());

  const textarea = screen.getByTestId('note-input') as HTMLTextAreaElement;
  await user.clear(textarea);
  await user.type(textarea, 'Important clinical note');
  await act(async () => { await user.click(screen.getByTestId('note-submit')); });

  // The note must NOT be lost, and the failure must be visible.
  await waitFor(() => expect(screen.getByText(/could not save note/i)).not.toBeNull());
  expect((screen.getByTestId('note-input') as HTMLTextAreaElement).value).toBe('Important clinical note');
});
```

**Verify**: `cd apps/dentalemon && bunx bun test src/features/patients/__tests__/follow-up-notes.test.ts`
→ the new test FAILS (no error text; textarea was cleared). Expected RED. Note:
`freshClientWithMutations` must disable mutation retries so the 500 surfaces fast
— it does (existing tests rely on it); if the test hangs on retries, STOP.

### Step 4 (Bug 2): Clear-on-success + render the add-error (GREEN)

In `use-follow-up-notes.ts`, let `addNote` forward a per-call `onSuccess`:
```ts
const addNote = (text: string, opts?: { onSuccess?: () => void }) => {
  mutation.mutate({ path: { id: patientId }, body: { text } }, opts);
};
```
(`error` is already returned — no change there.)

In `follow-up-notes.tsx`:
1. Destructure the add-error: `const { addNote, isPending, error: addError } = useAddFollowUpNote({ patientId });`
2. Clear only on success:
   ```ts
   const handleSubmit = () => {
     const trimmed = text.trim();
     if (!isValid) return;
     addNote(trimmed, { onSuccess: () => setText('') });
   };
   ```
3. Render the add-error inline near the form (match the list-error style). Place it
   just below the textarea's footer row, inside the "Add note form" card:
   ```tsx
   {addError && (
     <p className="mt-2 text-sm text-destructive" role="alert">
       Could not save note. Please try again.
     </p>
   )}
   ```

**Verify**: `cd apps/dentalemon && bunx bun test src/features/patients/__tests__/follow-up-notes.test.ts`
→ all pass (GREEN), including the new failure test AND the existing
"clears input on success" test (clear-on-success must still clear on a 2xx).

### Step 5: Gates

**Verify**:
- `bun run --filter dentalemon typecheck` → exit 0
- `bun run --filter dentalemon lint` → exit 0
- Both test files pass (Steps 2 and 4 commands).

## Test plan

- `comparison-view.test.ts`: +1 test — IndexedDB open rejection → both panes show
  the offline placeholder (no infinite skeleton). Extend `createFakeIndexedDB`
  with a `'reject-open'` mode. Model: the existing "shows offline message when
  blob not available" test.
- `follow-up-notes.test.ts`: +1 test — POST 500 → typed text retained + inline
  "Could not save note" message. Model: the existing "add note form submits text
  and clears input" test (invert the POST outcome).
- Existing tests in both files must remain green (no success-path regression).

## Done criteria

ALL must hold:

- [ ] `comparison-view.tsx`'s blob-load `Promise.all` has a `.catch` that sets both urls to `null` when not cancelled
- [ ] `follow-up-notes.tsx` clears the textarea only via `onSuccess`, and renders an inline error when the add mutation fails
- [ ] `use-follow-up-notes.ts` `addNote` forwards a per-call `onSuccess`
- [ ] New comparison-view test (openDB rejection → offline message) passes
- [ ] New follow-up-notes test (500 → text kept + error shown) passes
- [ ] `bun run --filter dentalemon typecheck` exits 0
- [ ] `bun run --filter dentalemon lint` exits 0
- [ ] Only the 5 in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report (do not improvise) if:
- The "Current state" excerpts don't match the live code (drift since planning).
- `getCachedBlob` no longer awaits `openDB()` / no longer rejects (then Bug 1's
  premise is gone — report it).
- The follow-up-notes failure test hangs instead of failing fast (mutation retries
  not disabled by `freshClientWithMutations`) — STOP; do not add ad-hoc retry config.
- Making either test pass requires `mock.module` (the suites deliberately avoid it)
  or touching an out-of-scope file.

## Maintenance notes

- If `useAddFollowUpNote` is ever migrated to surface errors via toast (the
  app-wide convention used for measurement/calibration mutations in
  `features/imaging`), fold the inline add-error here into that, and update the
  test to spy on `toastError` instead of asserting inline text.
- A reviewer should confirm: Bug 1's `.then` body is byte-unchanged (only a
  `.catch` was appended); Bug 2's success path still clears the textarea (the
  existing "clears input on success" test proves it); and no toast was introduced.
- Deferred siblings (NOT in this plan): the same unhandled-`.then` shape does not
  appear elsewhere in `features/imaging` (audited); the perio/imaging list N+1s
  and the payment-plan FSM race are separately recorded in the README and are
  multi-tenant-cloud-scale concerns, intentionally not bundled here.
