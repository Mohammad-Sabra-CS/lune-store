"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { products, type Audience } from "@/data/products";
import { ProductCard } from "@/components/product/product-card";
import { EASE } from "@/components/motion/primitives";
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
        {options.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option.value)}
              className={cn(
                "relative border px-6 py-2 text-xs uppercase tracking-[0.2em] transition-colors duration-300",
                active
                  ? "border-gold text-night"
                  : "border-night/20 text-night/60 hover:border-gold-deep hover:text-gold-deep",
              )}
            >
              {active && (
                <motion.span
                  layoutId="shop-filter-pill"
                  className="absolute inset-0 bg-gold"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
      <motion.div
        layout
        className="grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 lg:grid-cols-4"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.map((product) => (
            <motion.div
              key={product.slug}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
