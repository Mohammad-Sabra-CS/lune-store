"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useCart } from "@/components/cart/cart-context";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

const rowClass =
  "flex w-full items-center justify-between px-6 py-5 font-display text-lg uppercase tracking-[0.12em] text-night transition-colors hover:text-gold-deep";

/** Phone-only navigation drawer: shop, cart and language in one place. */
export function MobileMenu() {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("openMenu")}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-moon/90 transition-colors hover:bg-moon/10 hover:text-gold-bright"
      >
        <Menu className="h-5 w-5" />
        {cart.count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.7rem] font-semibold text-night">
            {cart.count}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="flex w-full flex-col gap-0 bg-ivory p-0 sm:max-w-xs"
      >
        <SheetHeader className="border-b border-night/10 px-6 py-5 pr-12">
          <SheetTitle className="font-display text-xl tracking-[0.08em] uppercase text-night">
            {t("menu")}
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col divide-y divide-night/10">
          <Link href="/" className={rowClass} onClick={() => setOpen(false)}>
            {t("home")}
          </Link>
          <Link href="/shop" className={rowClass} onClick={() => setOpen(false)}>
            {t("shop")}
          </Link>
          <button
            type="button"
            className={rowClass}
            onClick={() => {
              setOpen(false);
              cart.openCart();
            }}
          >
            <span className="flex items-center gap-3">
              <ShoppingBag className="h-4.5 w-4.5" />
              {t("cart")}
            </span>
            {cart.count > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-semibold tabular-nums text-night">
                {cart.count}
              </span>
            )}
          </button>
          <div className="px-6 py-5">
            <LocaleSwitcher className="h-auto rounded-none p-0 font-display text-lg uppercase tracking-[0.12em] text-night hover:bg-transparent hover:text-gold-deep" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
