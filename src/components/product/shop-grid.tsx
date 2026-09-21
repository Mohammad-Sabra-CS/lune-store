"use client";

import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Audience } from "@/data/products";
import { useProducts } from "@/components/product/products-context";
import { ProductCard } from "@/components/product/product-card";
import { EASE } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

type Filter = "all" | Audience;

export function ShopGrid() {
  const t = useTranslations("shop");
  const { products } = useProducts();
  const searchParams = useSearchParams();
  const audience = searchParams.get("audience");
  const filter: Filter =
    audience === "men" || audience === "women" ? audience : "all";
  function setFilter(value: Filter) {
    const next = new URL(window.location.href);
    if (value === "all") next.searchParams.delete("audience");
    else next.searchParams.set("audience", value);
    window.history.replaceState(
      null,
      "",
      `${next.pathname}${next.search}${next.hash}`,
    );
  }

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
        className="mb-12 flex flex-wrap justify-center gap-2"
        role="group"
        aria-label={t("title")}
      >
        {options.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={cn(
                "relative min-h-11 border px-6 py-2 text-xs uppercase tracking-[0.2em] transition-colors duration-300",
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
