CREATE TYPE "public"."dental_invoice_kind" AS ENUM('standard', 'deposit');--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "kind" "dental_invoice_kind" DEFAULT 'standard' NOT NULL;--> statement-breakpoint

-- RLS arming for the deposit/credit money path (billing-audit §g, expert-review
-- F-05). Both tables carry PHI + money and were previously UNARMED. Branch-scoped
-- policy, mirroring the Tier-1 pattern in 0105 (branch_id = ANY(app_current_branches())).
-- Zero runtime change for handlers running as the postgres superuser (bypass);
-- the second wall is live only for code entering the app_rls role via withTenantTx.
-- WRITES in applyCreditToInvoice/refundDentalPayment run on `tx` with branch_id =
-- the invoice/payment branch (in scope). The patient-GLOBAL wallet READS
-- (getBalance/listByPatient) run on `db` (superuser) so the cross-branch sum is
-- preserved (F-02); only writes are subject to the branch policy.
ALTER TABLE "dental_patient_credit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_patient_credit" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_patient_credit_tenant_isolation" ON "dental_patient_credit"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_payment_refund" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_payment_refund" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_payment_refund_tenant_isolation" ON "dental_payment_refund"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));