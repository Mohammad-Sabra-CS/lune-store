/**
 * Infinite gold ribbon of brand text between sections.
 * Forced LTR (it carries the Latin wordmark) so one keyframe serves both locales.
 * CSS animation pauses automatically under prefers-reduced-motion (global rule).
 */
export function Marquee({ text }: { text: string }) {
  const segment = `${text} · `;
  const run = segment.repeat(6);
  return (
    <div
      dir="ltr"
      aria-hidden
      className="overflow-hidden border-y border-gold/25 bg-night py-4"
    >
      <div className="marquee-track flex w-max whitespace-nowrap">
        {[0, 1].map((i) => (
          <span
            key={i}
            className="font-display text-sm uppercase tracking-[0.45em] text-gold/70"
          >
            {run}
          </span>
        ))}
      </div>
    </div>
  );
}
