import { and, eq, gte, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db, hasDatabase } from "@/lib/db";
import {
  products as productsTable,
  type NewProductRow,
  type ProductRow,
} from "@/lib/db/schema";
import { products as staticProducts, type Product } from "@/data/products";
import { DEFAULT_STOCK, PACKAGE_PRICE } from "@/lib/constants";

/**
 * Product storage — the editable half of a product (price, sale, stock,
 * images, copy). Identity fields (audience, phase, accent) live in
 * src/data/products.ts; rows are seeded from there on first read.
 *
 * Uses Neon Postgres when DATABASE_URL is set; falls back to a local JSON
 * file for development without a database (mirrors src/lib/orders.ts).
 */

/** Static product merged with its editable row. `price` is the base price. */
export interface StoreProduct extends Product {
  salePrice: number | null;
  /** ISO strings so the object survives RSC → client serialization */
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  stock: number;
}

const DEV_STORE = ".products.dev.json";

/** Dev-store shape: ProductRow with dates as ISO strings */
type DevRow = Omit<ProductRow, "saleStartsAt" | "saleEndsAt" | "updatedAt"> & {
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  updatedAt: string;
};

function defaultRow(p: Product): NewProductRow {
  return {
    slug: p.slug,
    name: p.name,
    basePrice: PACKAGE_PRICE,
    salePrice: null,
    saleStartsAt: null,
    saleEndsAt: null,
    stock: DEFAULT_STOCK,
    image: p.image,
    gallery: p.gallery,
    poetry: p.poetry,
    character: p.character,
    description: p.description,
  };
}

async function devRead(): Promise<DevRow[]> {
  const { readFile } = await import("fs/promises");
  try {
    return JSON.parse(await readFile(DEV_STORE, "utf8")) as DevRow[];
  } catch {
    return [];
  }
}

async function devWrite(all: DevRow[]): Promise<void> {
  const { writeFile } = await import("fs/promises");
  await writeFile(DEV_STORE, JSON.stringify(all, null, 2), "utf8");
}

function devDefaultRow(p: Product): DevRow {
  return {
    ...defaultRow(p),
    salePrice: null,
    saleStartsAt: null,
    saleEndsAt: null,
    stock: DEFAULT_STOCK,
    updatedAt: new Date().toISOString(),
  };
}

/** Insert rows for any static product that has no row yet. Idempotent and
 *  race-safe (concurrent build workers may seed simultaneously). */
async function ensureSeeded(): Promise<void> {
  if (hasDatabase()) {
    await db()
      .insert(productsTable)
      .values(staticProducts.map(defaultRow))
      .onConflictDoNothing();
    return;
  }
  const all = await devRead();
  const have = new Set(all.map((r) => r.slug));
  const missing = staticProducts.filter((p) => !have.has(p.slug));
  if (missing.length > 0) {
    await devWrite([...all, ...missing.map(devDefaultRow)]);
  }
}

