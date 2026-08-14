"use client";

import { useState } from "react";
import Image from "next/image";

/** Hero visual: the video plays once per visit, then crossfades to the
 *  marble still that sits beneath it. */
export function HeroMedia() {
  const [ended, setEnded] = useState(false);

  return (
    <div className="relative aspect-[3/4] overflow-hidden border border-gold/25">
      <Image
        src="/products/hero-marble.jpg"
        alt="Lune Eau de Parfum"
        fill
        priority
        sizes="(max-width: 1024px) 90vw, 40vw"
        className="object-cover"
      />
      <video
        src="/hero-loop.mp4"
        autoPlay
        muted
        playsInline
        onEnded={() => setEnded(true)}
        className={
          "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700" +
          (ended ? " opacity-0" : "")
        }
      />
    </div>
  );
}
