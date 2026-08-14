"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Primitives that server-render a hidden inline style keep the CSS
 * `reveal-fallback` class (globals.css) until hydration: if client JS never
 * runs, the fallback animation force-reveals the content at 2.5s instead of
 * leaving a blank page. Removed on mount so Motion owns the normal path.
 */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * Direction-aware x helper. Horizontal motion must go through dx() so it
 * mirrors under RTL; prefer y/opacity/scale/clip-path, which need no flip.
 */
export function useDir() {
  const isRtl = useLocale() === "ar";
  return { isRtl, dx: (v: number) => (isRtl ? -v : v) };
}

export const revealContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

/** Scroll-triggered stagger container. Children: RevealItem / LineReveal. */
export function Reveal({
  children,
  className,
  amount = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  amount?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={revealContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

/** Load-time stagger container for above-the-fold hero content. */
export function HeroReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={revealContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

/** Fade + rise item inside a Reveal/HeroReveal container. */
export function RevealItem({
  children,
  className,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return (
    <motion.div
      className={cn(!hydrated && "reveal-fallback", className)}
      variants={{
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Headline line rising out of an overflow clip. Works standalone or as a
 *  variants child inside Reveal/HeroReveal (omit `standalone`). */
export function LineReveal({
  children,
  className,
  delay = 0,
  standalone = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  standalone?: boolean;
}) {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const hidden = reduce ? { opacity: 1 } : { y: "115%" as const };
  const show = {
    opacity: 1,
    y: 0,
    // No default delay — an explicit delay would override the parent
    // stagger slot when used as a variants child.
    transition: { duration: 0.9, ease: EASE, ...(delay ? { delay } : {}) },
  };
  return (
    // Extra clip padding (offset by negative margins) so tall glyphs —
    // Arabic ascenders/descenders, diacritics — aren't cut by the reveal.
    <span
      className={cn(
        "block overflow-hidden pt-[0.12em] pb-[0.18em] -mt-[0.12em] -mb-[0.18em]",
        className,
      )}
    >
      <motion.span
        className={cn("block", !hydrated && "reveal-fallback")}
        {...(standalone
          ? { initial: reduce ? false : hidden, whileInView: show, viewport: { once: true, amount: 0.6 } }
          : { variants: { hidden, show } })}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Scroll-triggered fade + rise, fires once. For one-off elements outside a
 *  Reveal container. */
export function FadeUp({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return (
    <motion.div
      className={cn(!hydrated && "reveal-fallback", className)}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Slow perpetual floating, like something adrift in still water. */
export function Float({
  children,
  className,
  amplitude = 10,
  duration = 6,
}: {
  children: React.ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [0, -amplitude, 0] }}
      transition={
        reduce ? undefined : { duration, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {children}
    </motion.div>
  );
}

/** Gentle scroll parallax for imagery. useTransform styles bypass
 *  MotionConfig's reducedMotion, so the guard here is load-bearing. */
export function Parallax({
  children,
  className,
  range = 36,
}: {
  children: React.ReactNode;
  className?: string;
  range?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [range, -range]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}

/** Image unveiled by a retracting clip — direction-neutral (top-down).
 *  The observed element must stay un-clipped: a fully clipped element
 *  reports 0% visibility to IntersectionObserver, so observing the clipped
 *  node itself deadlocks (reveal never fires, lazy images never load).
 *  Hence: outer div is watched, inner child carries the clip. */
export function ClipReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <motion.div
        className={cn("h-full w-full", !hydrated && "clip-reveal-fallback")}
        variants={{
          hidden: reduce ? {} : { clipPath: "inset(0 0 100% 0)" },
          show: {
            clipPath: "inset(0 0 0% 0)",
            transition: { duration: 1.1, ease: EASE },
          },
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
