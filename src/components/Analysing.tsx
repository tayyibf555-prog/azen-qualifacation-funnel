"use client";

import { useEffect, useState } from "react";
import * as motionReact from "motion/react";
import { spring } from "@/lib/motion";

const { motion, AnimatePresence } = motionReact;

const LINES = [
  "Reading your answers",
  "Matching against businesses your size",
  "Ranking what to automate first",
  "Estimating hours back per week",
  "Building your breakdown",
];

export default function Analysing({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const stepMs = 600;
    const tick = setInterval(() => setLine((n) => Math.min(n + 1, LINES.length - 1)), stepMs);
    const done = setTimeout(onDone, stepMs * LINES.length + 240);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <div className="relative grid size-14 place-items-center">
        {[0, 1].map((ring) => (
          <motion.span
            key={ring}
            aria-hidden
            className="absolute inset-0 rounded-full border border-blue"
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1.45, opacity: 0 }}
            transition={{ duration: 1.9, repeat: Infinity, delay: ring * 0.65, ease: "easeOut" }}
          />
        ))}
        <span className="size-2.5 rounded-full bg-blue" />
      </div>

      <div aria-live="polite" className="mt-10 h-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={spring.quick}
            className="text-[15.5px] text-ink-2"
          >
            {LINES[line]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-9 h-px w-40 overflow-hidden bg-hairline-2">
        <motion.div
          className="h-full origin-left bg-blue"
          initial={false}
          animate={{ scaleX: (line + 1) / LINES.length }}
          transition={spring.move}
        />
      </div>
    </div>
  );
}
