"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { LogoMark, LogoWordmark } from "@/components/brand/logo";
import { MoonPhaseGlyph, type MoonPhase } from "@/components/brand/moon-phase";
import { AuroraBackground } from "@/components/aurora";
import { HeroReveal, RevealItem } from "@/components/motion/primitives";
import { OPEN_FEEDBACK_EVENT } from "@/components/feedback/feedback-widget";

const rowClass =
  "group flex w-full items-center gap-4 px-7 py-5 ps-7 font-sans text-sm font-medium uppercase tracking-[0.25em] text-moon transition-[padding,background-color,color] duration-300 hover:bg-moon/[0.04] hover:ps-9 hover:text-gold-bright active:scale-[0.99]";

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative">
      {children}
      <span
        aria-hidden
        className="absolute -bottom-1 start-0 block h-px max-w-0 bg-gold transition-all duration-500 group-hover:max-w-full"
        style={{ width: "100%" }}
      />
    </span>
  );
}

function RowGlyph({ phase }: { phase: MoonPhase }) {
  return (
    <MoonPhaseGlyph
      phase={phase}
      className="h-4 w-4 text-gold/50 transition-colors duration-300 group-hover:text-gold"
    />
  );
}

/** Phone-only navigation drawer over the brand's aurora night. EN opens
 *  from the left, AR from the right — same side as the hamburger. */
export function MobileMenu() {
  const t = useTranslations("nav");
  const tFeedback = useTranslations("feedback");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("openMenu")}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-moon/90 transition-colors hover:bg-moon/10 hover:text-gold-bright"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent
        side={locale === "ar" ? "right" : "left"}
        showCloseButton={false}
        className="max-w-sm overflow-hidden border-e border-gold/25 bg-night p-0 text-moon shadow-2xl shadow-night/60 data-[side=left]:w-[85%] data-[side=right]:w-[85%]"
      >
        <AuroraBackground intensity="subtle" className="z-0" />

        <HeroReveal className="relative z-10 flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-moon/10 px-7 py-6">
            <SheetTitle className="m-0 p-0">
              <span className="flex items-center gap-2.5 text-gold">
                <LogoMark className="h-8 w-8" />
                <LogoWordmark className="text-2xl text-moon" />
                <span className="sr-only">{t("menu")}</span>
              </span>
            </SheetTitle>
            <SheetClose
              aria-label={t("menu")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-moon/60 transition-all duration-300 hover:rotate-90 hover:bg-moon/10 hover:text-gold-bright"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </div>

          <nav className="flex flex-col divide-y divide-moon/10">
            <RevealItem>
              <Link href="/" className={rowClass} onClick={() => setOpen(false)}>
                <RowGlyph phase="crescent" />
                <RowLabel>{t("home")}</RowLabel>
              </Link>
            </RevealItem>
            <RevealItem>
              <Link
                href="/shop"
                className={rowClass}
                onClick={() => setOpen(false)}
              >
                <RowGlyph phase="half" />
                <RowLabel>{t("shop")}</RowLabel>
              </Link>
            </RevealItem>
            <RevealItem>
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT));
                }}
              >
                <RowGlyph phase="gibbous" />
                <RowLabel>{tFeedback("tab")}</RowLabel>
              </button>
            </RevealItem>
            <RevealItem>
              <div className="px-7 py-5">
                <LocaleSwitcher className="h-auto rounded-none p-0 font-sans text-sm font-medium uppercase tracking-[0.25em] text-moon transition-colors duration-300 hover:bg-transparent hover:text-gold-bright" />
              </div>
            </RevealItem>
          </nav>
        </HeroReveal>
      </SheetContent>
    </Sheet>
  );
}
