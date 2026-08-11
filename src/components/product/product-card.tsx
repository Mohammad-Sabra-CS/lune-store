"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Product } from "@/data/products";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import { TiltCard } from "@/components/motion/tilt-card";

export function ProductCard({ product }: { product: Product }) {
  const locale = useLocale() as "en" | "ar";
  const tCommon = useTranslations("common");

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <TiltCard className="aspect-[4/5] overflow-hidden bg-night">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </TiltCard>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <MoonPhaseGlyph phase={product.phase} className="h-3.5 w-3.5" />
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
            {tCommon(product.audience)}
          </span>
        </div>
        <h3 className="font-display text-xl uppercase tracking-[0.08em] text-night">
          {product.name}
          <span className="block h-px max-w-0 bg-gold transition-all duration-500 group-hover:max-w-full" />
        </h3>
        <p className="font-display text-sm italic text-night/65">
          {product.poetry[locale]}
        </p>
        <p className="pt-0.5 text-sm font-medium tabular-nums text-night">
          {product.price} {tCommon("currency")}
        </p>
      </div>
    </Link>
  );
}
