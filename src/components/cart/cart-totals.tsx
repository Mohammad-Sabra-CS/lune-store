"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/components/cart/cart-context";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { cn } from "@/lib/utils";

/** Subtotal / delivery / total rows, shared by the cart drawer and the
 *  checkout summary. `totalClassName` controls the total row's top spacing. */
export function CartTotals({
  className,
  totalClassName = "pt-2",
}: {
  className?: string;
  totalClassName?: string;
}) {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const cart = useCart();

  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      <div className="flex justify-between text-night/70">
        <dt>{t("subtotal")}</dt>
        <dd>
          <AnimatedNumber value={cart.subtotal} /> {tCommon("currency")}
        </dd>
      </div>
      <div className="flex justify-between text-night/70">
        <dt>{t("delivery")}</dt>
        <dd>
          <AnimatedNumber value={cart.deliveryFee} /> {tCommon("currency")}
        </dd>
      </div>
      <div
        className={cn(
          "flex justify-between border-t border-night/10 text-base font-medium text-night",
          totalClassName,
        )}
      >
        <dt>{t("total")}</dt>
        <dd>
          <AnimatedNumber value={cart.total} /> {tCommon("currency")}
        </dd>
      </div>
    </dl>
  );
}
