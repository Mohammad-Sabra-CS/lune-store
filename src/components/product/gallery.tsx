"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { EASE } from "@/components/motion/primitives";
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

  return (
    <div className="space-y-4">
      {/* All images stay mounted (preloaded); the active one settles into
          place with a crossfade + gentle zoom. Direction-neutral for RTL. */}
      <div className="relative aspect-[4/5] overflow-hidden border border-night/10 bg-night">
        {images.map((src, i) => (
          <motion.div
            key={src}
            className="absolute inset-0"
            initial={false}
            animate={{
              opacity: i === active ? 1 : 0,
              scale: i === active ? 1 : 1.045,
            }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Image
              src={src}
              alt={`${name} — ${i + 1}`}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="object-cover"
            />
          </motion.div>
        ))}
      </div>
      <div className="flex gap-3">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(i)}
            aria-label={t("galleryImageLabel", { name, index: i + 1 })}
            aria-current={i === active}
            className={cn(
              "relative h-20 w-16 overflow-hidden border border-night/10 transition-opacity duration-300",
              i === active ? "opacity-100" : "opacity-60 hover:opacity-100",
            )}
          >
            <Image src={src} alt="" fill sizes="64px" className="object-cover" />
            {i === active && (
              <motion.span
                layoutId="gallery-thumb-frame"
                className="absolute inset-0 border-2 border-gold"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
