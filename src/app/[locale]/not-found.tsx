import { getLocale } from "next-intl/server";

// Server component on purpose: client hooks (useParams etc.) aren't available
// during the 404 render pass and silently drop this boundary back to Next's
// default UI. Copy is hardcoded bilingually — no message-catalog dependency.
const COPY = {
  en: {
    eyebrow: "404",
    title: "Page not found",
    body: "The page you are looking for has drifted out of orbit.",
    home: "Back to home",
  },
  ar: {
    eyebrow: "404",
    title: "الصفحة غير موجودة",
    body: "الصفحة التي تبحث عنها خرجت عن مدارها.",
    home: "العودة إلى الرئيسية",
  },
} as const;

export default async function LocaleNotFound() {
  const requestLocale = await getLocale().catch(() => "en");
  const locale = requestLocale === "ar" ? "ar" : "en";
  const t = COPY[locale];

  return (
    <section
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-night px-6 py-24 text-center text-moon"
    >
      <p className="eyebrow text-gold">{t.eyebrow}</p>
      <h1 className="font-display text-3xl uppercase tracking-[0.08em] sm:text-4xl">
        {t.title}
      </h1>
      <p className="max-w-md text-moon/70">{t.body}</p>
      <a
        href={`/${locale}`}
        className="mt-2 border border-gold/40 px-8 py-3 text-sm uppercase tracking-[0.18em] text-gold transition-colors duration-300 hover:border-gold hover:bg-gold/10"
      >
        {t.home}
      </a>
    </section>
  );
}
