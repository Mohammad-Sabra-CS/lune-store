import { desc, eq } from "drizzle-orm";
import { db, hasDatabase } from "@/lib/db";
import { orders, type OrderRow } from "@/lib/db/schema";

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
  locale: "en" | "ar";
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
  status: "new" | "delivered",
): Promise<void> {
  if (hasDatabase()) {
    await db().update(orders).set({ status }).where(eq(orders.id, id));
    return;
  }
  const all = await devRead();
  const target = all.find((o) => o.id === id);
  if (target) {
    target.status = status;
    await devWrite(all);
  }
}
