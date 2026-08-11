import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogoMark, LogoWordmark } from "@/components/brand/logo";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <footer className="relative bg-night text-moon">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-10 sm:flex-row">
          <div className="max-w-xs space-y-4">
            <div className="flex items-center gap-2.5 text-gold">
              <LogoMark className="h-8 w-8" />
              <LogoWordmark />
            </div>
            <p className="font-display text-lg text-moon/70">
              {tCommon("motto")}
            </p>
          </div>

          <div className="flex gap-16">
            <div className="space-y-3">
              <p className="eyebrow text-gold">{t("explore")}</p>
              <ul className="space-y-2 text-sm text-moon/70">
                <li>
                  <Link href="/" className="transition-colors hover:text-gold-bright">
                    {tNav("home")}
                  </Link>
                </li>
                <li>
                  <Link href="/shop" className="transition-colors hover:text-gold-bright">
                    {tNav("shop")}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="eyebrow text-gold">{t("contact")}</p>
              <ul className="space-y-2 text-sm text-moon/70">
                <li dir="ltr">Amman, Jordan</li>
                <li>
                  <a
                    href="https://instagram.com/lune"
                    className="transition-colors hover:text-gold-bright"
                  >
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-moon/10 pt-6 text-center text-xs tracking-wide text-moon/60">
          © {new Date().getFullYear()} Lune — {tCommon("tagline")}. {t("rights")}
        </div>
      </div>
    </footer>
  );
}
