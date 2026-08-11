"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Banknote } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/components/cart/cart-context";
import { getProduct } from "@/data/products";
import { placeOrder } from "@/app/[locale]/checkout/actions";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "city" | "address", string>
>;

export function CheckoutForm() {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "en" | "ar";
  const cart = useCart();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState(false);

  if (cart.items.length === 0 && !isPending) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-lg text-night/60">{tCart("empty")}</p>
        <Button
          className="mt-6 rounded-none bg-night px-8 tracking-[0.2em] uppercase text-moon hover:bg-night-soft"
          onClick={() => router.push("/shop")}
        >
          {tCart("emptyCta")}
        </Button>
      </div>
    );
  }

  function validate(form: FormData): FieldErrors {
    const next: FieldErrors = {};
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    if (name.length < 2) next.name = t("errRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t("errEmail");
    if (!/^\+?[0-9\s-]{8,15}$/.test(phone)) next.phone = t("errPhone");
    if (city.length < 2) next.city = t("errRequired");
    if (address.length < 4) next.address = t("errRequired");
    return next;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    setServerError(false);
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
      } else {
        setServerError(true);
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
      <div className="space-y-10">
        {/* Contact */}
        <fieldset className="space-y-5">
          <legend className="eyebrow mb-4">{t("contactTitle")}</legend>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-night/80">
              {t("name")}
            </Label>
            <Input id="name" name="name" autoComplete="name" className={inputClass} />
            {errors.name && <p className="text-xs text-wine">{errors.name}</p>}
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
              {errors.email && <p className="text-xs text-wine">{errors.email}</p>}
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
              {errors.phone && <p className="text-xs text-wine">{errors.phone}</p>}
            </div>
          </div>
        </fieldset>

        {/* Delivery */}
        <fieldset className="space-y-5">
          <legend className="eyebrow mb-4">{t("deliveryTitle")}</legend>
          <div className="grid gap-5 sm:grid-cols-[0.6fr_1.4fr]">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-night/80">
                {t("city")}
              </Label>
              <Input id="city" name="city" className={inputClass} />
              {errors.city && <p className="text-xs text-wine">{errors.city}</p>}
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
              {errors.address && (
                <p className="text-xs text-wine">{errors.address}</p>
              )}
            </div>
          </div>
        </fieldset>

        {/* Payment */}
        <fieldset className="space-y-4">
          <legend className="eyebrow mb-4">{t("paymentTitle")}</legend>
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
              className="h-4 w-4 accent-[#c9a96a]"
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
      </div>

      {/* Summary */}
      <aside className="h-fit space-y-5 border border-night/10 bg-card p-6 lg:sticky lg:top-28">
        <p className="eyebrow">{t("orderSummary")}</p>
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
                  {product.price * item.qty} {tCommon("currency")}
                </span>
              </li>
            );
          })}
        </ul>
        <dl className="space-y-2 border-t border-night/10 pt-4 text-sm">
          <div className="flex justify-between text-night/70">
            <dt>{tCart("subtotal")}</dt>
            <dd className="tabular-nums">
              {cart.subtotal} {tCommon("currency")}
            </dd>
          </div>
          <div className="flex justify-between text-night/70">
            <dt>{tCart("delivery")}</dt>
            <dd className="tabular-nums">
              {cart.deliveryFee} {tCommon("currency")}
            </dd>
          </div>
          <div className="flex justify-between border-t border-night/10 pt-3 text-base font-medium text-night">
            <dt>{tCart("total")}</dt>
            <dd className="tabular-nums">
              {cart.total} {tCommon("currency")}
            </dd>
          </div>
        </dl>
        {serverError && (
          <p className="border border-wine/40 bg-wine/5 p-3 text-xs text-wine">
            {t("errGeneric")}
          </p>
        )}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full rounded-none bg-night py-7 text-sm tracking-[0.25em] uppercase text-moon transition-colors hover:bg-gold hover:text-night"
        >
          {isPending ? t("placing") : t("placeOrder")}
        </Button>
      </aside>
    </form>
  );
}
