CREATE TABLE "dental_queue_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"called_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "dental_queue_item" ADD CONSTRAINT "dental_queue_item_appointment_id_dental_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."dental_appointment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_queue_item" ADD CONSTRAINT "dental_queue_item_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_queue_item" ADD CONSTRAINT "dental_queue_item_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_queue_item_branch_id_idx" ON "dental_queue_item" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_queue_item_status_idx" ON "dental_queue_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dental_queue_item_appointment_id_idx" ON "dental_queue_item" USING btree ("appointment_id");