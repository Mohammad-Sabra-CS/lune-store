"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StoreProduct } from "@/lib/products";
import { saveProductPricing, type AdminActionState } from "../actions";
import { FieldLabel, FormFooter, Panel, fieldClass } from "./form-bits";

/** ISO (UTC) → datetime-local value in Amman time (fixed UTC+3). */
function isoToAmman(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 16);
}

export function PricingForm({ product }: { product: StoreProduct }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    saveProductPricing.bind(null, product.slug),
    {},
  );

  return (
    <Panel
      title="Pricing & sale"
      hint="Sale shows a crossed-out price and badge, and ends automatically. Times are Amman time."
    >
      <form action={formAction} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="p-base">Base price (JD)</FieldLabel>
            <Input
              id="p-base"
              name="basePrice"
              type="number"
              min={1}
              max={999}
              step={1}
              defaultValue={product.price}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-sale">Sale price (JD, optional)</FieldLabel>
            <Input
              id="p-sale"
              name="salePrice"
              type="number"
              min={1}
              max={999}
              step={1}
              defaultValue={product.salePrice ?? ""}
              placeholder="—"
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-sale-start">Sale starts (optional)</FieldLabel>
            <input
              id="p-sale-start"
              name="saleStartsAt"
              type="datetime-local"
              defaultValue={isoToAmman(product.saleStartsAt)}
              className={`h-9 w-full border ${fieldClass}`}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-sale-end">Sale ends (optional)</FieldLabel>
            <input
              id="p-sale-end"
              name="saleEndsAt"
              type="datetime-local"
              defaultValue={isoToAmman(product.saleEndsAt)}
              className={`h-9 w-full border ${fieldClass}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FormFooter state={state} pending={pending} />
          {product.salePrice != null && (
            <Button
              type="submit"
              name="clear"
              value="1"
              variant="outline"
              disabled={pending}
              className="rounded-none border-wine/40 text-xs uppercase tracking-wider text-wine hover:bg-wine/5"
            >
              End sale now
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
