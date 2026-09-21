"use server";

import { after } from "next/server";
import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  getStoreProductsFresh,
  decrementStock,
  restoreStock,
} from "@/lib/products";
import { effectivePrice, isSoldOut } from "@/lib/pricing";
import { DELIVERY_FEE, MAX_QTY_PER_ITEM } from "@/lib/constants";
import {
  ADDRESS_MAX,
  ADDRESS_MIN,
  CITY_MAX,
  CITY_MIN,
  EMAIL_MAX,
  EMAIL_RE,
  NAME_MAX,
  NAME_MIN,
  PHONE_RE,
} from "@/lib/checkout-validation";
import { routing } from "@/i18n/routing";
import { createOrder } from "@/lib/orders";
import { sendReceiptEmail } from "@/lib/email/receipt";

const checkoutSchema = z.object({
  name: z.string().trim().min(NAME_MIN).max(NAME_MAX),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX)
    .refine((value) => value === "" || EMAIL_RE.test(value)),
  expectedTotal: z.number().int().min(1),
  phone: z.string().trim().regex(PHONE_RE),
  city: z.string().trim().min(CITY_MIN).max(CITY_MAX),
  address: z.string().trim().min(ADDRESS_MIN).max(ADDRESS_MAX),
  paymentMethod: z.literal("cod"), // card is not accepted until a gateway is wired
  locale: z.enum(routing.locales),
  items: z
    .array(
      z.object({
        slug: z.string(),
        qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
      }),
    )
    .min(1)
    .max(10)
    .refine((items) => new Set(items.map((i) => i.slug)).size === items.length),
});

export interface CheckoutResult {
  ok: boolean;
  orderNumber?: string;
  error?: "validation" | "server" | "soldOut" | "priceChanged";
}

function generateOrderNumber(): string {
  return `L-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function placeOrder(payload: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }
  const data = parsed.data;

  // Price everything server-side — never trust client totals
  try {
    const storeProducts = await getStoreProductsFresh();
    const items: { slug: string; name: string; qty: number; price: number }[] =
      [];
    for (const item of data.items) {
      const product = storeProducts.find((p) => p.slug === item.slug);
      if (!product) return { ok: false, error: "validation" };
      if (isSoldOut(product) || item.qty > product.stock) {
        return { ok: false, error: "soldOut" };
      }
      items.push({
        slug: product.slug,
        name: product.name,
        qty: item.qty,
        price: effectivePrice(product).price,
      });
    }
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const total = subtotal + DELIVERY_FEE;
    if (total !== data.expectedTotal) {
      revalidateTag("products", { expire: 0 });
      return { ok: false, error: "priceChanged" };
    }

    // Reserve stock before recording the order (conditional decrement)
    const stockItems = items.map((i) => ({ slug: i.slug, qty: i.qty }));
    const dec = await decrementStock(stockItems);
    if (!dec.ok) {
      return { ok: false, error: "soldOut" };
    }

    const orderInput = {
      orderNumber: generateOrderNumber(),
      customerName: data.name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      address: data.address,
      items,
      subtotal,
      deliveryFee: DELIVERY_FEE,
      total,
      paymentMethod: data.paymentMethod,
      locale: data.locale,
    };

    let order;
    try {
      order = await createOrder(orderInput);
    } catch {
      console.error("[checkout] failed to store order");
      await restoreStock(stockItems);
      return { ok: false, error: "server" };
    }
    // Once stored, ancillary failures must never restore stock or invite a retry.
    try {
      revalidateTag("products", "max");
      after(async () => {
        try {
          await sendReceiptEmail(orderInput);
        } catch {
          console.error("[email] receipt delivery failed");
        }
      });
    } catch {
      console.error("[checkout] post-order notification failed");
    }
    return { ok: true, orderNumber: order.orderNumber };
  } catch {
    console.error("[checkout] catalog or stock unavailable");
    return { ok: false, error: "server" };
  }
}
