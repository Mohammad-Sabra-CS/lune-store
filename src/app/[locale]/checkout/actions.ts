"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getStoreProductsFresh, decrementStock, restoreStock } from "@/lib/products";
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
  email: z.string().trim().regex(EMAIL_RE).max(EMAIL_MAX),
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
    .max(10),
});

export interface CheckoutResult {
  ok: boolean;
  orderNumber?: string;
  error?: "validation" | "server" | "soldOut";
}

function generateOrderNumber(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `L-${suffix}`;
}

export async function placeOrder(payload: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "validation" };
  }
  const data = parsed.data;

  // Price everything server-side — never trust client totals
  const storeProducts = await getStoreProductsFresh();
  const items: { slug: string; name: string; qty: number; price: number }[] = [];
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

  try {
    const order = await createOrder(orderInput);
    await sendReceiptEmail(orderInput);
    revalidateTag("products", "max"); // storefront picks up the new stock levels
    return { ok: true, orderNumber: order.orderNumber };
  } catch (err) {
    console.error("[checkout] failed to store order:", err);
    await restoreStock(stockItems); // best-effort compensation
    return { ok: false, error: "server" };
  }
}