function toIso(value: Date | string | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

/** Rows in static-catalog order (drives shop grid + home chapter order) */
export async function listProductRows(): Promise<(ProductRow | DevRow)[]> {
  await ensureSeeded();
  const rows = hasDatabase()
    ? await db().select().from(productsTable)
    : await devRead();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return staticProducts
    .map((p) => bySlug.get(p.slug))
    .filter((r): r is ProductRow | DevRow => r != null);
}

function merge(p: Product, row: ProductRow | DevRow): StoreProduct {
  return {
    ...p,
    name: row.name,
    price: row.basePrice,
    image: row.image,
    gallery: row.gallery,
    poetry: row.poetry,
    character: row.character,
    description: row.description,
    salePrice: row.salePrice,
    saleStartsAt: toIso(row.saleStartsAt),
    saleEndsAt: toIso(row.saleEndsAt),
    stock: row.stock,
  };
}

async function loadStoreProducts(): Promise<StoreProduct[]> {
  const rows = await listProductRows();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return staticProducts.flatMap((p) => {
    const row = bySlug.get(p.slug);
    return row ? [merge(p, row)] : [];
  });
}

/**
 * Cached storefront read — invalidated with revalidateTag("products") by
 * every admin product mutation and by checkout after a stock change.
 */
export const getStoreProducts = unstable_cache(
  loadStoreProducts,
  ["store-products"],
  { tags: ["products"] },
);

/** Uncached read — checkout (authoritative pricing/stock) and admin pages */
export async function getStoreProductsFresh(): Promise<StoreProduct[]> {
  return loadStoreProducts();
}

async function updateRow(
  slug: string,
  patch: Partial<Omit<NewProductRow, "slug">>,
): Promise<void> {
  await ensureSeeded();
  if (hasDatabase()) {
    await db()
      .update(productsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(productsTable.slug, slug));
    return;
  }
  const all = await devRead();
  const target = all.find((r) => r.slug === slug);
  if (target) {
    Object.assign(target, {
      ...patch,
      saleStartsAt:
        "saleStartsAt" in patch ? toIso(patch.saleStartsAt ?? null) : target.saleStartsAt,
      saleEndsAt:
        "saleEndsAt" in patch ? toIso(patch.saleEndsAt ?? null) : target.saleEndsAt,
      updatedAt: new Date().toISOString(),
    });
    await devWrite(all);
  }
}

export async function updateProductDetails(
  slug: string,
  patch: {
    name: string;
    poetry: Record<"en" | "ar", string>;
    character: Record<"en" | "ar", string>;
    description: Record<"en" | "ar", string>;
  },
): Promise<void> {
  await updateRow(slug, patch);
}

export async function updateProductPricing(
  slug: string,
  patch: {
    basePrice: number;
    salePrice: number | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
  },
): Promise<void> {
  await updateRow(slug, patch);
}

export async function updateProductStock(slug: string, stock: number): Promise<void> {
  await updateRow(slug, { stock });
}

export async function updateProductImages(
  slug: string,
  patch: { image?: string; gallery?: string[] },
): Promise<void> {
  await updateRow(slug, patch);
}

/**
 * Atomically-ish decrement stock for an order's items.
 * DB path: conditional UPDATE per item (stock >= qty); on partial failure the
 * already-decremented items are best-effort restored. neon-http has no
 * transactions — an accepted micro-race for a 4-product COD shop.
 */
export async function decrementStock(
  items: { slug: string; qty: number }[],
): Promise<{ ok: true } | { ok: false; soldOut: string[] }> {
  await ensureSeeded();
  if (hasDatabase()) {
    const done: { slug: string; qty: number }[] = [];
    for (const item of items) {
      const res = await db()
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${item.qty}` })
        .where(
          and(eq(productsTable.slug, item.slug), gte(productsTable.stock, item.qty)),
        )
        .returning({ slug: productsTable.slug });
      if (res.length === 0) {
        await restoreStock(done);
        return { ok: false, soldOut: [item.slug] };
      }
      done.push(item);
    }
    return { ok: true };
  }
  const all = await devRead();
  const soldOut = items
    .filter((item) => {
      const row = all.find((r) => r.slug === item.slug);
      return !row || row.stock < item.qty;
    })
    .map((i) => i.slug);
  if (soldOut.length > 0) return { ok: false, soldOut };
  for (const item of items) {
    const row = all.find((r) => r.slug === item.slug);
    if (row) row.stock -= item.qty;
  }
  await devWrite(all);
  return { ok: true };
}

/** Best-effort compensation when order creation fails after a decrement */
export async function restoreStock(
  items: { slug: string; qty: number }[],
): Promise<void> {
  try {
    if (hasDatabase()) {
      for (const item of items) {
        await db()
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${item.qty}` })
          .where(eq(productsTable.slug, item.slug));
      }
      return;
    }
    const all = await devRead();
    for (const item of items) {
      const row = all.find((r) => r.slug === item.slug);
      if (row) row.stock += item.qty;
    }
    await devWrite(all);
  } catch (err) {
    console.error("[products] failed to restore stock:", err);
  }
}
