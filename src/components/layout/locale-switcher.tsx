"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const other = locale === "en" ? "ar" : "en";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: other })}
      className={cn(
        "flex h-10 items-center rounded-full px-3 text-sm tracking-wide text-moon/90 transition-colors hover:bg-moon/10 hover:text-gold-bright",
        other === "ar" && "font-medium",
        className,
      )}
    >
      {t("switchLocale")}
    </button>
  );
}
