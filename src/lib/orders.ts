import { desc, eq } from "drizzle-orm";
import { db, hasDatabase } from "@/lib/db";
import { orders, type OrderRow, type OrderStatus } from "@/lib/db/schema";
import { ARCHIVE_AFTER_DAYS } from "@/lib/constants";
import type { Locale } from "@/i18n/routing";

export interface OrderInput {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  items: { slug: string; name: string; qty: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: "cod" | "card";
  locale: Locale;
}

export type Order = OrderRow;

/**
 * Order storage. Uses Neon Postgres when DATABASE_URL is set;
 * falls back to a local JSON file for development without a database.
 */

const DEV_STORE = ".orders.dev.json";

async function devRead(): Promise<Order[]> {
  const { readFile } = await import("fs/promises");
  try {
    return JSON.parse(await readFile(DEV_STORE, "utf8")) as Order[];
  } catch {
    return [];
  }
}

async function devWrite(all: Order[]): Promise<void> {
  const { writeFile } = await import("fs/promises");
  await writeFile(DEV_STORE, JSON.stringify(all, null, 2), "utf8");
}

export async function createOrder(input: OrderInput): Promise<Order> {
  if (hasDatabase()) {
    const [row] = await db().insert(orders).values(input).returning();
    return row;
  }
  const all = await devRead();
  const row: Order = {
    id: crypto.randomUUID(),
    status: "new",
    createdAt: new Date(),
    deliveredAt: null,
    ...input,
  };
  all.unshift(row);
  await devWrite(all);
  return row;
}

export async function listOrders(): Promise<Order[]> {
  if (hasDatabase()) {
    return db().select().from(orders).orderBy(desc(orders.createdAt));
  }
  return devRead();
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<void> {
  const deliveredAt = status === "delivered" ? new Date() : null;
  if (hasDatabase()) {
    await db().update(orders).set({ status, deliveredAt }).where(eq(orders.id, id));
    return;
  }
  const all = await devRead();
  const target = all.find((o) => o.id === id);
  if (target) {
    target.status = status;
    target.deliveredAt = deliveredAt;
    await devWrite(all);
  }
}

/**
 * Delivered orders auto-archive once deliveredAt is older than
 * ARCHIVE_AFTER_DAYS. Derived at read time — no cron, no extra status.
 * Legacy delivered rows without deliveredAt stay in the active list.
 */
export function isArchived(order: Order, now: Date = new Date()): boolean {
  if (order.status !== "delivered" || !order.deliveredAt) return false;
  const delivered = new Date(order.deliveredAt).getTime();
  return now.getTime() - delivered > ARCHIVE_AFTER_DAYS * 86_400_000;
}

export interface OrderFilters {
  status?: "all" | OrderStatus;
  /** Case-insensitive substring over order number / customer name / phone */
  q?: string;
  /** yyyy-mm-dd, inclusive */
  from?: string;
  /** yyyy-mm-dd, inclusive end of day */
  to?: string;
}

export function filterOrders(list: Order[], f: OrderFilters): Order[] {
  const q = f.q?.trim().toLowerCase();
  const from = f.from ? new Date(`${f.from}T00:00:00`) : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : null;
  return list.filter((o) => {
    if (f.status && f.status !== "all" && o.status !== f.status) return false;
    if (
      q &&
      ![o.orderNumber, o.customerName, o.phone].some((v) =>
        v.toLowerCase().includes(q),
      )
    ) {
      return false;
    }
    const created = new Date(o.createdAt);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
}
