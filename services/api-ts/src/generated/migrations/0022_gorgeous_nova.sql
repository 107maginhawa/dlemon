ALTER TABLE "imaging_finding" ALTER COLUMN "visit_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "imaging_finding_patient_idx" ON "imaging_finding" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "imaging_finding_branch_idx" ON "imaging_finding" USING btree ("branch_id");