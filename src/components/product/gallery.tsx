"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] overflow-hidden border border-night/10 bg-night">
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${name} — ${i + 1}`}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 90vw, 45vw"
            className={cn(
              "object-cover transition-opacity duration-500",
              i === active ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`${name} ${i + 1}`}
            className={cn(
              "relative h-20 w-16 overflow-hidden border transition-all duration-300",
              i === active
                ? "border-gold"
                : "border-night/10 opacity-60 hover:opacity-100",
            )}
          >
            <Image src={src} alt="" fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
