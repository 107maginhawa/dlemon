ALTER TYPE "public"."notification_channel" ADD VALUE 'sms';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'appointment.reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'appointment.confirmation-request';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'recall.due';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'recall.reminder';--> statement-breakpoint
ALTER TABLE "dental_recall" ADD COLUMN "interval_months" integer;--> statement-breakpoint
ALTER TABLE "dental_recall" ADD COLUMN "last_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "dental_recall" ADD COLUMN "send_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD COLUMN "confirmed_via" text;--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD COLUMN "confirmation_token" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_appointment_confirmation_token_unique" ON "dental_appointment" USING btree ("confirmation_token") WHERE "dental_appointment"."confirmation_token" IS NOT NULL;