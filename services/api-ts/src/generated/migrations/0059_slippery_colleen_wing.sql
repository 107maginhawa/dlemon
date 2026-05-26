ALTER TABLE "dental_audit" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
CREATE INDEX "dental_audit_branch_timestamp_idx" ON "dental_audit" USING btree ("branch_id","timestamp");