import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { products } from "@/data/products";
import { AuroraBackground } from "@/components/aurora";
import { Marquee } from "@/components/motion/marquee";
import {
  FadeIn,
  FadeUp,
  Float,
  LineReveal,
  Parallax,
} from "@/components/motion/primitives";
import { MoonPhaseGlyph } from "@/components/brand/moon-phase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROMAN = ["I", "II", "III", "IV"];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as "en" | "ar";
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <>
      {/* ── Dusk: hero ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-night text-moon">
        <AuroraBackground intensity="hero" />
        <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-12 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-24">
          <div className="space-y-8 text-center lg:text-start">
            <FadeIn delay={0.1}>
              <p className="eyebrow">{t("heroKicker")}</p>
            </FadeIn>
            <h1 className="display-xl font-display tracking-wide">
              <LineReveal delay={0.25}>{t("heroTitleA")}</LineReveal>
              <LineReveal delay={0.42}>
                <span className="text-gold">{t("heroTitleB")}</span>
              </LineReveal>
            </h1>
            <FadeIn delay={0.7}>
              <p className="mx-auto max-w-md text-base leading-relaxed text-moon/75 lg:mx-0">
                {t("heroSubtitle")}
              </p>
            </FadeIn>
            <FadeIn delay={0.9}>
              <Button
                render={<Link href="/shop" />}
                variant="outline"
                size="lg"
                className="rounded-none border-gold bg-transparent px-12 py-6 text-sm tracking-[0.3em] uppercase text-gold transition-colors duration-300 hover:bg-gold hover:text-night"
              >
                {t("heroCta")}
              </Button>
            </FadeIn>
          </div>

          <FadeIn delay={0.5} className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <Float amplitude={9} duration={7}>
              <div className="relative aspect-[3/4] overflow-hidden border border-gold/25">
                <Image
                  src="/products/hero-marble.jpg"
                  alt="Lune Eau de Parfum"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 40vw"
                  className="object-cover"
                />
              </div>
            </Float>
            <div
              className="absolute -inset-8 -z-10 rounded-full bg-gold/10 blur-3xl"
              aria-hidden
            />
          </FadeIn>
        </div>
      </section>

      {/* ── Gold ribbon ────────────────────────────────────────── */}
      <Marquee text={t("marquee")} />

      {/* ── The four chapters ──────────────────────────────────── */}
      <section className="aurora-wash bg-ivory py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeUp className="mb-16 space-y-3 text-center sm:mb-24">
            <p className="eyebrow">{tCommon("tagline")}</p>
            <h2 className="display-lg font-display uppercase tracking-[0.12em] text-night">
              {t("chapters")}
            </h2>
            <p className="text-muted-foreground">{t("chaptersSubtitle")}</p>
          </FadeUp>

          <div className="space-y-20 sm:space-y-28">
            {products.map((product, i) => {
              const flip = i % 2 === 1;
              return (
                <FadeUp key={product.slug}>
                  <article
                    className={cn(
                      "grid items-center gap-8 lg:grid-cols-2 lg:gap-16",
                    )}
                  >
                    <Parallax
                      range={30}
                      className={cn(
                        "relative overflow-hidden",
                        flip && "lg:order-2",
                      )}
                    >
                      <Link
                        href={`/product/${product.slug}`}
                        className="group block"
                      >
                        <div className="relative aspect-[4/5] overflow-hidden bg-night sm:aspect-[5/4]">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 1024px) 90vw, 45vw"
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                        </div>
                      </Link>
                    </Parallax>

                    <div
                      className={cn(
                        "space-y-5 text-center lg:text-start",
                        flip && "lg:order-1",
                      )}
                    >
                      <div className="flex items-center justify-center gap-3 lg:justify-start">
                        <MoonPhaseGlyph phase={product.phase} />
                        <span className="text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
                          {tCommon("chapter")} {ROMAN[i]} — {tCommon(product.audience)}
                        </span>
                      </div>
                      <h3 className="display-lg font-display uppercase tracking-[0.12em] text-night">
                        {product.name}
                      </h3>
                      <p className="font-display text-xl italic leading-relaxed text-night/70">
                        {product.poetry[locale]}
                      </p>
                      <p className="text-sm tracking-wide text-gold">
                        {product.character[locale]}
                      </p>
                      <div className="flex items-center justify-center gap-6 pt-2 lg:justify-start">
                        <span className="font-display text-2xl tabular-nums text-night">
                          {product.price} {tCommon("currency")}
                        </span>
                        <Button
                          render={<Link href={`/product/${product.slug}`} />}
                          variant="outline"
                          className="rounded-none border-night/30 bg-transparent px-8 py-5 text-xs tracking-[0.25em] uppercase text-night transition-colors duration-300 hover:border-night hover:bg-night hover:text-moon"
                        >
                          {t("chapterCta")}
                        </Button>
                      </div>
                    </div>
                  </article>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── The ritual ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-night py-20 text-moon sm:py-28">
        <AuroraBackground intensity="subtle" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeUp className="mb-14 space-y-3 text-center">
            <p className="eyebrow">{t("ritualSubtitle")}</p>
            <h2 className="display-lg font-display tracking-wide">
              {t("ritualTitle")}
            </h2>
          </FadeUp>
          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {(
              [
                ["ritualAct1Name", "ritualAct1Line"],
                ["ritualAct2Name", "ritualAct2Line"],
                ["ritualAct3Name", "ritualAct3Line"],
              ] as const
            ).map(([nameKey, lineKey], i) => (
              <FadeUp key={nameKey} delay={i * 0.12}>
                <div className="space-y-4 border-t border-gold/30 pt-6 text-center sm:text-start">
                  <span className="font-display text-4xl text-gold/60">
                    {ROMAN[i]}
                  </span>
                  <h3 className="font-display text-xl uppercase tracking-[0.2em]">
                    {t(nameKey)}
                  </h3>
                  <p className="text-sm leading-relaxed text-moon/70">
                    {t(lineKey)}
                  </p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Midnight: story ────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-t border-moon/10 bg-night py-20 text-moon sm:py-28">
        <AuroraBackground intensity="subtle" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <FadeUp className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden border border-gold/25 lg:max-w-none">
            <Image
              src="/products/set-men.jpg"
              alt="Lune package"
              fill
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="object-cover"
            />
          </FadeUp>
          <div className="space-y-6 text-center lg:text-start">
            <FadeUp>
              <h2 className="display-lg font-display text-balance leading-snug tracking-wide">
                {t("storyTitle")}
              </h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mx-auto max-w-md leading-relaxed text-moon/75 lg:mx-0">
                {t("storyText")}
              </p>
            </FadeUp>
            <FadeUp delay={0.24}>
              <Button
                render={<Link href="/shop" />}
                variant="outline"
                size="lg"
                className="rounded-none border-gold bg-transparent px-10 py-6 text-sm tracking-[0.3em] uppercase text-gold transition-colors duration-300 hover:bg-gold hover:text-night"
              >
                {t("storyCta")}
              </Button>
            </FadeUp>
          </div>
        </div>
      </section>
    </>
  );
}
