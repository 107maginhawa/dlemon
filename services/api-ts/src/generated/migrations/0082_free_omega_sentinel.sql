CREATE TYPE "public"."controlled_substance_schedule" AS ENUM('none', 'II', 'III', 'IV', 'V');--> statement-breakpoint
CREATE TYPE "public"."dental_treatment_phase" AS ENUM('systemic', 'disease_control', 're_evaluation', 'definitive', 'maintenance');--> statement-breakpoint
ALTER TYPE "public"."appointment_status" ADD VALUE 'confirmed' BEFORE 'checked_in';--> statement-breakpoint
CREATE TABLE "dental_feature_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"feature" text NOT NULL,
	"allowed" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_household_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"household_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"relationship" text DEFAULT 'dependent' NOT NULL,
	"is_guarantor" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_household" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"guarantor_patient_id" uuid NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dental_waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"preferred_provider_id" uuid,
	"visit_type" text,
	"urgency" text DEFAULT 'routine' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"promoted_appointment_id" uuid,
	"scheduled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "prescription" ADD COLUMN "controlled_substance_schedule" "controlled_substance_schedule" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "prescription" ADD COLUMN "prescriber_dea" text;--> statement-breakpoint
ALTER TABLE "prescription" ADD COLUMN "prescriber_npi" text;--> statement-breakpoint
ALTER TABLE "dental_membership" ADD COLUMN "license_number" text;--> statement-breakpoint
ALTER TABLE "dental_membership" ADD COLUMN "npi" text;--> statement-breakpoint
ALTER TABLE "dental_membership" ADD COLUMN "credential_type" text;--> statement-breakpoint
ALTER TABLE "dental_membership" ADD COLUMN "license_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "phase" "dental_treatment_phase";--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_feature_permission" ADD CONSTRAINT "dental_feature_permission_organization_id_dental_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dental_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_household_member" ADD CONSTRAINT "dental_household_member_household_id_dental_household_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."dental_household"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_household_member" ADD CONSTRAINT "dental_household_member_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_waitlist_entry" ADD CONSTRAINT "dental_waitlist_entry_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_waitlist_entry" ADD CONSTRAINT "dental_waitlist_entry_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_waitlist_entry" ADD CONSTRAINT "dental_waitlist_entry_preferred_provider_id_dental_membership_id_fk" FOREIGN KEY ("preferred_provider_id") REFERENCES "public"."dental_membership"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_waitlist_entry" ADD CONSTRAINT "dental_waitlist_entry_promoted_appointment_id_dental_appointment_id_fk" FOREIGN KEY ("promoted_appointment_id") REFERENCES "public"."dental_appointment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_feature_permission_org_role_feature_unique" ON "dental_feature_permission" USING btree ("organization_id","role","feature");--> statement-breakpoint
CREATE INDEX "dental_household_member_household_idx" ON "dental_household_member" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "dental_household_member_patient_idx" ON "dental_household_member" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_household_member_patient_uniq" ON "dental_household_member" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_household_branch_idx" ON "dental_household" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_household_guarantor_idx" ON "dental_household" USING btree ("guarantor_patient_id");--> statement-breakpoint
CREATE INDEX "dental_waitlist_entry_branch_id_idx" ON "dental_waitlist_entry" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_waitlist_entry_status_idx" ON "dental_waitlist_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dental_waitlist_entry_patient_id_idx" ON "dental_waitlist_entry" USING btree ("patient_id");