import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCart } from "../src/lib/cart-storage";
import {
  resolveProductImage,
  resolveProductGallery,
} from "../src/lib/product-media";
import { buildReceiptHtml } from "../src/lib/email/receipt";
import { effectivePrice } from "../src/lib/pricing";
import type { OrderInput } from "../src/lib/orders";
import { resolveApprovedCopy } from "../src/data/approved-copy";

const max = (slug: string) =>
  slug === "apollo" ? 3 : slug === "orion" ? 20 : 0;

test("approved descriptions preserve each locale's custom admin edits", () => {
  const copy = { en: "Custom brand description", ar: "ثقيل · رسمي · شتوي" };
  const updated = resolveApprovedCopy("apollo", "character", copy);
  assert.equal(updated.en, copy.en);
  assert.equal(updated.ar, "دافئ · حلو · شرقي");
  assert.deepEqual(resolveApprovedCopy("elysia", "character", copy), copy);
});

test("untrusted cart ignores malformed data, merges duplicate slugs, and caps stock", () => {
  assert.deepEqual(
    normalizeCart(
      [
        null,
        {},
        { slug: "apollo", qty: 2 },
        { slug: "apollo", qty: 10 },
        { slug: "unknown", qty: 1 },
        { slug: "orion", qty: -1 },
        { slug: "orion", qty: 1.5 },
        { slug: "orion", qty: "5" },
      ],
      max,
    ),
    [{ slug: "apollo", qty: 3 }],
  );
  assert.deepEqual(normalizeCart({ slug: "apollo", qty: 1 }, max), []);
  assert.deepEqual(normalizeCart([{ slug: "orion", qty: 100 }], max), [
    { slug: "orion", qty: 20 },
  ]);
});

test("new photography upgrades legacy image URLs without replacing admin uploads", () => {
  const custom =
    "https://shop.public.blob.vercel-storage.com/products/custom.jpg";
  assert.equal(resolveProductImage(custom), custom);
  assert.equal(
    resolveProductImage("/products/apollo-box.jpg"),
    "/products/lune-men-set-lounge.png",
  );
  assert.equal(
    resolveProductGallery([
      "/products/orion-box.jpg",
      "/products/set-men.jpg",
      custom,
    ]).length,
    2,
  );
});

test("receipt escapes customer, address, product and order reference in both languages", () => {
  for (const locale of ["en", "ar"] as const) {
    const dangerous = '<a href="https://phishing.test">Pay here & now</a>';
    const order: OrderInput = {
      orderNumber: dangerous,
      customerName: dangerous,
      email: "test@example.test",
      phone: "0790000000",
      city: dangerous,
      address: dangerous,
      items: [{ slug: "apollo", name: dangerous, price: 35, qty: 1 }],
      subtotal: 35,
      deliveryFee: 3,
      total: 38,
      paymentMethod: "cod",
      locale,
    };
    const { html } = buildReceiptHtml(order);
    assert.ok(!html.includes(dangerous));
    assert.ok(
      html.includes(
        "&lt;a href=&quot;https://phishing.test&quot;&gt;Pay here &amp; now&lt;/a&gt;",
      ),
    );
    assert.ok(html.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`));
  }
});

test("sale pricing respects start and end boundaries", () => {
  const product = {
    stock: 50,
    price: 35,
    salePrice: 30,
    saleStartsAt: "2026-09-01T00:00:00Z",
    saleEndsAt: "2026-09-02T00:00:00Z",
  };
  assert.equal(
    effectivePrice(product, new Date("2026-08-31T23:59:59Z")).price,
    35,
  );
  assert.equal(
    effectivePrice(product, new Date("2026-09-01T12:00:00Z")).price,
    30,
  );
  assert.equal(
    effectivePrice(product, new Date("2026-09-02T00:00:01Z")).price,
    35,
  );
});
