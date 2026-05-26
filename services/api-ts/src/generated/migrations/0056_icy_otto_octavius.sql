ALTER TABLE "dental_invoice" ADD COLUMN "local_id" text;--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "sync_status" text DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "conflict_payload" jsonb;--> statement-breakpoint
ALTER TABLE "dental_chart" ADD COLUMN "local_id" text;--> statement-breakpoint
ALTER TABLE "dental_chart" ADD COLUMN "sync_status" text DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_chart" ADD COLUMN "last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "dental_chart" ADD COLUMN "conflict_payload" jsonb;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "local_id" text;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "sync_status" text DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "conflict_payload" jsonb;--> statement-breakpoint
ALTER TABLE "dental_visit" ADD COLUMN "local_id" text;--> statement-breakpoint
ALTER TABLE "dental_visit" ADD COLUMN "sync_status" text DEFAULT 'synced' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_visit" ADD COLUMN "last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "dental_visit" ADD COLUMN "conflict_payload" jsonb;