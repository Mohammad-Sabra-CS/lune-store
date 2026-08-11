"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { products, type Audience } from "@/data/products";
import { ProductCard } from "@/components/product/product-card";
import { cn } from "@/lib/utils";

type Filter = "all" | Audience;

export function ShopGrid() {
  const t = useTranslations("shop");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered =
    filter === "all" ? products : products.filter((p) => p.audience === filter);

  const options: { value: Filter; label: string }[] = [
    { value: "all", label: t("filterAll") },
    { value: "men", label: t("filterMen") },
    { value: "women", label: t("filterWomen") },
  ];

  return (
    <>
      <div
        className="mb-12 flex justify-center gap-2"
        role="tablist"
        aria-label={t("title")}
      >
        {options.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "border px-6 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-300",
              filter === option.value
                ? "border-night bg-night text-moon"
                : "border-night/20 text-night/60 hover:border-night/50 hover:text-night",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </>
  );
}
