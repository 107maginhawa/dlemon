DROP INDEX "dental_payment_plan_invoice_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "dental_payment_plan_invoice_id_unique" ON "dental_payment_plan" USING btree ("invoice_id");