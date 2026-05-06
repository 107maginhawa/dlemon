---
name: persona-audit
description: Validate module user journeys against defined personas before implementation. Finds dead ends, missing states, role confusion, and unreachable features. Use before /develop, "audit persona journey", "who uses this", "journey audit", or when starting a new module. ALWAYS run this before Phase 1 of /develop when building a new module to avoid discovering UX gaps mid-implementation.
---

# persona-audit

Persona-first journey validation. Before writing code, verify that module user flows make sense for each persona who will use it. Gaps found here cost 10 minutes to fix; gaps found after implementation cost days.

## Triggers

- Before `/develop` Phase 1 for any new module
- "Audit persona journey for {module}"
- "Who uses this feature"
- "Journey audit for {module}"
- When starting a new module or major feature

## Source Files

- `docs/context/personas.md` — persona definitions (create this file if it doesn't exist yet)
- `specs/api/docs/standards/business-rules.md` — rule constraints per persona role
- `apps/account/src/routes/` — actual route files to verify existence
- `docs/context/wireframes/` — wireframe HTML files for visual flow reference
- `specs/api/dist/openapi/openapi.json` — API capabilities per endpoint

## Workflow

### Step 1: Identify Personas

Read `docs/context/personas.md`. For each persona relevant to this module, establish:
- **Role**: what they are in the system (patient, provider, admin, etc.)
- **Permissions**: what API endpoints they can access
- **Tech comfort**: affects expected UI complexity and error tolerance
- **Goals**: what they're trying to accomplish with this module
- **Context of use**: mobile vs desktop, rushed vs deliberate, first-time vs returning

If `docs/context/personas.md` doesn't exist, flag this as a blocker and create a minimal version based on the OpenAPI security schemes and existing route role guards.

### Step 2: Map User Journeys

For each persona × module combination, trace the full journey:

| Phase | Questions to Answer |
|-------|-------------------|
| **Entry** | How does this persona reach the module? What nav link, deep link, or redirect? |
| **Discovery** | What do they see first? Empty state? List? Form? |
| **Action** | What can they do? Create, read, update, delete? What triggers each? |
| **Feedback** | How do they know the action succeeded or failed? Toast? Redirect? Inline error? |
| **Error** | What happens when validation fails, network fails, or they lack permission? |
| **Recovery** | Can they undo? Retry? Go back without losing state? |
| **Exit** | Where do they go after completing the journey? Is there a clear next step? |

### Step 3: Find Gaps

Look for these failure modes:

**Dead Ends** — User reaches a state with no forward path
- Example: create form submits successfully but lands on a blank page

**Unreachable Features** — Route exists in code but no navigation leads to it
- Check: is there a link/button/tab that navigates to this route?

**Missing States** — UI has no loading state, empty state, or error state
- Every data-fetching component needs all three

**Role Confusion** — Different roles reach the same page but see confusing differences
- Example: patient and provider see the same booking detail but have different actions available

**Broken Context** — User loses context mid-journey (e.g., form loses data on browser back)

### Step 4: Verify Route Structure

Check `apps/account/src/routes/` against the module's expected routes:
- [ ] Route file exists
- [ ] Navigation link exists (in sidebar, header, or parent route)
- [ ] Role protection is applied (redirect unauthorized users)
- [ ] Loading boundary exists (Suspense or skeleton)
- [ ] Error boundary exists (catch failed fetches)

Cross-reference with wireframes in `docs/context/wireframes/` to confirm the UI flow matches the design intent.

### Step 5: Check API Completeness

From `specs/api/dist/openapi/openapi.json`, verify the API supports everything the journey needs:
- Every user action has a corresponding endpoint
- Query parameters support the filtering/sorting the UI needs
- Response shapes include all fields the UI will display
- Error responses have the status codes and messages the UI will handle

### Step 6: Produce Journey Audit Report

```
## Persona Audit: {module}

### Personas Identified
- {Persona A}: {role} — primary user of this module
- {Persona B}: {role} — secondary user

### Journey Analysis

#### {Persona A}: {main journey name}
Entry: ✓ Nav link in sidebar under "{section}"
Discovery: ✓ List view with empty state
Action: ✓ Create, read, update
        ⚠ Delete missing — is this intentional?
Feedback: ✓ Toast on success, inline error on validation fail
Error: ✓ 401 redirects to login, 403 shows "Access denied"
Recovery: ⚠ Form loses data on browser back — add persistence
Exit: ✗ After create, lands on blank page — should redirect to detail view

#### {Persona B}: {secondary journey name}
Entry: ✗ No navigation path found — route exists but unreachable
...

### Gaps Found

**Blocking (must fix before implementation)**
- {Persona A} has no exit from create flow — define redirect target
- {Persona B} has no navigation entry point — add link in {location}

**Important (fix before ship)**
- Form state lost on browser back — add form persistence
- Delete action missing — confirm intentional or add endpoint

**Nice to Have**
- Empty state could include a CTA to create the first {entity}

### Recommended Implementation Order
1. {Persona A} journey first — primary user, highest traffic
2. {Persona B} journey second — depends on {Persona A}'s data

### Blockers
- ⚠ `docs/context/personas.md` missing — created minimal version based on auth roles
```

## Rules

- Never skip error and recovery phase analysis — these are where UX breaks
- Check that routes are REACHABLE via navigation, not just that they exist in the file system
- Include first-use/empty state analysis — new users see this most
- Flag role confusion explicitly — it's the #1 source of support tickets
- Implementation order must be persona-driven: most frequent user journey first
- If personas doc is missing, create a minimal version and continue — don't block on perfect documentation
