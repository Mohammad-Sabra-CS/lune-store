import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProduct, products } from "@/data/products";
import { routing, type Locale } from "@/i18n/routing";
import { ProductGallery } from "@/components/product/gallery";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import { HeroReveal, RevealItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    products.map((p) => ({ locale, slug: p.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description[locale as Locale],
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const product = getProduct(slug);
  if (!product) notFound();

  const t = await getTranslations("product");
  const tCommon = await getTranslations("common");

  const contents = [
    product.audience === "men" ? t("edpMen") : t("edpWomen"),
    t("bodyMist"),
    t("perfumeOil"),
  ];

  return (
    <div className="aurora-wash bg-ivory">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-28 sm:px-6 sm:pt-36 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.gallery} name={product.name} />

        <HeroReveal className="space-y-8 lg:pt-4">
          <div className="space-y-4">
            <RevealItem>
              <div className="flex items-center gap-2.5">
                <MoonPhaseGlyph phase={product.phase} />
                <span className="text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
                  {tCommon(product.audience)}
                </span>
              </div>
            </RevealItem>
            <RevealItem>
              <h1 className="display-lg font-display uppercase tracking-[0.08em] text-night">
                {product.name}
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="font-display text-xl italic leading-relaxed text-night/70">
                {product.poetry[locale]}
              </p>
            </RevealItem>
            <RevealItem>
              <p
                className={cn(
                  "text-sm tracking-wide",
                  product.audience === "women" ? "text-wine" : "text-navy-lune",
                )}
              >
                {product.character[locale]}
              </p>
            </RevealItem>
          </div>

          <RevealItem>
            <p className="max-w-md leading-relaxed text-night/70">
              {product.description[locale]}
            </p>
          </RevealItem>

          <RevealItem>
            <div className="space-y-3 border-y border-night/10 py-6">
              <p className="eyebrow text-gold-deep">{t("whatsInside")}</p>
              <ul className="space-y-2">
                {contents.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-night/80">
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2.5 w-2.5 shrink-0 text-gold-deep"
                      aria-hidden
                    >
                      <path
                        d="M8 1a5 5 0 1 0 0 10 6 6 0 0 1-3-5 6 6 0 0 1 3-5Z"
                        fill="currentColor"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </RevealItem>

          <RevealItem>
            <div className="space-y-5">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl tabular-nums text-night">
                  {product.price} {tCommon("currency")}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("packagePrice")}
                </span>
              </div>
              <AddToCartButton slug={product.slug} />
            </div>
          </RevealItem>
        </HeroReveal>
      </div>
    </div>
  );
}
