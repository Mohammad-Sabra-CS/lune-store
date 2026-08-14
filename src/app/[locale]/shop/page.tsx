import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShopGrid } from "@/components/product/shop-grid";
import { HeroReveal, RevealItem } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  return { title: t("title") };
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shop");
  const tCommon = await getTranslations("common");

  return (
    <div className="aurora-wash bg-ivory">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-40">
        <HeroReveal className="mb-12 space-y-3 text-center">
          <RevealItem>
            <p className="eyebrow text-gold-deep">{tCommon("tagline")}</p>
          </RevealItem>
          <RevealItem>
            <h1 className="display-md font-display uppercase tracking-[0.08em] text-night">
              {t("title")}
            </h1>
          </RevealItem>
          <RevealItem>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </RevealItem>
        </HeroReveal>
        <ShopGrid />
      </div>
    </div>
  );
}
