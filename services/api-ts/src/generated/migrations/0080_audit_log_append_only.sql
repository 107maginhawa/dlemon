-- V-AUD-IMM-001 (F4): DB-level append-only enforcement for the authoritative
-- audit trail table `dental_audit_log`.
--
-- Today immutability is app-level only — the repository is insert-only and
-- nothing in code issues an UPDATE/DELETE, but a direct SQL UPDATE/DELETE
-- (compromised credential, errant migration, manual psql) would silently
-- rewrite or erase HIPAA audit history. This trigger denies row-level UPDATE
-- and DELETE at the storage layer (defense-in-depth).
--
-- Scope note: a BEFORE ROW trigger does NOT fire for TRUNCATE (a table-level
-- DDL op), so test/reset paths that TRUNCATE the table to reset state are
-- unaffected. INSERT is likewise unaffected. Only row-level UPDATE/DELETE are
-- denied. Idempotent (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS) so
-- re-running migrations is safe.

CREATE OR REPLACE FUNCTION dental_audit_log_deny_mutate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'dental_audit_log is append-only: % is not permitted (V-AUD-IMM-001)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS dental_audit_log_append_only ON dental_audit_log;--> statement-breakpoint

CREATE TRIGGER dental_audit_log_append_only
  BEFORE UPDATE OR DELETE ON dental_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION dental_audit_log_deny_mutate();
