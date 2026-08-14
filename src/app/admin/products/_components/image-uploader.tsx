"use client";

import { useActionState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { StoreProduct } from "@/lib/products";
import { replaceProductImage, type AdminActionState } from "../actions";
import { Panel } from "./form-bits";
import { cn } from "@/lib/utils";

function ImageSlot({
  slug,
  slot,
  label,
  src,
}: {
  slug: string;
  slot: "main" | "1" | "2";
  label: string;
  src: string;
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    replaceProductImage.bind(null, slug, slot),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="relative aspect-[4/5] w-full overflow-hidden border border-night/10 bg-night/5">
        <Image
          src={src}
          alt={label}
          fill
          sizes="200px"
          className={cn("object-cover", pending && "opacity-40")}
        />
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              aria-label="Uploading"
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-night/30 border-t-night"
            />
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) formRef.current?.requestSubmit();
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-none border-night/20 text-xs uppercase tracking-wider text-night hover:border-gold hover:bg-gold"
      >
        {pending ? "Uploading…" : "Replace"}
      </Button>
      {!pending && state.error && (
        <p className="text-xs text-wine animate-in fade-in duration-300">
          {state.error}
        </p>
      )}
      {!pending && state.ok && (
        <p className="text-xs text-gold-deep animate-in fade-in duration-300">
          Updated.
        </p>
      )}
    </form>
  );
}

export function ImageUploader({ product }: { product: StoreProduct }) {
  const gallery = [...product.gallery];
  while (gallery.length < 3) gallery.push(product.image);

  return (
    <Panel
      title="Images"
      hint="JPEG, PNG or WebP, up to 4 MB. The main image is used on cards and as the first gallery photo."
    >
      <div className="grid grid-cols-3 gap-4">
        <ImageSlot slug={product.slug} slot="main" label="Main" src={gallery[0]} />
        <ImageSlot slug={product.slug} slot="1" label="Gallery 2" src={gallery[1]} />
        <ImageSlot slug={product.slug} slot="2" label="Gallery 3" src={gallery[2]} />
      </div>
    </Panel>
  );
}
