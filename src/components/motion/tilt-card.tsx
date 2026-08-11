"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Pointer-tracked tilt + cursor glow for product imagery. Inert on touch
 * devices and under reduced motion — renders as a plain wrapper there.
 * Rotation is symmetric, so no RTL flip is needed.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 6,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const reduce = useReducedMotion();
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFinePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const spring = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(0, spring);
  const rotateY = useSpring(0, spring);
  const glowOpacity = useSpring(0, { stiffness: 200, damping: 30 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(20rem circle at ${glowX}% ${glowY}%, rgba(235, 217, 168, 0.18), transparent 70%)`;

  const active = finePointer && !reduce;

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 2 * maxTilt);
    rotateX.set(-(py - 0.5) * 2 * maxTilt);
    glowX.set(px * 100);
    glowY.set(py * 100);
    glowOpacity.set(1);
  }

  function onPointerLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glowOpacity.set(0);
  }

  return (
    <motion.div
      className={cn("relative", className)}
      style={
        active
          ? { rotateX, rotateY, transformPerspective: 900 }
          : undefined
      }
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: glow, opacity: glowOpacity }}
      />
    </motion.div>
  );
}
