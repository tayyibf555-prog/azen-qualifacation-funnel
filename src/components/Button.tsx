"use client";

import { useState } from "react";
import * as motionReact from "motion/react";
import { haptic, spring } from "@/lib/motion";

const { motion } = motionReact;

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  tone?: "solid" | "quiet";
};

export default function Button({ children, onClick, type = "button", disabled, tone = "solid" }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={() => {
        if (disabled) return;
        haptic(10);
        onClick?.();
      }}
      animate={{ scale: pressed ? 0.972 : 1, opacity: disabled ? 0.34 : 1 }}
      transition={spring.press}
      style={{ willChange: "transform" }}
      className={[
        "w-full rounded-full px-7 py-[16px] text-[16.5px] font-semibold tracking-[-0.014em]",
        "transition-colors duration-200 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ground",
        tone === "solid"
          ? "bg-blue text-white hover:bg-blue-2"
          : "border border-hairline-2 bg-glass text-ink hover:bg-surface-hi",
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}
