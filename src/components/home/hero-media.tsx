"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/** Hero visual: the marble still paints immediately; the 3.8 MB loop video
 *  is kept out of the first-load race entirely — mounted only once the main
 *  thread is idle, faded in when it actually plays, then crossfaded back to
 *  the still after its single run. */
export function HeroMedia() {
  const [mountVideo, setMountVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const cb = () => setMountVideo(true);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(cb, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(cb, 1500);
    return () => clearTimeout(t);
  }, []);

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
      {mountVideo && (
        <video
          src="/hero-loop.mp4"
          autoPlay
          muted
          playsInline
          onPlaying={() => setPlaying(true)}
          onEnded={() => setEnded(true)}
          className={
            "pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700" +
            (playing && !ended ? " opacity-100" : " opacity-0")
          }
        />
      )}
    </div>
  );
}
