-- P1-25 (online booking) — storage-layer double-booking backstop.
--
-- The application path prevents double-booking via short-TTL holds + a
-- transactional final overlap re-check. This EXCLUDE constraint is the
-- LOAD-BEARING last line of defense: even if two commits interleave (or a future
-- concurrency bug slips through), Postgres makes a true overlap impossible for a
-- given provider across active appointment statuses. The application 409
-- (SLOT_TAKEN) is the friendly path; this constraint guarantees correctness.
--
-- Why a maintained `scheduled_end` column instead of computing the range inline:
-- `timestamptz + interval` is only STABLE (its textual rendering depends on the
-- session TimeZone), so Postgres refuses it inside an index/exclusion expression
-- ("functions in index expression must be marked IMMUTABLE"). A plain
-- `tstzrange(timestamptz, timestamptz)` over two stored columns IS immutable, so
-- we maintain `scheduled_end` via a trigger and build the range from it.
--
-- Scope: only active ('scheduled' | 'confirmed' | 'checked_in') rows participate
-- (cancelled / no_show / completed never block a new booking). The half-open
-- range [scheduled_at, scheduled_end) means back-to-back slots do NOT conflict.
--
-- Source scope: only source='online' rows participate. Staff-created appointments
-- are INTENTIONALLY allowed to overlap (FR3.7: staff may deliberately double-book a
-- dentist and receive a soft DOUBLE_BOOKING warning, never a hard reject). This
-- matches createOnlineBooking's documented contract ("Double-booking is HARD blocked,
-- unlike staff"): the public self-service path enforces no-overlap via the app-level
-- transactional re-check (findOverlapping, which already inspects ALL active
-- appointments regardless of source — so online-vs-staff is caught there), and this
-- constraint is the storage backstop for the realistic online-vs-online race where two
-- public requests grab the same provider slot concurrently.
--
-- Requires btree_gist so the equality on provider combines with the range
-- overlap (&&) in a single GiST exclusion. Idempotent so re-running is safe.

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

ALTER TABLE "dental_appointment"
  ADD COLUMN IF NOT EXISTS "scheduled_end" timestamptz;--> statement-breakpoint

UPDATE "dental_appointment"
  SET "scheduled_end" = "scheduled_at" + ("duration_minutes" * interval '1 minute')
  WHERE "scheduled_end" IS NULL;--> statement-breakpoint

CREATE OR REPLACE FUNCTION dental_appointment_set_scheduled_end() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.scheduled_end := NEW.scheduled_at + (NEW.duration_minutes * interval '1 minute');
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS dental_appointment_scheduled_end_trg ON "dental_appointment";--> statement-breakpoint

CREATE TRIGGER dental_appointment_scheduled_end_trg
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes ON "dental_appointment"
  FOR EACH ROW
  EXECUTE FUNCTION dental_appointment_set_scheduled_end();--> statement-breakpoint

ALTER TABLE "dental_appointment"
  DROP CONSTRAINT IF EXISTS "dental_appointment_no_overlap";--> statement-breakpoint

ALTER TABLE "dental_appointment"
  ADD CONSTRAINT "dental_appointment_no_overlap"
  EXCLUDE USING gist (
    "dentist_member_id" WITH =,
    tstzrange("scheduled_at", "scheduled_end", '[)') WITH &&
  )
  -- Express the active-status filter by EXCLUDING the terminal statuses rather than
  -- listing the active ones. The active set is {scheduled, confirmed, checked_in};
  -- 'confirmed' was added to the enum in migration 0082, and Postgres forbids
  -- referencing a freshly-added enum value in the same transaction (55P04 "unsafe use
  -- of new value of enum type") — which is exactly what drizzle-orm's single-transaction
  -- migrator does on a fresh DB. The terminal statuses {cancelled, no_show, completed}
  -- all predate 0082, so the inverse predicate references only committed enum values and
  -- remains IMMUTABLE (enum→text casts are only STABLE and are rejected here). status is
  -- NOT NULL, so NOT IN is exactly the complement of the active set.
  WHERE (
    source = 'online'
    AND status NOT IN ('cancelled', 'no_show', 'completed')
    AND "scheduled_end" IS NOT NULL
  );
