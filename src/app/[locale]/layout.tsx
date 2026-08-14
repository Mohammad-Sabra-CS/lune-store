import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Playfair_Display, Jost, Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { routing } from "@/i18n/routing";
import { getStoreProducts } from "@/lib/products";
import { ProductsProvider } from "@/components/product/products-context";
import { CartProvider } from "@/components/cart/cart-context";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import "../globals.css";

const playfair = Playfair_Display({
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-playfair",
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-amiri",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  weight: ["300", "400", "500", "600"],
  subsets: ["arabic"],
  variable: "--font-plex-arabic",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#0b0e17",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: {
      default: `Lune — ${t("heroTitleA")} ${t("heroTitleB")}`,
      template: "%s — Lune",
    },
    description: t("heroSubtitle"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const storeProducts = await getStoreProducts();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${playfair.variable} ${jost.variable} ${amiri.variable} ${plexArabic.variable}`}
      style={
        {
          "--font-display": `var(--font-playfair), var(--font-amiri), serif`,
          "--font-sans": `var(--font-jost), var(--font-plex-arabic), sans-serif`,
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider>
          <MotionProvider>
          <ProductsProvider products={storeProducts}>
          <CartProvider>
            <Header />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <FeedbackWidget />
          </CartProvider>
          </ProductsProvider>
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
