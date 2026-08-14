"use client";

import { useTranslations } from "next-intl";
import { useProducts } from "@/components/product/products-context";
import { effectivePrice, isSoldOut } from "@/lib/pricing";
import { AddToCartButton } from "@/components/product/add-to-cart-button";

/**
 * Price + CTA block on the product page. Client-side so sale windows apply
 * (and expire) at view time without revalidating the static page.
 */
export function PurchasePanel({ slug }: { slug: string }) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const { getProduct } = useProducts();
  const product = getProduct(slug);
  if (!product) return null;

  const { price, basePrice, onSale } = effectivePrice(product);
  const soldOut = isSoldOut(product);
  const showSale = onSale && !soldOut;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        {showSale && (
          <s className="font-display text-xl tabular-nums text-night/40">
            {basePrice} {tCommon("currency")}
          </s>
        )}
        <span className="font-display text-3xl tabular-nums text-night">
          {price} {tCommon("currency")}
        </span>
        {showSale && (
          <span className="bg-gold px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-night">
            {tCommon("sale")}
          </span>
        )}
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {t("packagePrice")}
        </span>
      </div>
      <AddToCartButton slug={slug} />
    </div>
  );
}
