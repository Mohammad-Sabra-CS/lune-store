"use client";

import { MotionConfig } from "motion/react";

/** Globally honors prefers-reduced-motion for JS-driven animations.
 *  Scroll-linked styles and SVG attribute timelines still need their own
 *  useReducedMotion guards. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
