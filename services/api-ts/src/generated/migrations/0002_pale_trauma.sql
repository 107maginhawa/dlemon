CREATE TYPE "public"."member_role" AS ENUM('dentist_owner', 'dentist_associate', 'staff_full', 'staff_scheduling');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."org_tier" AS ENUM('solo', 'clinic', 'group', 'enterprise');--> statement-breakpoint
CREATE TABLE "dental_branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"timezone" text NOT NULL,
	"working_hours" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"person_id" uuid,
	"display_name" text NOT NULL,
	"role" "member_role" NOT NULL,
	"pin_hash" text,
	"pin_locked_until" timestamp,
	"pin_failed_attempts" integer DEFAULT 0 NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"avatar_url" text
);
--> statement-breakpoint
CREATE TABLE "dental_organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"name" text NOT NULL,
	"tier" "org_tier" NOT NULL,
	"owner_person_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dental_branch" ADD CONSTRAINT "dental_branch_organization_id_dental_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."dental_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_membership" ADD CONSTRAINT "dental_membership_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_membership_person_branch_unique" ON "dental_membership" USING btree ("person_id","branch_id") WHERE "dental_membership"."person_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_org_name_owner_unique" ON "dental_organization" USING btree ("name","owner_person_id");