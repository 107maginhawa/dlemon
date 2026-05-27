# Git Workflow, PRs & Code Review

This document covers branching strategy, commit conventions, upstream sync, pull request process, code review guidelines, and debugging tips.

## Git Workflow

### Branching Strategy

```bash
main                    # Production-ready code
├── develop            # Integration branch (if using)
├── feature/add-video-calls
├── fix/booking-timezone-bug
└── chore/update-dependencies
```

### Branch Naming Conventions

- `feature/` - New features (e.g., `feature/video-calls`)
- `fix/` - Bug fixes (e.g., `fix/appointment-reminder-timing`)
- `chore/` - Maintenance tasks (e.g., `chore/upgrade-react-19`)
- `docs/` - Documentation updates (e.g., `docs/add-api-examples`)
- `refactor/` - Code refactoring (e.g., `refactor/extract-consent-logic`)

### Commit Message Format

Follow Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples**:
```bash
feat(booking): add host availability search filters

Add specialty, language, and service tier filters to host search.
Includes backend API updates and frontend UI components.

Closes #123

---

fix(client): resolve appointment timezone display issue

Client appointments were showing in UTC instead of local timezone.
Updated date formatting logic to use client's timezone preference.

Fixes #456

---

chore(deps): upgrade TanStack Router to v1.80.0

Update TanStack Router across all apps. No breaking changes.
```

### Before Committing

Run pre-commit checklist:

```bash
# 1. Type checking
bun run typecheck

# 2. Run tests
bun test

# 3. Build check
bun run build

# 4. Lint (if configured)
bun run lint
```

## Upstream Sync (mono-js-lf)

`mono-js-lfh` is a healthcare-flavored fork of `mono-js-lf`. Periodic
updates flow downstream via merge commits (no rebase, no squash).

**Remote** — `mono-js-lf-base` -> `/home/freyr/Projects/monobaselabs/mono-js-lf`
(configured in `.git/config`; mirrors how `mono-js-lf` consumes `mono-js`).
Set up with:

```bash
git remote add mono-js-lf-base /home/freyr/Projects/monobaselabs/mono-js-lf
git fetch mono-js-lf-base
```

**Sync command template:**

```bash
git fetch mono-js-lf-base
git merge --no-ff mono-js-lf-base/main
```

