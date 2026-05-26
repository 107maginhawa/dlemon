-- GAP-003: Rename TreatmentPlan status 'in_progress' → 'partially_completed' (IDEAL §3.6)
-- The column type is text (not enum), so only existing rows need updating.
UPDATE dental_treatment_plan SET status = 'partially_completed' WHERE status = 'in_progress';
