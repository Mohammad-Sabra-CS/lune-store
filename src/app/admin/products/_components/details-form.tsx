"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoreProduct } from "@/lib/products";
import { saveProductDetails, type AdminActionState } from "../actions";
import { FieldLabel, FormFooter, Panel, fieldClass } from "./form-bits";

export function DetailsForm({ product }: { product: StoreProduct }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    saveProductDetails.bind(null, product.slug),
    {},
  );

  return (
    <Panel title="Details" hint="Shown on the shop, product page and home page.">
      <form action={formAction} className="space-y-5">
        <div>
          <FieldLabel htmlFor="p-name">Name</FieldLabel>
          <Input
            id="p-name"
            name="name"
            defaultValue={product.name}
            maxLength={60}
            required
            className={fieldClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="p-poetry-en">Tagline (English)</FieldLabel>
            <Input
              id="p-poetry-en"
              name="poetryEn"
              defaultValue={product.poetry.en}
              maxLength={200}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-poetry-ar">Tagline (Arabic)</FieldLabel>
            <Input
              id="p-poetry-ar"
              name="poetryAr"
              defaultValue={product.poetry.ar}
              maxLength={200}
              required
              dir="rtl"
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-char-en">Character (English)</FieldLabel>
            <Input
              id="p-char-en"
              name="characterEn"
              defaultValue={product.character.en}
              maxLength={200}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-char-ar">Character (Arabic)</FieldLabel>
            <Input
              id="p-char-ar"
              name="characterAr"
              defaultValue={product.character.ar}
              maxLength={200}
              required
              dir="rtl"
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-desc-en">Description (English)</FieldLabel>
            <Textarea
              id="p-desc-en"
              name="descriptionEn"
              defaultValue={product.description.en}
              maxLength={600}
              required
              rows={4}
              className={fieldClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="p-desc-ar">Description (Arabic)</FieldLabel>
            <Textarea
              id="p-desc-ar"
              name="descriptionAr"
              defaultValue={product.description.ar}
              maxLength={600}
              required
              rows={4}
              dir="rtl"
              className={fieldClass}
            />
          </div>
        </div>

        <FormFooter state={state} pending={pending} />
      </form>
    </Panel>
  );
}
