"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Banknote } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/components/cart/cart-context";
import { CartEmpty } from "@/components/cart/cart-empty";
import { CartTotals } from "@/components/cart/cart-totals";
import { useProducts } from "@/components/product/products-context";
import { effectivePrice } from "@/lib/pricing";
import { placeOrder } from "@/app/[locale]/checkout/actions";
import {
  ADDRESS_MIN,
  CITY_MIN,
  EMAIL_RE,
  NAME_MIN,
  PHONE_RE,
} from "@/lib/checkout-validation";
import { EASE, HeroReveal, RevealItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "city" | "address", string>
>;

/** Validation message that unfolds under its field. */
function FieldError({ children }: { children?: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="overflow-hidden text-xs text-wine"
        >
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function CheckoutForm() {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const { getProduct } = useProducts();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<"server" | "soldOut" | null>(null);

  if (cart.items.length === 0 && !isPending) {
    return <CartEmpty className="py-16" />;
  }

  function validate(form: FormData): FieldErrors {
    const next: FieldErrors = {};
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    if (name.length < NAME_MIN) next.name = t("errRequired");
    if (!EMAIL_RE.test(email)) next.email = t("errEmail");
    if (!PHONE_RE.test(phone)) next.phone = t("errPhone");
    if (city.length < CITY_MIN) next.city = t("errRequired");
    if (address.length < ADDRESS_MIN) next.address = t("errRequired");
    return next;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    setServerError(null);
    if (Object.keys(fieldErrors).length > 0) return;

    startTransition(async () => {
      const result = await placeOrder({
        name: String(form.get("name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
        city: String(form.get("city")),
        address: String(form.get("address")),
        paymentMethod: "cod",
        locale,
        items: cart.items.map((i) => ({ slug: i.slug, qty: i.qty })),
      });
      if (result.ok && result.orderNumber) {
        cart.clearCart();
        router.push(`/confirmation?order=${result.orderNumber}`);
      } else if (result.error === "soldOut") {
        setServerError("soldOut");
        // Pull fresh stock so the cart prunes/clamps sold-out items
        router.refresh();
      } else {
        setServerError("server");
      }
    });
  }

  const inputClass =
    "rounded-none border-night/25 bg-card px-4 py-6 text-night focus-visible:border-gold focus-visible:ring-gold/40";

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]"
      noValidate
    >
      <HeroReveal className="space-y-10">
        {/* Contact */}
        <RevealItem>
        <fieldset className="space-y-5">
          <legend className="eyebrow mb-4 text-gold-deep">{t("contactTitle")}</legend>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-night/80">
              {t("name")}
            </Label>
            <Input id="name" name="name" autoComplete="name" className={inputClass} />
            <FieldError>{errors.name}</FieldError>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-night/80">
                {t("email")}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                className={inputClass}
              />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-night/80">
                {t("phone")}
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="07X XXX XXXX"
                className={inputClass}
              />
              <FieldError>{errors.phone}</FieldError>
            </div>
          </div>
        </fieldset>
        </RevealItem>

        {/* Delivery */}
        <RevealItem>
        <fieldset className="space-y-5">
          <legend className="eyebrow mb-4 text-gold-deep">{t("deliveryTitle")}</legend>
          <div className="grid gap-5 sm:grid-cols-[0.6fr_1.4fr]">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-night/80">
                {t("city")}
              </Label>
              <Input id="city" name="city" className={inputClass} />
              <FieldError>{errors.city}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-night/80">
                {t("address")}
              </Label>
              <Input
                id="address"
                name="address"
                autoComplete="street-address"
                className={inputClass}
              />
              <FieldError>{errors.address}</FieldError>
            </div>
          </div>
        </fieldset>
        </RevealItem>

        {/* Payment */}
        <RevealItem>
        <fieldset className="space-y-4">
          <legend className="eyebrow mb-4 text-gold-deep">{t("paymentTitle")}</legend>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-4 border border-gold bg-card p-5 transition-colors",
            )}
          >
            <input
              type="radio"
              name="payment"
              value="cod"
              defaultChecked
              className="h-4 w-4 accent-gold"
            />
            <Banknote className="h-5 w-5 text-gold" />
            <span>
              <span className="block text-sm font-medium text-night">
                {t("cod")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("codDesc")}
              </span>
            </span>
          </label>
          <div
            aria-disabled
            className="flex items-center gap-4 border border-night/15 bg-card/60 p-5 opacity-60"
          >
            <input type="radio" name="payment" value="card" disabled className="h-4 w-4" />
            <CreditCard className="h-5 w-5 text-night/50" />
            <span className="flex items-center gap-3">
              <span className="text-sm font-medium text-night/70">{t("card")}</span>
              <span className="border border-gold/60 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] text-gold">
                {t("cardSoon")}
              </span>
            </span>
          </div>
        </fieldset>
        </RevealItem>
      </HeroReveal>

      {/* Summary */}
      <aside className="h-fit border border-night/10 bg-card lg:sticky lg:top-28">
      <HeroReveal className="space-y-5 p-6">
        <RevealItem>
          <p className="eyebrow text-gold-deep">{t("orderSummary")}</p>
        </RevealItem>
        <RevealItem>
        <ul className="space-y-3 text-sm">
          {cart.items.map((item) => {
            const product = getProduct(item.slug);
            if (!product) return null;
            return (
              <li key={item.slug} className="flex justify-between gap-3">
                <span className="text-night/80">
                  {product.name} × {item.qty}
                </span>
                <span className="tabular-nums text-night">
                  {effectivePrice(product).price * item.qty} {tCommon("currency")}
                </span>
              </li>
            );
          })}
        </ul>
        </RevealItem>
        <RevealItem>
          <CartTotals className="border-t border-night/10 pt-4" totalClassName="pt-3" />
        </RevealItem>
        <AnimatePresence initial={false}>
          {serverError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden border border-wine/40 bg-wine/5 p-3 text-xs text-wine"
            >
              {serverError === "soldOut" ? t("errSoldOut") : t("errGeneric")}
            </motion.p>
          )}
        </AnimatePresence>
        <RevealItem>
          <motion.div
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Button
              type="submit"
              disabled={isPending}
              className="w-full rounded-none bg-gold py-7 text-sm tracking-[0.25em] uppercase text-night transition-colors hover:bg-gold-bright"
            >
              {isPending ? t("placing") : t("placeOrder")}
            </Button>
          </motion.div>
        </RevealItem>
      </HeroReveal>
      </aside>
    </form>
  );
}
