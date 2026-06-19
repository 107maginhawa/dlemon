CREATE TABLE "dental_collection_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"invoice_id" uuid,
	"note" text NOT NULL,
	"contact_channel" text NOT NULL,
	"contacted_at" timestamp with time zone NOT NULL,
	"created_by_member_id" uuid
);
--> statement-breakpoint
ALTER TABLE "dental_collection_note" ADD CONSTRAINT "dental_collection_note_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_collection_note" ADD CONSTRAINT "dental_collection_note_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_collection_note" ADD CONSTRAINT "dental_collection_note_invoice_id_dental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."dental_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_collection_note_patient_idx" ON "dental_collection_note" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_collection_note_branch_idx" ON "dental_collection_note" USING btree ("branch_id");