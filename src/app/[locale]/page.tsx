import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { products } from "@/data/products";
import { AuroraBackground } from "@/components/aurora";
import {
  Float,
  HeroReveal,
  LineReveal,
  Reveal,
  RevealItem,
} from "@/components/motion/primitives";
import { Spotlight } from "@/components/motion/spotlight";
import { HeroMedia } from "@/components/home/hero-media";
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
  const locale = rawLocale as Locale;
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <>
      {/* ── Dusk: hero ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-night text-moon">
        <AuroraBackground intensity="hero" />
        <Spotlight />
        <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-12 px-4 pb-24 pt-28 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-24">
          <HeroReveal className="space-y-8 text-center lg:text-start">
            <RevealItem>
              <p className="eyebrow text-gold">{t("heroKicker")}</p>
            </RevealItem>
            <h1 className="display-xl font-display">
              <LineReveal>{t("heroTitleA")}</LineReveal>
              <LineReveal>
                <span className={cn("text-gold", locale === "en" && "italic")}>
                  {t("heroTitleB")}
                </span>
              </LineReveal>
            </h1>
            <RevealItem>
              <p className="mx-auto max-w-md text-base leading-relaxed text-moon/75 lg:mx-0">
                {t("heroSubtitle")}
              </p>
            </RevealItem>
            <RevealItem>
              <Button
                render={<Link href="/shop" />}
                variant="outline"
                size="lg"
                className="rounded-none border-gold bg-transparent px-12 py-6 text-sm tracking-[0.3em] uppercase text-gold transition-colors duration-300 hover:bg-gold hover:text-night"
              >
                {t("heroCta")}
              </Button>
            </RevealItem>
          </HeroReveal>

          <HeroReveal className="order-first relative mx-auto w-full max-w-sm lg:order-none lg:max-w-none">
            <RevealItem y={32}>
              <HeroMedia />
            </RevealItem>
            <Float amplitude={6} duration={9} className="absolute -inset-8 -z-10">
              <div className="h-full w-full rounded-full bg-gold/10 blur-3xl" aria-hidden />
            </Float>
          </HeroReveal>
        </div>

      </section>

      {/* ── The four chapters ──────────────────────────────────── */}
      <section className="aurora-wash overflow-hidden bg-ivory py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-16 space-y-3 text-center sm:mb-24">
            <RevealItem>
              <p className="eyebrow text-gold-deep">{tCommon("tagline")}</p>
            </RevealItem>
            <RevealItem>
              <h2 className="display-lg font-display uppercase tracking-[0.06em] text-night">
                {t("chapters")}
              </h2>
            </RevealItem>
            <RevealItem>
              <p className="text-muted-foreground">{t("chaptersSubtitle")}</p>
            </RevealItem>
          </Reveal>

          <div className="space-y-24 sm:space-y-36">
            {products.map((product, i) => {
              const flip = i % 2 === 1;
              return (
                <article
                  key={product.slug}
                  className={cn(
                    "relative",
                    product.audience === "women" ? "tint-wine" : "tint-navy",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "ghost-numeral absolute inset-x-0 -top-12 text-center text-gold/30",
                      "lg:inset-x-auto lg:-top-16",
                      flip ? "lg:start-0 lg:text-start" : "lg:end-0 lg:text-end",
                    )}
                  >
                    {ROMAN[i]}
                  </span>
                  <Reveal
                    className={cn(
                      "relative space-y-5 pt-16 text-center lg:pt-0",
                      flip ? "lg:text-end" : "lg:text-start",
                    )}
                  >
                      <RevealItem>
                        <div
                          className={cn(
                            "flex items-center justify-center gap-3",
                            flip ? "lg:justify-end" : "lg:justify-start",
                          )}
                        >
                          <MoonPhaseGlyph phase={product.phase} />
                          <span className="text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
                            {tCommon("chapter")} {ROMAN[i]} — {tCommon(product.audience)}
                          </span>
                        </div>
                      </RevealItem>
                      <RevealItem>
                        <h3 className="display-lg font-display uppercase tracking-[0.06em] text-night">
                          {product.name}
                        </h3>
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
                            product.audience === "women"
                              ? "text-wine"
                              : "text-navy-lune",
                          )}
                        >
                          {product.character[locale]}
                        </p>
                      </RevealItem>
                      <RevealItem>
                        <div
                          className={cn(
                            "flex items-center justify-center gap-6 pt-2",
                            flip ? "lg:justify-end" : "lg:justify-start",
                          )}
                        >
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
                      </RevealItem>
                  </Reveal>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── The ritual ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-night py-20 text-moon sm:py-28">
        <AuroraBackground intensity="subtle" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-14 space-y-3 text-center">
            <RevealItem>
              <p className="eyebrow text-gold">{t("ritualSubtitle")}</p>
            </RevealItem>
            <RevealItem>
              <h2 className="display-lg font-display tracking-wide">
                {t("ritualTitle")}
              </h2>
            </RevealItem>
          </Reveal>
          <Reveal className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {(
              [
                ["ritualAct1Name", "ritualAct1Line"],
                ["ritualAct2Name", "ritualAct2Line"],
                ["ritualAct3Name", "ritualAct3Line"],
              ] as const
            ).map(([nameKey, lineKey], i) => (
              <RevealItem key={nameKey}>
                <div className="group relative h-full border border-moon/10 bg-night-soft/40 p-8 text-center transition-colors duration-500 hover:border-gold/40 sm:text-start">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px origin-center scale-x-0 bg-gold transition-transform duration-500 ease-out group-hover:scale-x-100"
                  />
                  <span className="font-display text-4xl text-gold/60 transition-colors duration-500 group-hover:text-gold">
                    {ROMAN[i]}
                  </span>
                  <h3 className="mt-4 font-display text-xl uppercase tracking-[0.14em]">
                    {t(nameKey)}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-moon/50 transition-all duration-500 group-hover:translate-y-0 group-hover:text-moon/80 sm:translate-y-1.5">
                    {t(lineKey)}
                  </p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Midnight: story ────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-t border-moon/10 bg-night py-20 text-moon sm:py-28">
        <AuroraBackground intensity="subtle" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mx-auto max-w-2xl space-y-6 text-center">
            <RevealItem>
              <h2 className="display-lg font-display text-balance leading-snug tracking-wide">
                {t("storyTitle")}
              </h2>
            </RevealItem>
            <RevealItem>
              <p className="mx-auto max-w-md leading-relaxed text-moon/75">
                {t("storyText")}
              </p>
            </RevealItem>
            <RevealItem>
              <Button
                render={<Link href="/shop" />}
                variant="outline"
                size="lg"
                className="rounded-none border-gold bg-transparent px-10 py-6 text-sm tracking-[0.3em] uppercase text-gold transition-colors duration-300 hover:bg-gold hover:text-night"
              >
                {t("storyCta")}
              </Button>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
