import { cn } from "@/lib/utils";

/**
 * Lune aurora backdrop: drifting luminous curtains of navy, violet and gold
 * over the night base, beneath a faint star field. Pure CSS — no JS.
 * Parent must be `relative overflow-hidden` with a dark background.
 */
export function AuroraBackground({
  intensity = "hero",
  className,
}: {
  /** "hero" = full curtains; "subtle" = quieter, for secondary sections */
  intensity?: "hero" | "subtle";
  className?: string;
}) {
  const hero = intensity === "hero";
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <div
        className={cn(
          "aurora-blob aurora-1",
          hero
            ? "-top-1/4 -start-1/4 h-[85%] w-[80%]"
            : "-top-1/3 -start-1/5 h-[70%] w-[60%] opacity-70",
        )}
      />
      <div
        className={cn(
          "aurora-blob aurora-2",
          hero
            ? "top-[15%] -end-1/4 h-[80%] w-[70%]"
            : "top-1/4 -end-1/5 h-[65%] w-[55%] opacity-70",
        )}
      />
      <div
        className={cn(
          "aurora-blob aurora-3",
          hero
            ? "bottom-[-20%] start-[20%] h-[70%] w-[65%]"
            : "bottom-[-25%] start-1/3 h-[55%] w-[50%] opacity-60",
        )}
      />
      <div className="starfield absolute inset-0" />
      {/* Scrim keeping the text zone readable over the moving color */}
      <div className="absolute inset-0 bg-gradient-to-b from-night/45 via-transparent to-night/55" />
    </div>
  );
}
