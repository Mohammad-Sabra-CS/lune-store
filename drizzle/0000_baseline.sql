-- WP0 baseline: schema verified identical to production (2026-08-27, read-only
-- introspection; 10 orders / 4 products / 1 feedback preserved). IF NOT EXISTS
-- makes adoption a guaranteed no-op on the existing production database while
-- still creating the schema on a fresh database. This file is FROZEN once
-- applied anywhere — never edit an applied migration; add a new one.
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"message" text NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(16) NOT NULL,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" varchar(32) NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"delivery_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"payment_method" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"slug" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_price" integer NOT NULL,
	"sale_price" integer,
	"sale_starts_at" timestamp with time zone,
	"sale_ends_at" timestamp with time zone,
	"stock" integer DEFAULT 50 NOT NULL,
	"image" text NOT NULL,
	"gallery" jsonb NOT NULL,
	"poetry" jsonb NOT NULL,
	"character" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
