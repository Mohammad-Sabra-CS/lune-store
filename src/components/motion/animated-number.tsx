"use client";

import { useEffect } from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

/** Number that springs toward its new value (cart totals, prices). */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 140, damping: 24 });
  const display = useTransform(spring, (v) => String(Math.round(v)));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  if (reduce) {
    return <span className={cn("tabular-nums", className)}>{value}</span>;
  }
  return (
    <motion.span className={cn("tabular-nums", className)}>
      {display}
    </motion.span>
  );
}
