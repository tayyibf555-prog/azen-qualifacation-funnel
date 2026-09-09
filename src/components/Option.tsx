"use client";

import { useRef, useState } from "react";
import * as motionReact from "motion/react";
import { haptic, spring } from "@/lib/motion";

const { motion } = motionReact;

type Props = {
  label: string;
  sub?: string;
  selected: boolean;
  multi?: boolean;
  onSelect: () => void;
};

export default function Option({ label, sub, selected, multi = false, onSelect }: Props) {
  const [pressed, setPressed] = useState(false);
  /**
   * The ref, not the state, decides whether a commit is valid: a pointer-down
   * and pointer-up landing in the same tick would otherwise read a stale
   * `pressed` and silently drop the tap.
   */
  const pressing = useRef(false);

  /**
   * Apple's rule: feedback lands on pointer-down, the commit lands on
   * pointer-up, and dragging off the target cancels it.
   */
  function begin() {
    pressing.current = true;
    setPressed(true);
  }

  function cancel() {
    pressing.current = false;
    setPressed(false);
  }

  function commit() {
    if (!pressing.current) return;
    cancel();
    haptic(8);
    onSelect();
  }

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onPointerDown={begin}
      onPointerUp={commit}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          haptic(8);
          onSelect();
        }
      }}
      animate={{ scale: pressed ? 0.977 : 1 }}
      transition={spring.press}
      style={{ willChange: "transform" }}
      className={[
        "group relative flex w-full items-center gap-4 rounded-[18px] border px-5 py-[17px] text-left",
        "transition-colors duration-[220ms] ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ground",
        selected
          ? "border-blue/55 bg-blue/12"
          : "border-hairline bg-surface hover:border-hairline-2 hover:bg-surface-hi",
      ].join(" ")}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16.5px] font-medium leading-snug tracking-[-0.012em] text-ink">
          {label}
        </span>
        {sub ? <span className="mt-1 block text-[13.5px] leading-snug text-ink-3">{sub}</span> : null}
      </span>

      <span
        className={[
          "grid size-[22px] shrink-0 place-items-center rounded-full border transition-colors duration-200",
          selected ? "border-blue bg-blue text-white" : "border-hairline-3",
        ].join(" ")}
      >
        <motion.svg
          viewBox="0 0 12 12"
          fill="none"
          className="size-3"
          initial={false}
          animate={{ scale: selected ? 1 : 0.4, opacity: selected ? 1 : 0 }}
          transition={spring.quick}
        >
          {multi || selected ? (
            <path d="M2.6 6.2 4.9 8.5 9.4 3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </motion.svg>
      </span>
    </motion.button>
  );
}
