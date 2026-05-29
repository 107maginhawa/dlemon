ALTER TABLE "consent_form" ADD COLUMN "revoked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "revoked_by" uuid;