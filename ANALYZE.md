# Git Change Analysis Commands

This document provides commands for analyzing changes between branches in the Monobase monorepo.

## Overview

These commands help you analyze differences between your local branch and upstream, with filters to exclude noise (lockfiles, generated files) and focus on hand-written code changes.

**Common Use Cases:**
- Review changes before creating a pull request
- Compare your branch with upstream after rebasing
- Identify modified vs newly added files
- Exclude auto-generated files from diffs

---

## Analyzing Modified & Deleted Files

These commands show only files that existed in both branches but were changed or removed.

### Basic Commands

**1. Show statistics (modified + deleted files):**
```bash
git diff upstream/main...main --diff-filter=MD --stat
```

**2. Show full diff:**
```bash
git diff upstream/main...main --diff-filter=MD
```

**3. Show file names only:**
```bash
git diff upstream/main...main --diff-filter=MD --name-only
```

**4. Show with status indicators (M = Modified, D = Deleted):**
```bash
git diff upstream/main...main --diff-filter=MD --name-status
```

### Excluding Lockfiles

**Exclude bun.lock from analysis:**
```bash
git diff upstream/main...main --diff-filter=MD --stat -- . ':!bun.lock'
```

**Exclude all lockfiles:**
```bash
git diff upstream/main...main --diff-filter=MD --stat -- . ':!*.lock' ':!package-lock.json' ':!yarn.lock'
```

### Excluding Generated Files

**Exclude both lockfiles AND generated files:**
```bash
git diff upstream/main...main --diff-filter=MD --stat -- . ':!bun.lock' ':!**/generated/**'
```

**More specific (exclude only API generated files):**
```bash
git diff upstream/main...main --diff-filter=MD --stat -- . ':!bun.lock' ':!services/api/src/generated/**'
```

### Clean View (Hand-Written Changes Only)

**Best for code review - excludes lockfiles and generated files:**
```bash
git diff upstream/main...main --diff-filter=MD --stat -- . ':!bun.lock' ':!**/generated/**'
```

---

## Analyzing New Files

These commands show only files added in your branch that don't exist in upstream.

### Basic Commands

**1. Show statistics (new files only):**
```bash
git diff upstream/main...main --diff-filter=A --stat
```

**2. Show file names only:**
```bash
git diff upstream/main...main --diff-filter=A --name-only
```

**3. Count new files by directory:**
```bash
git diff upstream/main...main --diff-filter=A --name-only | cut -d'/' -f1-2 | sort | uniq -c
```

### Excluding Generated Files

**New files excluding generated directories:**
```bash
git diff upstream/main...main --diff-filter=A --stat -- . ':!**/generated/**'
```

### Categorized View

**Show new files with directory tree structure:**
```bash
git diff upstream/main...main --diff-filter=A --name-only | tree --fromfile
```

**Or use simple listing with indentation:**
```bash
git diff upstream/main...main --diff-filter=A --name-only | sed 's|/| |g' | column -t
```

---

## Complete Change Overview

### All Changes (Modified + Deleted + Added)

**1. Full summary with statistics:**
```bash
git diff upstream/main...main --stat
```

**2. File status summary:**
```bash
git diff upstream/main...main --name-status
```

**3. Count by change type:**
```bash
git diff upstream/main...main --name-status | awk '{print $1}' | sort | uniq -c
```

### Clean Overview (Excluding Noise)

**All changes, excluding lockfiles and generated files:**
```bash
git diff upstream/main...main --stat -- . ':!bun.lock' ':!**/generated/**'
```

---

## Understanding Diff Filters

The `--diff-filter` flag controls which types of changes to show:

| Filter | Meaning | Description |
|--------|---------|-------------|
| `M` | Modified | Files that exist in both branches but were changed |
| `A` | Added | New files in your branch not in upstream |
| `D` | Deleted | Files in upstream that were removed in your branch |
| `R` | Renamed | Files that were renamed |
| `C` | Copied | Files that were copied |
| `MD` | Modified + Deleted | Combine multiple filters |
| `AM` | Added + Modified | Combine filters for custom views |

**Examples:**
```bash
# Only modified files
git diff upstream/main...main --diff-filter=M --stat

# Only deleted files
git diff upstream/main...main --diff-filter=D --stat

# Only new files
git diff upstream/main...main --diff-filter=A --stat

# Modified + Deleted (no new files)
git diff upstream/main...main --diff-filter=MD --stat
```

---

## Interpreting Output

### `--stat` Output Format

```
path/to/file.ts                    |  42 ++++----
services/api/package.json          |   2 +-
packages/sdk/src/types.ts          | 156 +++++++++++++++++++++++++++++--
```

- **File path** | **Number** + visual bar showing additions (`+`) and deletions (`-`)
- The number indicates total lines changed
- Visual bar shows proportion of changes

