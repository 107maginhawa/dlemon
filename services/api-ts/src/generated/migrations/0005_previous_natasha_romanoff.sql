CREATE TYPE "public"."dental_attachment_image_type" AS ENUM('xray', 'photo', 'scan', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."lab_order_status" AS ENUM('ordered', 'inFabrication', 'delivered', 'fitted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."medical_history_entry_type" AS ENUM('condition', 'medication', 'allergy', 'procedure', 'vaccination', 'familyHistory');--> statement-breakpoint
CREATE TABLE "amendment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"original_record_type" text NOT NULL,
	"original_record_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"image_type" "dental_attachment_image_type" NOT NULL,
	"tooth_numbers" jsonb,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "consent_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"template_name" text NOT NULL,
	"signed_at" timestamp,
	"signature_data" text,
	"signed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"lab_name" text NOT NULL,
	"description" text NOT NULL,
	"status" "lab_order_status" DEFAULT 'ordered' NOT NULL,
	"ordered_at" timestamp DEFAULT now() NOT NULL,
	"expected_delivery_date" timestamp,
	"delivered_at" timestamp,
	"fitted_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"is_defective" boolean DEFAULT false NOT NULL,
	"replaced_by_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "medical_history_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"entry_type" "medical_history_entry_type" NOT NULL,
	"code_system" text,
	"code" text,
	"display_name" text NOT NULL,
	"notes" text,
	"onset_date" text,
	"resolved_date" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"prescriber_member_id" uuid NOT NULL,
	"rx_norm_code" text,
	"drug_name" text NOT NULL,
	"dosage" text NOT NULL,
	"frequency" text NOT NULL,
	"duration" text,
	"quantity" text,
	"instructions" text,
	"dispense_as_written" boolean DEFAULT false NOT NULL
);
