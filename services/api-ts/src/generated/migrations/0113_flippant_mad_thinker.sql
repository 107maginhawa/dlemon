CREATE TABLE "dental_payment_refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"booked_as_credit" boolean DEFAULT false NOT NULL,
	"refunded_by_member_id" uuid
);
--> statement-breakpoint
ALTER TABLE "dental_payment_refund" ADD CONSTRAINT "dental_payment_refund_payment_id_dental_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."dental_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_payment_refund" ADD CONSTRAINT "dental_payment_refund_invoice_id_dental_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."dental_invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_payment_refund" ADD CONSTRAINT "dental_payment_refund_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_payment_refund" ADD CONSTRAINT "dental_payment_refund_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_payment_refund_payment_idx" ON "dental_payment_refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "dental_payment_refund_invoice_idx" ON "dental_payment_refund" USING btree ("invoice_id");