"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";
import { getProduct } from "@/data/products";
import { Link } from "@/i18n/navigation";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { EASE, Float, HeroReveal, RevealItem } from "@/components/motion/primitives";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";

export function CartDrawer() {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "en" | "ar";
  const cart = useCart();

  return (
    <Sheet
      open={cart.isOpen}
      onOpenChange={(open) => (open ? cart.openCart() : cart.closeCart())}
    >
      {/* The panel itself keeps Base UI's CSS slide transitions — Motion only
          animates the contents inside. */}
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="flex w-full flex-col gap-0 bg-ivory p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-night/10 px-6 py-5">
          <SheetTitle className="font-display text-xl tracking-[0.08em] uppercase text-night">
            {t("title")}
          </SheetTitle>
        </SheetHeader>

        <span className="sr-only" aria-live="polite">
          {t("updated")}: {cart.count}
        </span>

        {cart.items.length === 0 ? (
          <HeroReveal className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <RevealItem>
              <Float amplitude={6} duration={5}>
                <MoonPhaseGlyph phase="crescent" className="h-10 w-10 text-gold-deep" />
              </Float>
            </RevealItem>
            <RevealItem>
              <p className="font-display text-lg text-night/60">{t("empty")}</p>
            </RevealItem>
            <RevealItem>
              <Button
                render={<Link href="/shop" />}
                className="rounded-none bg-night px-8 tracking-[0.2em] uppercase text-moon hover:bg-night-soft"
                onClick={cart.closeCart}
              >
                {t("emptyCta")}
              </Button>
            </RevealItem>
          </HeroReveal>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-night/10 overflow-y-auto px-6">
              <AnimatePresence mode="popLayout" initial={false}>
                {cart.items.map((item) => {
                  const product = getProduct(item.slug);
                  if (!product) return null;
                  return (
                    <motion.li
                      key={item.slug}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="flex gap-4 py-5"
                    >
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-night/5">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col justify-between py-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display tracking-[0.08em] uppercase text-night">
                              {product.name}
                            </p>
                            <p className="mt-0.5 text-xs text-night/65">
                              {product.character[locale]}
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.8 }}
                            onClick={() => cart.removeItem(item.slug)}
                            aria-label={t("remove")}
                            className="-m-2 p-2 text-night/50 transition-colors hover:text-wine"
                          >
                            <X className="h-4 w-4" />
                          </motion.button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center border border-night/20"
                            aria-label={t("quantity")}
                          >
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.85 }}
                              onClick={() => cart.setQty(item.slug, item.qty - 1)}
                              className="flex h-11 w-11 items-center justify-center text-night/70 transition-colors hover:bg-night/5 sm:h-8 sm:w-8"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </motion.button>
                            <span className="relative w-8 overflow-hidden text-center text-sm tabular-nums">
                              <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span
                                  key={item.qty}
                                  className="block"
                                  initial={{ y: 10, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  exit={{ y: -10, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: EASE }}
                                >
                                  {item.qty}
                                </motion.span>
                              </AnimatePresence>
                            </span>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.85 }}
                              onClick={() => cart.setQty(item.slug, item.qty + 1)}
                              className="flex h-11 w-11 items-center justify-center text-night/70 transition-colors hover:bg-night/5 sm:h-8 sm:w-8"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                          <p className="text-sm font-medium text-night">
                            <AnimatedNumber value={product.price * item.qty} />{" "}
                            {tCommon("currency")}
                          </p>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <div className="space-y-4 border-t border-night/10 bg-ivory-deep/60 px-6 py-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-night/70">
                  <dt>{t("subtotal")}</dt>
                  <dd>
                    <AnimatedNumber value={cart.subtotal} /> {tCommon("currency")}
                  </dd>
                </div>
                <div className="flex justify-between text-night/70">
                  <dt>{t("delivery")}</dt>
                  <dd>
                    <AnimatedNumber value={cart.deliveryFee} /> {tCommon("currency")}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-night/10 pt-2 text-base font-medium text-night">
                  <dt>{t("total")}</dt>
                  <dd>
                    <AnimatedNumber value={cart.total} /> {tCommon("currency")}
                  </dd>
                </div>
              </dl>
              <Button
                render={<Link href="/checkout" />}
                className="w-full rounded-none bg-night py-6 tracking-[0.25em] uppercase text-moon hover:bg-gold hover:text-night"
                onClick={cart.closeCart}
              >
                {t("checkout")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
