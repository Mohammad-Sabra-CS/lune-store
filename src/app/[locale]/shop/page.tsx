import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ShopGrid } from "@/components/product/shop-grid";

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

  return (
    <div className="aurora-wash bg-ivory">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-40">
        <div className="mb-10 space-y-3 text-center">
          <h1 className="font-display text-3xl uppercase tracking-[0.18em] text-night sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ShopGrid />
      </div>
    </div>
  );
}
