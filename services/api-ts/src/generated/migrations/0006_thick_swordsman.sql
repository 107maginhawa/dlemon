CREATE TYPE "public"."pmd_document_status" AS ENUM('generated', 'signed', 'superseded');--> statement-breakpoint
CREATE TABLE "imported_pmd" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"source_facility" text NOT NULL,
	"source_reference" text,
	"content" text NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	"safety_floor_merged" text DEFAULT 'false' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pmd_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"status" "pmd_document_status" DEFAULT 'generated' NOT NULL,
	"content" text NOT NULL,
	"signature" text,
	"signed_at" timestamp,
	"supersedes_id" uuid,
	"checksum" text NOT NULL
);
