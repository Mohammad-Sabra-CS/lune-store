"use client";

import Image from "next/image";
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
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="flex w-full flex-col gap-0 bg-ivory p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-night/10 px-6 py-5">
          <SheetTitle className="font-display text-xl tracking-[0.15em] uppercase text-night">
            {t("title")}
          </SheetTitle>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <p className="font-display text-lg text-night/60">{t("empty")}</p>
            <Button
              render={<Link href="/shop" />}
              className="rounded-none bg-night px-8 tracking-[0.2em] uppercase text-moon hover:bg-night-soft"
              onClick={cart.closeCart}
            >
              {t("emptyCta")}
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-night/10 overflow-y-auto px-6">
              {cart.items.map((item) => {
                const product = getProduct(item.slug);
                if (!product) return null;
                return (
                  <li key={item.slug} className="flex gap-4 py-5">
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
                          <p className="font-display tracking-[0.12em] uppercase text-night">
                            {product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-night/65">
                            {product.character[locale]}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cart.removeItem(item.slug)}
                          aria-label={t("remove")}
                          className="-m-2 p-2 text-night/50 transition-colors hover:text-wine"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center border border-night/20"
                          aria-label={t("quantity")}
                        >
                          <button
                            type="button"
                            onClick={() => cart.setQty(item.slug, item.qty - 1)}
                            className="flex h-11 w-11 items-center justify-center text-night/70 transition-colors hover:bg-night/5 sm:h-8 sm:w-8"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm tabular-nums">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => cart.setQty(item.slug, item.qty + 1)}
                            className="flex h-11 w-11 items-center justify-center text-night/70 transition-colors hover:bg-night/5 sm:h-8 sm:w-8"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm font-medium tabular-nums text-night">
                          {product.price * item.qty} {tCommon("currency")}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-4 border-t border-night/10 bg-ivory-deep/60 px-6 py-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-night/70">
                  <dt>{t("subtotal")}</dt>
                  <dd className="tabular-nums">
                    {cart.subtotal} {tCommon("currency")}
                  </dd>
                </div>
                <div className="flex justify-between text-night/70">
                  <dt>{t("delivery")}</dt>
                  <dd className="tabular-nums">
                    {cart.deliveryFee} {tCommon("currency")}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-night/10 pt-2 text-base font-medium text-night">
                  <dt>{t("total")}</dt>
                  <dd className="tabular-nums">
                    {cart.total} {tCommon("currency")}
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
