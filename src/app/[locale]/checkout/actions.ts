"use server";

import { z } from "zod";
import { getProduct } from "@/data/products";
import { DELIVERY_FEE } from "@/lib/constants";
import { createOrder } from "@/lib/orders";
import { sendReceiptEmail } from "@/lib/email/receipt";

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,15}$/),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(4).max(300),
  paymentMethod: z.literal("cod"), // card is not accepted until a gateway is wired
  locale: z.enum(["en", "ar"]),
  items: z
    .array(z.object({ slug: z.string(), qty: z.number().int().min(1).max(20) }))
    .min(1)
    .max(10),
});

export interface CheckoutResult {
  ok: boolean;
  orderNumber?: string;
  error?: "validation" | "server";
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
  const items: { slug: string; name: string; qty: number; price: number }[] = [];
  for (const item of data.items) {
    const product = getProduct(item.slug);
    if (!product) return { ok: false, error: "validation" };
    items.push({
      slug: product.slug,
      name: product.name,
      qty: item.qty,
      price: product.price,
    });
  }
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = subtotal + DELIVERY_FEE;

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
    return { ok: true, orderNumber: order.orderNumber };
  } catch (err) {
    console.error("[checkout] failed to store order:", err);
    return { ok: false, error: "server" };
  }
}
