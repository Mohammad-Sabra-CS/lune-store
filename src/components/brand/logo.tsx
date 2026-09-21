import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Lune crescent mark: two interlocking crescents with a four-point star,
 * echoing the brand's gold-on-black lunar emblem.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/products/lune-emblem.jpg"
      alt=""
      aria-hidden
      width={48}
      height={46}
      sizes="48px"
      className={cn("h-8 w-8 object-contain mix-blend-screen", className)}
    />
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-2xl tracking-[0.18em] uppercase leading-none",
        className,
      )}
    >
      Lune
    </span>
  );
}