**Commit message format** (block-form, matches mono-js-lf's upstream merges):

```
Merge mono-js-lf (N commits): <one-line theme>

Adopt:
  <oldsha>..<newsha> -> mono-js-lf-base/main

- <sha> <subject>. <1-3 line rationale>.

Conflicts:
- <path>: <resolution choice>.

Verified: <typecheck/build/test summary>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

The three repos (`mono-js`, `mono-js-lf`, `mono-js-lfh`) share root commit
`4eb768d`, so `--allow-unrelated-histories` is **not** needed.

**Things mono-js-lfh keeps that aren't in upstream**: the FHIR-aligned
healthcare TypeSpec modules under `specs/api/src/healthcare/` and the
healthcare-specific platform modules `specs/api/src/modules/{patient,
provider,emr}.tsp` (with their corresponding handlers under
`services/api-ts/src/handlers/{patient,provider,emr}/`). Conflict resolution
should preserve these. Everything else (apps layout, services/api-ts,
packages/sdk-ts) follows upstream.

## Pull Request Process

### 1. Create Pull Request

- **Title**: Clear, descriptive (follows commit convention)
- **Description**: What, why, and how
- **Linked Issues**: Reference related issues
- **Screenshots**: For UI changes
- **Testing**: Describe how to test changes

**PR Template**:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
1. Step-by-step testing instructions
2. Expected behavior

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] TypeScript types are correct
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors
- [ ] Tested locally
```

### 2. PR Review Requirements

- **Minimum**: 1 approval from code owner
- **Breaking Changes**: 2 approvals required
- **Database Changes**: Database owner approval
- **Security Changes**: Security review required

### 3. Automated Checks

PRs must pass:
- ✅ TypeScript type checking
- ✅ Unit tests
- ✅ E2E tests (if applicable)
- ✅ Build succeeds

### 4. Addressing Review Comments

```bash
# Make requested changes
git add .
git commit -m "fix: address PR review comments"
git push origin feature/your-feature
```

### 5. Merging

- **Squash and Merge**: For feature branches (keeps history clean)
- **Merge Commit**: For release branches
- **Delete Branch**: After merging

## Code Review Guidelines

### For Reviewers

#### What to Look For

**Functionality**:
- Does the code do what it's supposed to?
- Are edge cases handled?
- Is error handling appropriate?

**Code Quality**:
- Is the code readable and maintainable?
- Are names descriptive and consistent?
- Is there unnecessary complexity?
- Are there code smells?

**TypeScript**:
- Are types correct and specific (not `any`)?
- Are interfaces/types properly defined?
- Is type safety maintained?

**Security**:
- Are inputs validated?
- Is sensitive data protected?
- Are SQL injection risks prevented (using ORM)?
- Is authentication/authorization correct?

**Enterprise Compliance**:
- Are audit logs present for sensitive operations?
- Is consent validated before data access?
- Is PII handled appropriately?

**Testing**:
- Are tests included?
- Do tests cover edge cases?
- Are tests meaningful (not just for coverage)?

**Documentation**:
- Are complex sections commented?
- Is API documentation updated?
- Are breaking changes documented?

#### How to Give Feedback

**Be Constructive**:
```
❌ This is wrong
✅ Consider using a Map instead of an array for O(1) lookups
```

**Be Specific**:
```
❌ This needs work
✅ The error handling here should catch ZodError separately to return 400 instead of 500
```

**Explain Why**:
```
❌ Don't use any
✅ Using `any` here loses type safety. Consider `unknown` and use a type guard, or define a proper interface
```

**Acknowledge Good Work**:
```
✅ Nice refactoring! This is much more readable
✅ Great test coverage on edge cases
```

### For Authors

#### Responding to Reviews

- **Be Receptive**: Reviews improve code quality
- **Ask Questions**: If feedback is unclear, ask for clarification
- **Discuss Alternatives**: If you disagree, discuss respectfully
- **Resolve Conversations**: Mark as resolved after addressing

**Good Response**:
```
Thanks for catching that! I've updated the error handling to use a type guard.
Fixed in commit abc1234.
```

#### Self-Review Checklist

Before requesting review:
- [ ] Read your own diff
- [ ] Remove debugging code
- [ ] Update documentation
- [ ] Add tests
- [ ] Run type checking
- [ ] Test locally
- [ ] Check for console warnings

## Debugging Tips

### API Service Debugging

**Enable Debug Logging**:
```typescript
// services/api-ts/src/utils/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL || 'debug', // Set to 'debug'
});
```

**View Request/Response**:
```bash
# Add logging middleware
app.use('*', async (c, next) => {
  console.log('Request:', c.req.method, c.req.url);
  await next();
  console.log('Response:', c.res.status);
});
```

**Database Query Logging**:
```typescript
// Enable Drizzle query logging
import { drizzle } from 'drizzle-orm/postgres-js';

const db = drizzle(client, { logger: true });
```

**Common Issues**:

1. **Port Already in Use**:
```bash
# Find process using port 4000
lsof -i :4000
# Kill the process
kill -9 <PID>
```

2. **Database Connection Failed**:
```bash
# Verify PostgreSQL is running
pg_isready

# Check connection string
echo $DATABASE_URL
```

3. **Module Not Found**:
```bash
# Reinstall dependencies
rm -rf node_modules
bun install
```

### Frontend Debugging

**React DevTools**:
- Install React DevTools browser extension
- Inspect component tree and props
- Profile rendering performance

**Network Tab**:
- Monitor API requests
- Check request/response payloads
- Verify authentication headers

**Common Issues**:

1. **API Connection Failed**:
```typescript
// Check API URL configuration
console.log(import.meta.env.VITE_API_URL);
```

2. **TypeScript Errors After API Changes**:
```bash
# Regenerate API types
cd specs/api
bun run build

# Restart dev server
cd apps/account
bun dev
```

3. **Stale Cache**:
```bash
# Clear Vite cache
rm -rf node_modules/.vite
bun dev
```

### Database Debugging

**Drizzle Studio**:
```bash
cd services/api-ts
bun run db:studio
# Opens http://localhost:4983
```

**Manual SQL**:
```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d clients

# Query data
SELECT * FROM clients LIMIT 10;
```

**Migration Issues**:
```bash
# Reset database (CAUTION: deletes all data)
dropdb monobase
createdb monobase
cd services/api-ts
bun run db:generate
```

### TypeSpec Debugging

**View Generated OpenAPI**:
```bash
cd specs/api
bun run build
cat dist/openapi/openapi.json | jq
```

**Validate TypeSpec Syntax**:
```bash
cd specs/api
bun run build  # Errors will show TypeSpec compilation issues
```

**Common TypeSpec Errors**:
- Missing imports: Add `import "@typespec/http";`
- Type not found: Check namespace imports
- Circular references: Restructure type dependencies
