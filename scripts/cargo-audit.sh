#!/usr/bin/env bash
# cargo-audit.sh — RustSec CVE scan for the workspace's Cargo crates.
#
# `bun audit` (scripts/check-audit.sh) only covers the JS/TS dependency graph.
# The Rust crates services/cadence and services/api-ts-embedded carry their own
# Cargo.lock files that are otherwise unscanned. This script runs `cargo audit`
# against each one.
#
# Requires `cargo-audit` (https://github.com/rustsec/rustsec). Install with:
#   cargo install cargo-audit --locked
# In CI, install it before invoking this script (see .github/workflows/quality.yml).
#
# Exit codes:
#   0  — cargo-audit ran on every crate and found no vulnerabilities,
#        OR cargo-audit is not installed (advisory skip — prints a notice).
#   1  — cargo-audit reported a vulnerability in at least one crate.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CRATES=(
  "services/cadence"
  "services/api-ts-embedded"
)

# Tracked-exception advisories. These live in the cadence transport/dependency tree
# (Iroh + friends) and api-ts-embedded; they are ACCEPTED, not remediated, until those
# Rust deps are upgraded (see docs/security/SECURITY_ADVISORIES.md, Rust section).
# `--ignore` keeps this gate GREEN on these known IDs while STILL failing on any NEW
# advisory. Re-audit and prune this list when the deps are bumped.
IGNORE_IDS=(
  RUSTSEC-2023-0089
  RUSTSEC-2024-0384
  RUSTSEC-2024-0436
  RUSTSEC-2025-0012
  RUSTSEC-2026-0002
  RUSTSEC-2026-0044
  RUSTSEC-2026-0048
  RUSTSEC-2026-0049
  RUSTSEC-2026-0097
  RUSTSEC-2026-0098
  RUSTSEC-2026-0099
  RUSTSEC-2026-0104
  RUSTSEC-2026-0118
  RUSTSEC-2026-0119
  RUSTSEC-2026-0178
  RUSTSEC-2026-0179
  RUSTSEC-2026-0180
)
IGNORE_ARGS=()
for id in "${IGNORE_IDS[@]}"; do
  IGNORE_ARGS+=(--ignore "$id")
done

if ! command -v cargo-audit >/dev/null 2>&1; then
  echo "⚠️  cargo-audit not installed — skipping Rust CVE scan."
  echo "    Install with: cargo install cargo-audit --locked"
  exit 0
fi

FAILED=0
for crate in "${CRATES[@]}"; do
  dir="$REPO_ROOT/$crate"
  if [[ ! -f "$dir/Cargo.lock" ]]; then
    echo "ℹ️  $crate: no Cargo.lock, skipping."
    continue
  fi
  echo "🔎 cargo audit — $crate"
  if ! ( cd "$dir" && cargo audit "${IGNORE_ARGS[@]}" ); then
    echo "❌ $crate: cargo audit reported vulnerabilities."
    FAILED=1
  else
    echo "✅ $crate: clean."
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "❌ Rust CVE scan found advisories — review above."
  exit 1
fi

echo "✅ Rust CVE scan: all crates clean."
exit 0
