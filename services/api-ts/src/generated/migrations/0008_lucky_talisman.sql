CREATE TYPE "public"."dental_invoice_status" AS ENUM('draft', 'issued', 'partial', 'paid', 'overdue', 'voided');--> statement-breakpoint
CREATE TYPE "public"."dental_installment_status" AS ENUM('pending', 'paid', 'overdue', 'waived');--> statement-breakpoint
CREATE TYPE "public"."dental_plan_frequency" AS ENUM('weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."dental_plan_status" AS ENUM('onTrack', 'behind', 'completed', 'defaulted');--> statement-breakpoint
CREATE TYPE "public"."dental_payment_method" AS ENUM('cash', 'card', 'bankTransfer');--> statement-breakpoint
CREATE TABLE "dental_invoice_line_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"invoice_id" uuid NOT NULL,
	"treatment_id" uuid,
	"cdt_code" text,
	"description" text NOT NULL,
	"tooth_number" integer,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount_cents" integer NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"dentist_member_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"status" "dental_invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dental_payment_plan_installment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"plan_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"paid_date" timestamp with time zone,
	"payment_id" uuid,
	"status" "dental_installment_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_payment_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"total_cents" integer NOT NULL,
	"number_of_installments" integer NOT NULL,
	"frequency" "dental_plan_frequency" NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"amount_per_installment_cents" integer NOT NULL,
	"status" "dental_plan_status" DEFAULT 'onTrack' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "dental_payment_method" NOT NULL,
	"receipt_number" text NOT NULL,
	"recorded_by_member_id" uuid NOT NULL,
	"notes" text,
	"is_void" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"voided_by_member_id" uuid
);
--> statement-breakpoint
CREATE INDEX "dental_invoice_line_item_invoice_id_idx" ON "dental_invoice_line_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "dental_invoice_patient_id_idx" ON "dental_invoice" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_invoice_branch_id_idx" ON "dental_invoice" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_invoice_status_idx" ON "dental_invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dental_installment_plan_id_idx" ON "dental_payment_plan_installment" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "dental_payment_plan_invoice_id_idx" ON "dental_payment_plan" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "dental_payment_plan_patient_id_idx" ON "dental_payment_plan" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_payment_invoice_id_idx" ON "dental_payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "dental_payment_patient_id_idx" ON "dental_payment" USING btree ("patient_id");