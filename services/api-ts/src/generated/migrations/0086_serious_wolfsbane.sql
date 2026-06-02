CREATE TYPE "public"."dental_claim_line_status" AS ENUM('pending', 'covered', 'partial', 'disallowed');--> statement-breakpoint
CREATE TYPE "public"."dental_insurance_claim_status" AS ENUM('draft', 'ready', 'submitted', 'under_review', 'approved', 'partially_paid', 'paid', 'denied', 'appealed', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."dental_submission_channel" AS ENUM('portal', 'email', 'fax', 'in_person', 'other');--> statement-breakpoint
CREATE TYPE "public"."dental_payer_payment_method" AS ENUM('bank_transfer', 'check', 'portal');--> statement-breakpoint
CREATE TYPE "public"."dental_coverage_auth_status" AS ENUM('requested', 'approved', 'partial', 'denied', 'expired');--> statement-breakpoint
CREATE TYPE "public"."dental_payer_type" AS ENUM('hmo', 'philhealth', 'corporate', 'self_pay_assist', 'other');--> statement-breakpoint
CREATE TABLE "dental_insurance_claim_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"claim_id" uuid NOT NULL,
	"treatment_id" uuid,
	"invoice_line_item_id" uuid,
	"cdt_code" text NOT NULL,
	"description" text NOT NULL,
	"billed_amount_cents" integer DEFAULT 0 NOT NULL,
	"approved_amount_cents" integer,
	"paid_amount_cents" integer DEFAULT 0 NOT NULL,
	"status" "dental_claim_line_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_insurance_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"local_id" text,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"last_sync_at" timestamp,
	"conflict_payload" jsonb,
	"patient_id" uuid NOT NULL,
	"insurance_profile_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"invoice_id" uuid,
	"visit_id" uuid,
	"authorization_id" uuid,
	"claim_number" text NOT NULL,
	"payer_reference" text,
	"status" "dental_insurance_claim_status" DEFAULT 'draft' NOT NULL,
	"submission_channel" "dental_submission_channel",
	"billed_amount_cents" integer DEFAULT 0 NOT NULL,
	"approved_amount_cents" integer,
	"paid_by_payer_cents" integer DEFAULT 0 NOT NULL,
	"disallowed_cents" integer,
	"patient_portion_cents" integer DEFAULT 0 NOT NULL,
	"denial_reason" text,
	"submitted_at" timestamp with time zone,
	"decision_at" timestamp with time zone,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dental_payer_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"claim_id" uuid NOT NULL,
	"insurance_profile_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"invoice_id" uuid,
	"amount_cents" integer NOT NULL,
	"remittance_reference" text,
	"remitted_at" date,
	"method" "dental_payer_payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"disallowance_cents" integer,
	"disallowance_reason" text
);
--> statement-breakpoint
CREATE TABLE "dental_coverage_authorization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"local_id" text,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"last_sync_at" timestamp,
	"conflict_payload" jsonb,
	"patient_id" uuid NOT NULL,
	"insurance_profile_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"visit_id" uuid,
	"treatment_plan_id" uuid,
	"loa_number" text,
	"status" "dental_coverage_auth_status" DEFAULT 'requested' NOT NULL,
	"approved_at" date,
	"valid_until" date,
	"approved_amount_cents" integer,
	"covered_procedures" jsonb,
	"attachment_file_id" uuid,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "dental_insurance_profile" ADD COLUMN "payer_type" "dental_payer_type" DEFAULT 'hmo' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_insurance_profile" ADD COLUMN "accredited" boolean;--> statement-breakpoint
ALTER TABLE "dental_insurance_profile" ADD COLUMN "annual_limit_cents" integer;--> statement-breakpoint
ALTER TABLE "dental_insurance_profile" ADD COLUMN "annual_limit_used_cents" integer;--> statement-breakpoint
ALTER TABLE "dental_insurance_claim_line" ADD CONSTRAINT "dental_insurance_claim_line_claim_id_dental_insurance_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."dental_insurance_claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_insurance_claim" ADD CONSTRAINT "dental_insurance_claim_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_insurance_claim" ADD CONSTRAINT "dental_insurance_claim_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_insurance_claim" ADD CONSTRAINT "dental_insurance_claim_invoice_id_dental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."dental_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_payer_payment" ADD CONSTRAINT "dental_payer_payment_claim_id_dental_insurance_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."dental_insurance_claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_payer_payment" ADD CONSTRAINT "dental_payer_payment_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_payer_payment" ADD CONSTRAINT "dental_payer_payment_invoice_id_dental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."dental_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_coverage_authorization" ADD CONSTRAINT "dental_coverage_authorization_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_coverage_authorization" ADD CONSTRAINT "dental_coverage_authorization_insurance_profile_id_dental_insurance_profile_id_fk" FOREIGN KEY ("insurance_profile_id") REFERENCES "public"."dental_insurance_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_coverage_authorization" ADD CONSTRAINT "dental_coverage_authorization_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_line_claim_idx" ON "dental_insurance_claim_line" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_number_idx" ON "dental_insurance_claim" USING btree ("claim_number");--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_patient_idx" ON "dental_insurance_claim" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_branch_idx" ON "dental_insurance_claim" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_status_idx" ON "dental_insurance_claim" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_invoice_idx" ON "dental_insurance_claim" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "dental_insurance_claim_profile_idx" ON "dental_insurance_claim" USING btree ("insurance_profile_id");--> statement-breakpoint
CREATE INDEX "dental_payer_payment_claim_idx" ON "dental_payer_payment" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "dental_payer_payment_branch_idx" ON "dental_payer_payment" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_payer_payment_claim_ref_uniq" ON "dental_payer_payment" USING btree ("claim_id","remittance_reference");--> statement-breakpoint
CREATE INDEX "dental_coverage_auth_patient_idx" ON "dental_coverage_authorization" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_coverage_auth_profile_idx" ON "dental_coverage_authorization" USING btree ("insurance_profile_id");--> statement-breakpoint
CREATE INDEX "dental_coverage_auth_branch_idx" ON "dental_coverage_authorization" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_coverage_auth_status_idx" ON "dental_coverage_authorization" USING btree ("status");