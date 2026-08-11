import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { LineReveal } from "@/components/motion/primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title") };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("checkout");

  return (
    <div className="bg-ivory">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-32 sm:px-6 sm:pt-40">
        <h1 className="mb-10 text-center font-display text-3xl uppercase tracking-[0.08em] text-night sm:text-4xl">
          <LineReveal standalone>{t("title")}</LineReveal>
        </h1>
        <CheckoutForm />
      </div>
    </div>
  );
}
