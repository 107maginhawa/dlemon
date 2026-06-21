-- Custom SQL migration file, put your code below! --

-- RLS P6 — arm dental_perio_tooth_reading (chart-anchored perio PHI).
--
-- dental_perio_tooth_reading holds the most sensitive perio data (per-site probing
-- depths, BOP, CAL/gingival-margin) but carried NO RLS policy, while its parent
-- dental_perio_chart (direct branch_id) and ~20 sibling clinical tables ARE armed
-- (0105/0106/0107). It was also absent from check-rls-posture.ts, so the gate was
-- blind to the hole. This migration closes both: ENABLE + FORCE RLS and install an
-- EXISTS-subquery policy keyed through the parent chart's branch_id:
--
--   EXISTS (SELECT 1 FROM dental_perio_chart c
--           WHERE c.id = dental_perio_tooth_reading.chart_id
--             AND c.branch_id = ANY (app_current_branches()))
--
-- dental_perio_chart is itself RLS-armed (0105), so under app_rls the subquery is
-- also subject to the chart's own policy — both filters key off the same branch set,
-- so they compose consistently (no false visibility, no recursion). With an unset/
-- empty branch set, app_current_branches() is the empty array → EXISTS is false →
-- ZERO rows (fail-closed), the same contract as the visit-anchored Tier-2a tables.
-- The superuser (production write path today) bypasses RLS entirely → zero runtime
-- change.

ALTER TABLE "dental_perio_tooth_reading" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_perio_tooth_reading_tenant_isolation" ON "dental_perio_tooth_reading"
  USING (EXISTS (SELECT 1 FROM dental_perio_chart c WHERE c.id = dental_perio_tooth_reading.chart_id AND c.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_perio_chart c WHERE c.id = dental_perio_tooth_reading.chart_id AND c.branch_id = ANY (app_current_branches())));--> statement-breakpoint
