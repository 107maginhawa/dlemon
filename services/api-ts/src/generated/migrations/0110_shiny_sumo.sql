CREATE TABLE "dental_billing_reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"invoice_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"offset_day" integer NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dental_billing_reminder_log" ADD CONSTRAINT "dental_billing_reminder_log_invoice_id_dental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."dental_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_billing_reminder_log" ADD CONSTRAINT "dental_billing_reminder_log_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_billing_reminder_log_invoice_offset_unique" ON "dental_billing_reminder_log" USING btree ("invoice_id","offset_day");--> statement-breakpoint
CREATE INDEX "dental_billing_reminder_log_branch_idx" ON "dental_billing_reminder_log" USING btree ("branch_id");