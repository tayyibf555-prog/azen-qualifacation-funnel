"use client";

import * as motionReact from "motion/react";
import { spring } from "@/lib/motion";

const { motion } = motionReact;

export default function Progress({ value }: { value: number }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-hairline-2">
      <motion.div
        className="h-full origin-left rounded-full bg-blue"
        initial={false}
        animate={{ scaleX: Math.max(0.012, Math.min(1, value)) }}
        transition={spring.move}
        style={{ willChange: "transform" }}
      />
    </div>
  );
}
