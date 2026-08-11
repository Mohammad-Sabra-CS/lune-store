import { cn } from "@/lib/utils";

/**
 * Lune crescent mark: two interlocking crescents with a four-point star,
 * echoing the brand's gold-on-black lunar emblem.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <path
        d="M30 8a14 14 0 1 0 0 28 17 17 0 0 1-9-14 17 17 0 0 1 9-14Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle
        cx="31"
        cy="22"
        r="9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.7"
      />
      <path
        d="M37.5 6.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4Z"
        fill="currentColor"
      />
    </svg>
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
