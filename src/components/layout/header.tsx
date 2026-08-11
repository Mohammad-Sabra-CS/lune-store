"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingBag } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/components/cart/cart-context";
import { LogoMark, LogoWordmark } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations("nav");
  const { count, openCart } = useCart();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 text-moon transition-all duration-500",
        scrolled
          ? "bg-night/85 shadow-lg shadow-night/30 backdrop-blur-md"
          : "bg-gradient-to-b from-night/70 to-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:h-[4.5rem] sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-gold transition-colors hover:text-gold-bright"
        >
          <LogoMark className="h-7 w-7 transition-transform duration-500 group-hover:rotate-12" />
          <LogoWordmark className="text-moon" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm tracking-wide sm:flex">
          <Link
            href="/"
            className="text-moon/80 transition-colors hover:text-gold-bright"
          >
            {t("home")}
          </Link>
          <Link
            href="/shop"
            className="text-moon/80 transition-colors hover:text-gold-bright"
          >
            {t("shop")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={openCart}
            aria-label={t("openCart")}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-moon/90 transition-colors hover:bg-moon/10 hover:text-gold-bright"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.7rem] font-semibold text-night">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
