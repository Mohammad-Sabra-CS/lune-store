"use client";

import { useState, useTransition, useRef } from "react";
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
  ADDRESS_MAX,
  CITY_MIN,
  CITY_MAX,
  EMAIL_RE,
  EMAIL_MAX,
  NAME_MIN,
  NAME_MAX,
  PHONE_RE,
} from "@/lib/checkout-validation";
import { EASE } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "city" | "address", string>
>;

/** Validation message that unfolds under its field. */
function FieldError({
  children,
  id,
}: {
  children?: React.ReactNode;
  id: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.p
          id={id}
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
  const [serverError, setServerError] = useState<
    "server" | "soldOut" | "priceChanged" | "validation" | null
  >(null);
  const submitting = useRef(false);

  if (!cart.isReady)
    return (
      <p className="py-16 text-center text-night/70" role="status">
        {t("loadingCart")}
      </p>
    );

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
    if (email && !EMAIL_RE.test(email)) next.email = t("errEmail");
    if (!PHONE_RE.test(phone)) next.phone = t("errPhone");
    if (city.length < CITY_MIN) next.city = t("errRequired");
    if (address.length < ADDRESS_MIN) next.address = t("errRequired");
    if (name.length > NAME_MAX) next.name = t("errTooLong");
    if (email.length > EMAIL_MAX) next.email = t("errTooLong");
    if (city.length > CITY_MAX) next.city = t("errTooLong");
    if (address.length > ADDRESS_MAX) next.address = t("errTooLong");
    return next;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    setServerError(null);
    const firstError = Object.keys(fieldErrors)[0];
    if (firstError) {
      (formElement.elements.namedItem(firstError) as HTMLInputElement)?.focus();
      return;
    }
    submitting.current = true;

    startTransition(async () => {
      try {
        const result = await placeOrder({
          name: String(form.get("name")),
          email: String(form.get("email")),
          phone: String(form.get("phone")),
          city: String(form.get("city")),
          address: String(form.get("address")),
          paymentMethod: "cod",
          expectedTotal: cart.total,
          locale,
          items: cart.items.map((i) => ({ slug: i.slug, qty: i.qty })),
        });
        if (result.ok && result.orderNumber) {
          cart.clearCart();
          router.replace(
            `/confirmation?order=${encodeURIComponent(result.orderNumber)}`,
          );
        } else if (result.error === "soldOut") {
          setServerError("soldOut");
          // Pull fresh stock so the cart prunes/clamps sold-out items
          router.refresh();
        } else if (result.error === "priceChanged") {
          setServerError("priceChanged");
          router.refresh();
        } else {
          setServerError(
            result.error === "validation" ? "validation" : "server",
          );
        }
      } catch {
        setServerError("server");
      } finally {
        submitting.current = false;
      }
    });
  }

  const inputClass =
    "rounded-none border-night/25 bg-card px-4 py-6 text-night focus-visible:border-gold-deep focus-visible:ring-gold-deep/40";

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]"
      noValidate
    >
      <div className="space-y-10">
        {/* Contact */}
        <div>
          <fieldset className="space-y-5">
            <legend className="eyebrow mb-4 text-gold-deep">
              {t("contactTitle")}
            </legend>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-night/80">
                {t("name")}
              </Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={NAME_MIN}
                maxLength={NAME_MAX}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={inputClass}
              />
              <FieldError id="name-error">{errors.name}</FieldError>
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
                  maxLength={EMAIL_MAX}
                  aria-invalid={!!errors.email}
                  aria-describedby={
                    errors.email ? "email-hint email-error" : "email-hint"
                  }
                  autoComplete="email"
                  dir="ltr"
                  className={inputClass}
                />
                <p id="email-hint" className="text-xs leading-5 text-night/70">
                  {t("emailHint")}
                </p>
                <FieldError id="email-error">{errors.email}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-night/80">
                  {t("phone")}
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  maxLength={16}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="07X XXX XXXX"
                  className={inputClass}
                />
                <FieldError id="phone-error">{errors.phone}</FieldError>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Delivery */}
        <div>
          <fieldset className="space-y-5">
            <legend className="eyebrow mb-4 text-gold-deep">
              {t("deliveryTitle")}
            </legend>
            <div className="grid gap-5 sm:grid-cols-[0.6fr_1.4fr]">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-night/80">
                  {t("city")}
                </Label>
                <Input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  required
                  minLength={CITY_MIN}
                  maxLength={CITY_MAX}
                  aria-invalid={!!errors.city}
                  aria-describedby={errors.city ? "city-error" : undefined}
                  className={inputClass}
                />
                <FieldError id="city-error">{errors.city}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-night/80">
                  {t("address")}
                </Label>
                <Input
                  id="address"
                  name="address"
                  autoComplete="street-address"
                  required
                  minLength={ADDRESS_MIN}
                  maxLength={ADDRESS_MAX}
                  aria-invalid={!!errors.address}
                  aria-describedby={
                    errors.address ? "address-error" : undefined
                  }
                  className={inputClass}
                />
                <FieldError id="address-error">{errors.address}</FieldError>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Payment */}
        <div>
          <fieldset className="space-y-4">
            <legend className="eyebrow mb-4 text-gold-deep">
              {t("paymentTitle")}
            </legend>
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
                className="h-4 w-4 accent-gold-deep"
              />
              <Banknote className="h-5 w-5 text-gold-deep" />
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
              className="flex items-center gap-4 border border-night/15 bg-card/60 p-5"
            >
              <input
                type="radio"
                name="payment"
                value="card"
                aria-label={t("card")}
                disabled
                className="h-4 w-4"
              />
              <CreditCard className="h-5 w-5 text-night/50" />
              <span className="flex items-center gap-3">
                <span className="text-sm font-medium text-night/70">
                  {t("card")}
                </span>
                <span className="border border-gold/60 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] text-gold-deep">
                  {t("cardSoon")}
                </span>
              </span>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Summary */}
      <aside className="h-fit border border-night/10 bg-card lg:sticky lg:top-28">
        <div className="space-y-5 p-6">
          <div>
            <p className="eyebrow text-gold-deep">{t("orderSummary")}</p>
          </div>
          <div>
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
                      {effectivePrice(product).price * item.qty}{" "}
                      {tCommon("currency")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <CartTotals
              className="border-t border-night/10 pt-4"
              totalClassName="pt-3"
            />
          </div>
          <AnimatePresence initial={false}>
            {serverError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                role="alert"
                className="overflow-hidden border border-wine/40 bg-wine/5 p-3 text-xs text-wine"
              >
                {t(
                  serverError === "soldOut"
                    ? "errSoldOut"
                    : serverError === "priceChanged"
                      ? "errPriceChanged"
                      : serverError === "validation"
                        ? "errValidation"
                        : "errGeneric",
                )}
              </motion.p>
            )}
          </AnimatePresence>
          <div>
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
          </div>
        </div>
      </aside>
    </form>
  );
}
