CREATE TYPE "public"."refresh_schedule" AS ENUM('manual', 'daily', 'weekly');--> statement-breakpoint
CREATE TABLE "data_source" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connector_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" "provider" NOT NULL,
	"config" jsonb NOT NULL,
	"refresh_schedule" "refresh_schedule" DEFAULT 'manual',
	"last_refresh_at" timestamp,
	"row_count" integer,
	"columns" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_connector_id_data_connector_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."data_connector"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source" ADD CONSTRAINT "data_source_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;