/**
 * Type-safe partial-update payload helpers for PATCH operations.
 *
 * The TypeSpec schema distinguishes "absent" from "explicitly cleared":
 *   - `field?: T`         → optional, can be omitted but never null
 *   - `field?: T | null`  → optional, can be omitted OR explicitly cleared with null
 *
 * `buildPatch` enforces that distinction at the type level so consumers can't
 * accidentally send `null` to a non-nullable field, and lets us forward `null`
 * for fields the user has explicitly cleared without per-call hand-curated
 * "nullable: [...]" lists.
 *
 * Replaces the old `sanitizeObject` helper which restated the schema's
 * nullability information at every call site.
 */

type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/**
 * Per-key value type for a patch input.
 *
 * - `K` is nullable in the schema    → `T[K] | null | undefined`
 * - `K` is not nullable in the schema → non-null `T[K] | undefined`
 *
 * `undefined` always means "omit this field from the wire payload".
 * `null` means "explicitly clear this field" — only allowed when the schema
 * says so; passing `null` to a non-nullable field is a compile error.
 */
type PatchValue<T, K extends keyof T> = K extends NullableKeys<T>
  ? NonNullable<T[K]> | null | undefined
  : NonNullable<T[K]> | undefined;

export type PatchInput<T> = {
  [K in keyof T]?: PatchValue<T, K>;
};

/**
 * Build a PATCH body from a partial input. Strips keys whose value is `undefined`;
 * forwards `null` only on keys whose schema type permits it (enforced by the
 * `PatchInput<T>` type — runtime is unchanged but the call site is type-safe).
 *
 * @example
 * type PersonUpdate = { firstName?: string; lastName?: string | null }
 * buildPatch<PersonUpdate>({ firstName: 'Ada' })
 *   // → { firstName: 'Ada' }
 * buildPatch<PersonUpdate>({ lastName: null })
 *   // → { lastName: null }
 * buildPatch<PersonUpdate>({ firstName: null })
 *   // → compile error (firstName is not nullable)
 */
export function buildPatch<T extends object>(input: PatchInput<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(input) as Array<keyof T>) {
    const v = (input as Partial<T>)[k];
    if (v !== undefined) (out as Record<keyof T, unknown>)[k] = v;
  }
  return out;
}
