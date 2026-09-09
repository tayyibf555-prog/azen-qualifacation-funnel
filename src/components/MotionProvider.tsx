"use client";

import * as motionReact from "motion/react";

const { MotionConfig } = motionReact;

/**
 * Motion ignores prefers-reduced-motion unless told to honour it. With "user",
 * transforms are dropped and opacity is kept, which is the gentler equivalent
 * rather than no feedback at all.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
