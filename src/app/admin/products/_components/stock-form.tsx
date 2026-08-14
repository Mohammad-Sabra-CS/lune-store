"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import type { StoreProduct } from "@/lib/products";
import { saveProductStock, type AdminActionState } from "../actions";
import { FieldLabel, FormFooter, Panel, fieldClass } from "./form-bits";

export function StockForm({ product }: { product: StoreProduct }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    saveProductStock.bind(null, product.slug),
    {},
  );

  return (
    <Panel
      title="Stock"
      hint="At 0 the package shows “Sold out” and can no longer be ordered."
    >
      <form action={formAction} className="space-y-5">
        <div className="max-w-40">
          <FieldLabel htmlFor="p-stock">Quantity available</FieldLabel>
          <Input
            id="p-stock"
            name="stock"
            type="number"
            min={0}
            max={9999}
            step={1}
            defaultValue={product.stock}
            required
            className={fieldClass}
          />
        </div>
        <FormFooter state={state} pending={pending} />
      </form>
    </Panel>
  );
}
