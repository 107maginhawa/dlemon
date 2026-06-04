/**
 * Shared PHI sanitizer for the dental audit trail.
 *
 * V-AUD-001 / V-AUD-NEW-A / V-AUD-101 (PHI guard): The audit log is append-only and
 * never deleted (DATA_GOVERNANCE §2/§3), so any PHI written into `metadata` OR the
 * before/after row snapshots is unremediable (AC-AUD-004 / "No PHI in log body" /
 * MODULE_SPEC §5 / HIPAA breach). Strip obvious PII keys before persisting.
 *
 * Matching is case-insensitive against a blocklist. The sanitizer is RECURSIVE so that
 * PHI nested inside row snapshots (objects + arrays) is stripped too — full row
 * snapshots routinely contain nested clinical/demographic objects. It is conservative:
 * only blocklisted keys are removed; structural keys (`id`, `status`, timestamps,
 * counts, codes, flags) are preserved.
 *
 * This lives in a shared module (rather than inside `logAuditEvent`) so that EVERY
 * audit write path is covered at a single choke point — it is invoked from
 * `AuditLogRepository.insert`, so any future caller that writes a row directly
 * (not just `logAuditEvent`) is sanitized regardless of entry point (V-AUD-101).
 *
 * Never throws — sanitization must never break the audit write or the originating
 * request (best-effort).
 */

export const PHI_METADATA_KEYS = new Set([
  // Identity / demographics
  'displayname',
  'firstname',
  'lastname',
  'fullname',
  'name',
  'email',
  'phone',
  'ssn',
  'address',
  'mrn',
  // Date of birth (multiple spellings)
  'dateofbirth',
  'dob',
  'birthdate',
  // Clinical free-text / sensitive
  'diagnosis',
  'medication',
  'medications',
  'notes',
  'chiefcomplaint',
]);

/**
 * Recursively strip blocklisted PHI keys from an arbitrary JSON-ish value. Returns a
 * cloned, sanitized value; mutates nothing. Collects stripped key names (deduped, by
 * leaf key) for best-effort warn logging. Never throws — callers guard with try/catch.
 */
export function sanitizeValueDeep(value: unknown, stripped: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValueDeep(v, stripped));
  }
  if (value != null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (PHI_METADATA_KEYS.has(key.toLowerCase())) {
        stripped.add(key);
        continue;
      }
      clean[key] = sanitizeValueDeep(v, stripped);
    }
    return clean;
  }
  return value;
}

/**
 * Sanitize a single JSONB audit field (metadata / before / after). Returns a cloned,
 * PHI-stripped object, or the original null/undefined for empty fields. Optionally
 * invokes `onStripped` (best-effort, for warn logging) with the stripped key names.
 * Never throws — falls back to dropping the field rather than risk leaking PHI.
 */
export function sanitizeAuditField<T extends Record<string, unknown> | null | undefined>(
  obj: T,
  onStripped?: (strippedKeys: string[]) => void,
): Record<string, unknown> | null {
  if (obj == null || typeof obj !== 'object') {
    return (obj as Record<string, unknown> | null) ?? null;
  }
  try {
    const stripped = new Set<string>();
    const clean = sanitizeValueDeep(obj, stripped) as Record<string, unknown>;
    if (stripped.size > 0) onStripped?.([...stripped]);
    return clean;
  } catch {
    // Sanitization must never throw — drop the field rather than risk leaking PHI
    // or breaking the audit write.
    return null;
  }
}
