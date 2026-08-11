"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Soft moonlight glow that eases toward the pointer over dark hero sections.
 * Stays centered (static) on touch devices and under reduced motion.
 */
export function Spotlight({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const x = useSpring(55, { stiffness: 40, damping: 18 });
  const y = useSpring(30, { stiffness: 40, damping: 18 });

  useEffect(() => {
    if (!finePointer || reduce) return;
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth) * 100);
      y.set((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [finePointer, reduce, x, y]);

  const glow = useMotionTemplate`radial-gradient(46rem circle at ${x}% ${y}%, rgba(235, 217, 168, 0.09), rgba(196, 161, 94, 0.04) 45%, transparent 70%)`;

  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      style={{ backgroundImage: glow }}
    />
  );
}