### `--name-status` Output Format

```
M    path/to/modified-file.ts
A    path/to/new-file.ts
D    path/to/deleted-file.ts
```

- `M` = Modified
- `A` = Added
- `D` = Deleted

### Full Diff Output Format

```diff
diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -10,7 +10,8 @@
 unchanged line
-removed line
+added line
 unchanged line
```

- Lines starting with `-` (red) = removed from upstream
- Lines starting with `+` (green) = added in your branch
- Lines without prefix = unchanged context
- `@@ -10,7 +10,8 @@` = line numbers (old start,count new start,count)

---

## Path Exclusion Patterns

### Exclusion Syntax

```bash
-- . ':!pattern'
```

- `. ` = Include everything
- `:!pattern` = Except this pattern

### Common Exclusion Patterns

```bash
# Exclude specific file
':!bun.lock'

# Exclude all files matching pattern
':!*.lock'

# Exclude entire directory
':!node_modules/**'

# Exclude generated directories anywhere
':!**/generated/**'

# Exclude multiple patterns
':!bun.lock' ':!**/generated/**' ':!*.min.js'
```

### Examples

**Exclude lockfiles only:**
```bash
git diff upstream/main...main --stat -- . ':!bun.lock' ':!package-lock.json' ':!yarn.lock'
```

**Exclude generated and test files:**
```bash
git diff upstream/main...main --stat -- . ':!**/generated/**' ':!**/*.test.ts' ':!**/*.spec.ts'
```

**Exclude multiple file types:**
```bash
git diff upstream/main...main --stat -- . ':!*.lock' ':!*.log' ':!*.min.js' ':!dist/**'
```

---

## Quick Reference

### Most Useful Commands

```bash
# Clean view: Modified/deleted files (no lockfiles, no generated)
git diff upstream/main...main --diff-filter=MD --stat -- . ':!bun.lock' ':!**/generated/**'

# New files only (no generated)
git diff upstream/main...main --diff-filter=A --stat -- . ':!**/generated/**'

# Change summary by type
git diff upstream/main...main --name-status | awk '{print $1}' | sort | uniq -c

# File list for specific change type
git diff upstream/main...main --diff-filter=M --name-only -- . ':!bun.lock' ':!**/generated/**'
```

### Comparing Different Branches

Replace `upstream/main` with any branch reference:

```bash
# Compare with origin/main
git diff origin/main...main --stat

# Compare with specific branch
git diff feature/branch...main --stat

# Compare with specific commit
git diff abc123...main --stat
```

---

## Advanced Usage

### Show Changes in Specific Directory

```bash
# Only changes in services/api
git diff upstream/main...main --stat -- services/api/

# Exclude generated files in that directory
git diff upstream/main...main --stat -- services/api/ ':!services/api/src/generated/**'
```

### Show Changes to Specific File Types

```bash
# Only TypeScript files
git diff upstream/main...main --stat -- '*.ts' '*.tsx'

# Only package.json files
git diff upstream/main...main --stat -- '**/package.json'

# Only config files
git diff upstream/main...main --stat -- '**/*.config.ts' '**/*.config.js'
```

### Generate Reports

**Create a change summary report:**
```bash
echo "# Change Summary" > CHANGES.md
echo "" >> CHANGES.md
echo "## Statistics" >> CHANGES.md
git diff upstream/main...main --stat -- . ':!bun.lock' ':!**/generated/**' >> CHANGES.md
echo "" >> CHANGES.md
echo "## Modified Files" >> CHANGES.md
git diff upstream/main...main --diff-filter=M --name-only -- . ':!bun.lock' ':!**/generated/**' >> CHANGES.md
echo "" >> CHANGES.md
echo "## New Files" >> CHANGES.md
git diff upstream/main...main --diff-filter=A --name-only -- . ':!**/generated/**' >> CHANGES.md
```

---

## Tips

1. **Use `--stat` for overview** - Shows which files changed and by how much
2. **Use `--name-only` for lists** - Get clean file lists for scripting
3. **Use `--name-status` for categorized view** - See M/A/D indicators
4. **Combine filters** - Use `MD` for existing file changes, `A` for new files
5. **Always exclude noise** - Use `:!` patterns to filter out lockfiles and generated files
6. **Use three-dot syntax** - `upstream/main...main` shows changes in your branch since it diverged
7. **Pipe to tools** - Combine with `grep`, `awk`, `wc`, etc. for custom analysis

---

## See Also

- [Git Diff Documentation](https://git-scm.com/docs/git-diff)
- [Git Diff Filtering](https://git-scm.com/docs/git-diff#Documentation/git-diff.txt---diff-filterACDMRTUXB82308203)
- [Pathspec Patterns](https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec)
