import type { Transition } from "motion/react";

/**
 * Apple's two spring parameters, mapped onto Motion's bounce + duration.
 * Damping 1.0 (critically damped, no overshoot) is the default for UI;
 * bounce is reserved for motion the user's own gesture put in flight.
 */
export const spring = {
  /** Move / reposition. Apple: damping 1.0, response 0.4. */
  move: { type: "spring", bounce: 0, duration: 0.42 } satisfies Transition,
  /** Snappier reposition for small elements. */
  quick: { type: "spring", bounce: 0, duration: 0.3 } satisfies Transition,
  /** Sheets and drawers. Apple: damping 0.8, response 0.3. */
  sheet: { type: "spring", bounce: 0.18, duration: 0.34 } satisfies Transition,
  /** Press feedback. Fast enough to feel like contact, not animation. */
  press: { type: "spring", bounce: 0, duration: 0.16 } satisfies Transition,
} as const;

/**
 * Utility-only haptics: commit moments, never decoration. Silently absent on
 * hardware that can't do it, which is most desktops.
 */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* blocked by the platform */
  }
}

/**
 * Apple's momentum projection from Designing Fluid Interfaces: where a flick
 * would come to rest, given its release velocity.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
