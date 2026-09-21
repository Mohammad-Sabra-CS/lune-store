import Image from "next/image";

/** The supplied still paints immediately, without autoplay or hydration. */
export function HeroMedia() {
  return (
    <Image
      src="/products/lune-men-set-lounge.png"
      alt=""
      fill
      preload
      sizes="(max-width: 1024px) 100vw, 70vw"
      className="object-cover object-center"
    />
  );
}
