#!/usr/bin/env bash
# Exits 1 only on NEW advisories not listed in SECURITY_ADVISORIES.md.
# Accepted advisories (triaged baseline) are allowed through silently.
set -euo pipefail

ADVISORIES_FILE="${1:-docs/audits/SECURITY_ADVISORIES.md}"

if [[ ! -f "$ADVISORIES_FILE" ]]; then
  echo "❌ Advisory file not found: $ADVISORIES_FILE"
  exit 1
fi

# Accepted GHSA IDs from the markdown table (first column entries only)
ACCEPTED=$(grep -oE 'GHSA-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+' "$ADVISORIES_FILE" | sort -u)

# bun audit exits 1 when vulnerabilities exist — capture output regardless
AUDIT_JSON=$(bun audit --json 2>&1) || true

# Extract all GHSA IDs reported by the audit
FOUND=$(printf '%s' "$AUDIT_JSON" | grep -oE 'GHSA-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+' | sort -u || true)

if [[ -z "$FOUND" ]]; then
  echo "✅ bun audit: no advisories found."
  exit 0
fi

FOUND_COUNT=$(printf '%s\n' "$FOUND" | grep -c . || true)

# Lines in FOUND that are absent from ACCEPTED
NEW=$(comm -23 <(printf '%s\n' "$FOUND") <(printf '%s\n' "$ACCEPTED") || true)
NEW=$(printf '%s' "$NEW" | grep -v '^$' || true)

if [[ -n "$NEW" ]]; then
  NEW_COUNT=$(printf '%s\n' "$NEW" | grep -c . || true)
  echo "❌ $NEW_COUNT unacknowledged advisor(ies) — add to $ADVISORIES_FILE before merging:"
  printf '%s\n' "$NEW" | sed 's/^/  /'
  exit 1
fi

echo "✅ bun audit: $FOUND_COUNT advisor(ies) found, all acknowledged in $ADVISORIES_FILE"
