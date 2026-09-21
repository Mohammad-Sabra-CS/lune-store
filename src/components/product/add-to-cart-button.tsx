"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MAX_QTY_PER_ITEM } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";
import { useProducts } from "@/components/product/products-context";
import { isSoldOut } from "@/lib/pricing";
import { EASE } from "@/components/motion/primitives";

export function AddToCartButton({ slug }: { slug: string }) {
  const t = useTranslations("common");
  const { addItem, openCart, items } = useCart();
  const [hasAdded, setHasAdded] = useState(false);
  const { getProduct } = useProducts();
  const [added, setAdded] = useState(false);
  const reduce = useReducedMotion();

  const product = getProduct(slug);
  const soldOut = !product || isSoldOut(product);

  if (soldOut) {
    return (
      <Button
        size="lg"
        disabled
        className="w-full rounded-none bg-night/10 py-7 text-sm tracking-[0.3em] uppercase text-night/50 sm:w-auto sm:px-14"
      >
        {t("soldOut")}
      </Button>
    );
  }

  const swap = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.25, ease: EASE },
  };

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="w-full sm:w-auto"
    >
      <Button
        disabled={
          (items.find((i) => i.slug === slug)?.qty ?? 0) >=
          Math.min(product.stock, MAX_QTY_PER_ITEM)
        }
        size="lg"
        className="w-full rounded-none bg-gold py-7 text-sm tracking-[0.3em] uppercase text-night transition-colors duration-300 hover:bg-gold-bright sm:w-auto sm:px-14"
        onClick={() => {
          if (added) return;
          addItem(slug);
          setAdded(true);
          setHasAdded(true);
          // No auto-open: the header badge confirms the add; the customer
          // opens the cart when they're ready to check out.
          setTimeout(() => setAdded(false), 1400);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {added ? (
            <motion.span
              key="added"
              className="flex items-center gap-2"
              {...swap}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <motion.path
                  d="M4 12.5l5 5L20 6.5"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, ease: EASE, delay: 0.1 }}
                />
              </svg>
              {t("added")}
            </motion.span>
          ) : (
            <motion.span key="add" {...swap}>
              {t("addToCart")}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
      {hasAdded && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <button
            type="button"
            onClick={openCart}
            className="min-h-11 text-gold-deep underline underline-offset-4"
          >
            {t("viewCart")}
          </button>
          <Link
            href="/shop"
            className="inline-flex min-h-11 items-center text-night/70 underline underline-offset-4"
          >
            {t("continueShopping")}
          </Link>
        </div>
      )}
    </motion.div>
  );
}
