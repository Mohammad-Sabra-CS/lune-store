import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { AuroraBackground } from "@/components/aurora";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return { title: t("title") };
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { order } = await searchParams;
  const t = await getTranslations("confirmation");

  return (
    <div className="relative isolate overflow-hidden bg-night text-moon">
      <AuroraBackground intensity="hero" />
      <div className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-6 px-4 py-32 text-center">
        <LogoMark className="h-14 w-14 text-gold" />
        <h1 className="font-display text-3xl tracking-wide sm:text-4xl">
          {t("title")}
        </h1>
        <p className="max-w-sm leading-relaxed text-moon/70">{t("subtitle")}</p>
        {order && (
          <p className="border border-gold/40 px-6 py-3 text-sm tracking-[0.2em]">
            {t("orderNumber")}: <span className="text-gold" dir="ltr">{order}</span>
          </p>
        )}
        <p className="text-sm text-moon/60">{t("emailNote")}</p>
        <Button
          render={<Link href="/" />}
          variant="outline"
          className="mt-4 rounded-none border-gold bg-transparent px-10 py-6 text-xs tracking-[0.3em] uppercase text-gold transition-colors hover:bg-gold hover:text-night"
        >
          {t("backHome")}
        </Button>
      </div>
    </div>
  );
}
