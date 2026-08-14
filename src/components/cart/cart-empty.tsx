"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Float, HeroReveal, RevealItem } from "@/components/motion/primitives";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import { cn } from "@/lib/utils";

/** Empty-cart message + shop CTA, shared by the cart drawer and checkout. */
export function CartEmpty({
  className,
  glyph = false,
  showCta = true,
  onCtaClick,
}: {
  className?: string;
  glyph?: boolean;
  showCta?: boolean;
  onCtaClick?: () => void;
}) {
  const t = useTranslations("cart");

  return (
    <HeroReveal
      className={cn(
        "flex flex-col items-center justify-center gap-5 text-center",
        className,
      )}
    >
      {glyph && (
        <RevealItem>
          <Float amplitude={6} duration={5}>
            <MoonPhaseGlyph phase="crescent" className="h-10 w-10 text-gold-deep" />
          </Float>
        </RevealItem>
      )}
      <RevealItem>
        <p className="font-display text-lg text-night/60">{t("empty")}</p>
      </RevealItem>
      {showCta && (
        <RevealItem>
          <Button
            render={<Link href="/shop" />}
            className="rounded-none bg-night px-8 tracking-[0.2em] uppercase text-moon hover:bg-night-soft"
            onClick={onCtaClick}
          >
            {t("emptyCta")}
          </Button>
        </RevealItem>
      )}
    </HeroReveal>
  );
}
