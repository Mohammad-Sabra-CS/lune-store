"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

// Copy is hardcoded bilingually on purpose: the intl provider may be part of
// whatever crashed, so this boundary must not depend on it.
const COPY = {
  en: {
    eyebrow: "Lune",
    title: "Something went wrong",
    body: "An unexpected error interrupted the page. Please try again.",
    retry: "Try again",
  },
  ar: {
    eyebrow: "لون",
    title: "حدث خطأ ما",
    body: "حدث خطأ غير متوقع أثناء عرض الصفحة. يرجى المحاولة مرة أخرى.",
    retry: "حاول مرة أخرى",
  },
} as const;

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const locale = params?.locale === "ar" ? "ar" : "en";
  const t = COPY[locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

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
      <button
        type="button"
        onClick={reset}
        className="mt-2 border border-gold/40 px-8 py-3 text-sm uppercase tracking-[0.18em] text-gold transition-colors duration-300 hover:border-gold hover:bg-gold/10"
      >
        {t.retry}
      </button>
    </section>
  );
}
