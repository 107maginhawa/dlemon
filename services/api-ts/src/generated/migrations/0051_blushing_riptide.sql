CREATE TABLE "dental_claim_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"insurance_profile_id" uuid NOT NULL,
	"visit_id" uuid,
	"cdt_code" text NOT NULL,
	"icd_10_code" text,
	"diagnosis_description" text,
	"fee_amount_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dental_insurance_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"insurer_name" text NOT NULL,
	"policy_number" text NOT NULL,
	"group_number" text,
	"subscriber_name" text NOT NULL,
	"subscriber_dob" date,
	"relationship" text DEFAULT 'self' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "dental_claim_draft" ADD CONSTRAINT "dental_claim_draft_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_claim_draft" ADD CONSTRAINT "dental_claim_draft_insurance_profile_id_dental_insurance_profile_id_fk" FOREIGN KEY ("insurance_profile_id") REFERENCES "public"."dental_insurance_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_insurance_profile" ADD CONSTRAINT "dental_insurance_profile_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_claim_draft_patient_idx" ON "dental_claim_draft" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_claim_draft_status_idx" ON "dental_claim_draft" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dental_claim_draft_insurance_idx" ON "dental_claim_draft" USING btree ("insurance_profile_id");--> statement-breakpoint
CREATE INDEX "dental_insurance_profile_patient_idx" ON "dental_insurance_profile" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_insurance_profile_active_idx" ON "dental_insurance_profile" USING btree ("active");