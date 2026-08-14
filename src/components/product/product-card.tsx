"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { StoreProduct } from "@/lib/products";
import { effectivePrice, isSoldOut } from "@/lib/pricing";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import { TiltCard } from "@/components/motion/tilt-card";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: StoreProduct }) {
  const locale = useLocale() as Locale;
  const tCommon = useTranslations("common");
  const { price, basePrice, onSale } = effectivePrice(product);
  const soldOut = isSoldOut(product);

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <TiltCard className="aspect-[4/5] overflow-hidden bg-night">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className={cn(
            "object-cover transition-transform duration-700 ease-out group-hover:scale-105",
            soldOut && "opacity-60 grayscale",
          )}
        />
        {soldOut ? (
          <span className="absolute start-3 top-3 z-10 bg-night/85 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-moon">
            {tCommon("soldOut")}
          </span>
        ) : (
          onSale && (
            <span className="absolute start-3 top-3 z-10 bg-gold px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-night">
              {tCommon("sale")}
            </span>
          )
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-night/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </TiltCard>
      <div className="mt-4 space-y-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[0.7rem] uppercase tracking-[0.15em]",
            product.audience === "women"
              ? "border-wine/30 bg-wine/[0.06] text-wine"
              : "border-navy-lune/30 bg-navy-lune/[0.06] text-navy-lune",
          )}
        >
          <MoonPhaseGlyph phase={product.phase} className="h-4 w-4 text-current" />
          {tCommon(product.audience)}
        </span>
        <h3 className="font-display text-xl uppercase tracking-[0.08em] text-night">
          {product.name}
          <span className="block h-px max-w-0 bg-gold transition-all duration-500 group-hover:max-w-full" />
        </h3>
        <p className="font-display text-sm italic text-night/65">
          {product.poetry[locale]}
        </p>
        {soldOut ? (
          <p className="pt-0.5 text-xs font-medium uppercase tracking-[0.2em] text-night/50">
            {tCommon("soldOut")}
          </p>
        ) : (
          <p className="pt-0.5 text-sm font-medium tabular-nums text-night">
            {onSale && (
              <s className="me-2 text-night/40">
                {basePrice} {tCommon("currency")}
              </s>
            )}
            {price} {tCommon("currency")}
          </p>
        )}
      </div>
    </Link>
  );
}
