import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuroraBackground } from "@/components/aurora";
import { ConfirmationReveal } from "@/components/confirmation/confirmation-reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return { title: t("title"), robots: { index: false, follow: false } };
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

  return (
    <div className="relative isolate overflow-hidden bg-night text-moon">
      <AuroraBackground intensity="hero" />
      <ConfirmationReveal
        order={
          typeof order === "string" && /^L-[A-Z0-9]{6,12}$/.test(order)
            ? order
            : undefined
        }
      />
    </div>
  );
}
