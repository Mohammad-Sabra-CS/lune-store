import { cn } from "@/lib/utils";

export type MoonPhase = "crescent" | "half" | "gibbous" | "full";

/**
 * Chapter glyphs: the four packages as four phases of one moon.
 * Drawn with a dark occluding disc sliding off a gold disc.
 */
export function MoonPhaseGlyph({
  phase,
  className,
}: {
  phase: MoonPhase;
  className?: string;
}) {
  const occlusion: Record<MoonPhase, number> = {
    crescent: 7,
    half: 11,
    gibbous: 15,
    full: 26,
  };
  const cx = occlusion[phase];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-5 w-5 text-gold", className)}
    >
      <defs>
        <mask id={`moon-${phase}`}>
          <rect width="24" height="24" fill="white" />
          <circle cx={cx} cy="10.5" r="9" fill="black" />
        </mask>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="currentColor"
        mask={`url(#moon-${phase})`}
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
    </svg>
  );
}
