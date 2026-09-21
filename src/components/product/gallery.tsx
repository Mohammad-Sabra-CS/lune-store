"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const t = useTranslations("product");
  const [active, setActive] = useState(0);
  const selected = images[active] ?? images[0];
  if (!selected) return null;
  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] overflow-hidden border border-night/10 bg-night">
        <Image
          key={selected}
          src={selected}
          alt={`${name} — ${active + 1}`}
          fill
          preload={active === 0}
          sizes="(max-width: 1024px) 90vw, 45vw"
          className="object-contain"
        />
        <span
          aria-hidden
          className="absolute bottom-4 end-4 bg-night/80 px-3 py-1.5 text-xs tabular-nums text-moon"
        >
          {active + 1} / {images.length}
        </span>
      </div>
      <div
        className="flex flex-wrap gap-3"
        role="group"
        aria-label={t("galleryLabel", { name })}
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(i)}
            aria-label={t("galleryImageLabel", { name, index: i + 1 })}
            aria-pressed={i === active}
            className={cn(
              "relative h-20 w-16 overflow-hidden border-2 bg-night transition-opacity",
              i === active
                ? "border-gold-deep opacity-100"
                : "border-transparent opacity-65 hover:opacity-100",
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
