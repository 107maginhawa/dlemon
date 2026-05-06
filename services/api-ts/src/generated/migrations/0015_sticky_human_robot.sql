CREATE TABLE "practitioner_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"practitioner_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"practitioner_ref" jsonb NOT NULL,
	"organization_ref" jsonb NOT NULL,
	"code" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specialty" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"location" jsonb,
	"healthcare_service" jsonb,
	"telecom" jsonb,
	"available_time" jsonb,
	"not_available" jsonb,
	"deactivated_at" timestamp,
	"tenant_id" varchar(255) DEFAULT 'default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"provider_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"name" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"telecom" jsonb,
	"address" jsonb,
	"gender" varchar(20),
	"birth_date" varchar(10),
	"photo" jsonb,
	"qualification" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credential" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb,
	"deactivated_at" timestamp,
	"tenant_id" varchar(255) DEFAULT 'default' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "practitioner_roles" ADD CONSTRAINT "practitioner_roles_practitioner_id_practitioners_id_fk" FOREIGN KEY ("practitioner_id") REFERENCES "public"."practitioners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_provider_id_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practitioner_roles_practitioner_id_idx" ON "practitioner_roles" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "practitioner_roles_active_idx" ON "practitioner_roles" USING btree ("active");--> statement-breakpoint
CREATE INDEX "practitioner_roles_tenant_id_idx" ON "practitioner_roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "practitioners_provider_id_idx" ON "practitioners" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "practitioners_active_idx" ON "practitioners" USING btree ("active");--> statement-breakpoint
CREATE INDEX "practitioners_tenant_id_idx" ON "practitioners" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_invoice_number_uniq" ON "dental_invoice" USING btree ("invoice_number");