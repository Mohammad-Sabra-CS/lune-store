import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 16 }).notNull().unique(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  /** [{ slug, name, qty, price }] snapshot at purchase time */
  items: jsonb("items").notNull().$type<
    { slug: string; name: string; qty: number; price: number }[]
  >(),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee").notNull(),
  total: integer("total").notNull(),
  paymentMethod: varchar("payment_method", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("new"),
  locale: varchar("locale", { length: 5 }).notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email"),
  message: text("message").notNull(),
  locale: varchar("locale", { length: 5 }).notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;
export type OrderStatus = "new" | "delivered";
export type FeedbackRow = typeof feedback.$inferSelect;
