import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Banknote, Droplets, Gift, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getStoreProducts } from "@/lib/products";
import { DELIVERY_FEE } from "@/lib/constants";
import { ProductCard } from "@/components/product/product-card";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import { HeroMedia } from "@/components/home/hero-media";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const products = await getStoreProducts();
  const trust = [
    { Icon: Banknote, label: t("trustCod") },
    {
      Icon: Truck,
      label: t("trustDelivery", {
        fee: DELIVERY_FEE,
        currency: tc("currency"),
      }),
    },
    { Icon: Gift, label: t("trustSet") },
  ];

  return (
    <>
      <section className="lune-hero relative isolate overflow-hidden bg-night text-moon">
        <div className="lune-hero-media">
          <HeroMedia />
        </div>
        <div className="lune-hero-shade absolute inset-0" aria-hidden />
        <div className="lune-container relative z-10">
          <div className="lune-hero-copy">
            <p className="eyebrow mb-7 text-gold-bright">{t("heroKicker")}</p>
            <h1 className="lune-hero-title font-display">
              <span className="block">{t("heroTitleA")}</span>
              <span className="block text-gold-bright">{t("heroTitleB")}</span>
            </h1>
            <p className="mt-7 max-w-sm text-sm leading-7 text-moon/80 sm:text-base">
              {t("heroSubtitle")}
            </p>
            <Link
              href="/shop"
              className="lune-button mt-8 border-gold/70 text-moon hover:bg-gold hover:text-night"
            >
              {t("heroCta")}
              <ArrowUpRight
                size={18}
                className="rtl:-scale-x-100"
                aria-hidden
              />
            </Link>
            <a
              href="#collection"
              className="mt-12 hidden w-fit items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-moon/70 lg:flex"
            >
              <span className="h-px w-9 bg-gold/60" aria-hidden />
              {t("scrollHint")}
            </a>
          </div>
        </div>
        <span
          className="absolute bottom-7 end-8 hidden text-[10px] tracking-[0.25em] text-moon/70 lg:block"
          aria-hidden
        >
          LUNE / 01
        </span>
      </section>
      <div className="border-y border-moon/10 bg-night-soft text-moon">
        <div className="lune-container grid gap-4 py-5 text-xs sm:grid-cols-3">
          {trust.map(({ Icon, label }) => (
            <p
              key={label}
              className="flex items-center justify-center gap-3 text-moon/80"
            >
              <Icon size={17} className="shrink-0 text-gold" aria-hidden />
              {label}
            </p>
          ))}
        </div>
      </div>
      <section id="collection" className="scroll-mt-20 bg-ivory py-20 sm:py-28">
        <div className="lune-container">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
            <div>
              <p className="eyebrow mb-4 text-gold-deep">
                {t("collectionKicker")}
              </p>
              <h2 className="lune-section-title font-display text-night">
                {t("chapters")}
              </h2>
              <p className="mt-4 text-sm text-night/70">
                {t("chaptersSubtitle")}
              </p>
            </div>
            <Link href="/shop" className="lune-text-link text-night">
              {t("viewAll")}
              <ArrowUpRight
                size={17}
                className="rtl:-scale-x-100"
                aria-hidden
              />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-7 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>
      <section className="bg-night text-moon">
        <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2">
          <div className="relative min-h-80 sm:min-h-[480px]">
            <Image
              src="/products/lune-women-set-wide.png"
              alt={t("ritualImageAlt")}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="px-6 py-16 sm:px-14 sm:py-20 lg:py-24">
            <p className="eyebrow text-gold">{t("ritualSubtitle")}</p>
            <h2 className="lune-section-title mt-5 max-w-lg font-display">
              {t("ritualTitle")}
            </h2>
            <div className="mt-10 space-y-7">
              {([1, 2, 3] as const).map((n) => (
                <div
                  key={n}
                  className="flex gap-5 border-t border-moon/15 pt-6"
                >
                  <span
                    className="pt-1 text-xs tabular-nums text-gold"
                    aria-hidden
                  >
                    0{n}
                  </span>
                  <div>
                    <h3 className="font-display text-xl">
                      {t(`ritualAct${n}Name`)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-moon/70">
                      {t(`ritualAct${n}Line`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="bg-ivory py-20 sm:py-28">
        <div className="lune-container grid gap-10 lg:grid-cols-[0.8fr_1.6fr] lg:items-center lg:gap-20">
          <div>
            <p className="eyebrow mb-5 text-gold-deep">{t("worldKicker")}</p>
            <h2 className="lune-section-title max-w-md font-display text-night">
              {t("worldTitle")}
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-7 text-night/70">
              {t("worldSubtitle")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            {products.map((p) => (
              <Link
                href={`/product/${p.slug}`}
                key={p.slug}
                className={`world-tile world-${p.slug} group relative flex min-h-48 flex-col items-start justify-end overflow-hidden p-5 text-moon sm:min-h-56 sm:p-7`}
              >
                <MoonPhaseGlyph
                  phase={p.phase}
                  className="mb-6 h-7 w-7 text-gold-bright"
                />
                <h3 className="font-display text-xl leading-relaxed sm:text-2xl">
                  {t(`worlds.${p.slug}`)}
                </h3>
                <span className="mt-4 flex w-full items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-moon/80">
                  <span lang="en">{p.name}</span>
                  <ArrowUpRight
                    size={17}
                    className="transition-transform group-hover:-translate-y-1 rtl:-scale-x-100"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section
        id="story"
        className="relative scroll-mt-20 overflow-hidden bg-night py-20 text-moon sm:py-28"
      >
        <div
          className="story-orbit absolute -start-32 top-1/2 -translate-y-1/2"
          aria-hidden
        />
        <div className="lune-container relative grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <p className="eyebrow mb-5 text-gold">{t("storyKicker")}</p>
            <h2 className="lune-section-title max-w-lg font-display">
              {t("storyTitle")}
            </h2>
          </div>
          <div>
            <p className="max-w-lg text-base leading-8 text-moon/75">
              {t("storyText")}
            </p>
            <a
              href="https://www.instagram.com/lune_perfume.jo/"
              target="_blank"
              rel="noopener noreferrer"
              className="lune-text-link mt-7 text-gold-bright"
            >
              {t("followInstagram")}
              <ArrowUpRight size={17} aria-hidden />
            </a>
          </div>
        </div>
      </section>
      <section className="bg-ivory-deep px-5 py-16 text-center sm:py-20">
        <Droplets
          className="mx-auto mb-5 text-gold-deep"
          size={25}
          strokeWidth={1.25}
          aria-hidden
        />
        <h2 className="lune-section-title font-display text-night">
          {t("finalTitle")}
        </h2>
        <Link
          href="/shop"
          className="lune-button mt-7 border-night bg-night text-moon hover:bg-night-soft"
        >
          {t("storyCta")}
          <ArrowUpRight size={17} className="rtl:-scale-x-100" aria-hidden />
        </Link>
      </section>
    </>
  );
}
