"use client";

import * as motionReact from "motion/react";
import { spring } from "@/lib/motion";
import Button from "./Button";
import Wordmark from "./Wordmark";

const { motion } = motionReact;

const POINTS = [
  "Built for businesses turning over £10k a month and up",
  "No jargon, no demo, no sixty-slide deck",
  "If it isn't worth building, we'll tell you that instead",
];

/** Children rise in sequence, each on the same critically damped spring. */
function Rise({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.move, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[100svh] flex-col px-6 pb-[max(30px,env(safe-area-inset-bottom))] pt-8 sm:px-10">
      <Rise>
        <Wordmark />
      </Rise>

      <div className="flex flex-1 flex-col justify-center py-14">
        <Rise delay={0.05}>
          <p className="t-eyebrow text-blue-hi">Custom AI infrastructure</p>
        </Rise>

        <Rise delay={0.1}>
          <h1 className="t-display mt-5 max-w-[13ch] text-ink">
            What is your business still doing by hand?
          </h1>
        </Rise>

        <Rise delay={0.17}>
          <p className="t-body mt-7 max-w-[46ch] text-ink-2">
            Ten questions, about a minute. You get a plain-English breakdown of the work
            your team no longer needs to do, and roughly what it&rsquo;s costing you in hours.
          </p>
        </Rise>

        <Rise delay={0.24}>
          <ul className="mt-10 space-y-3.5 border-t border-hairline pt-8">
            {POINTS.map((line) => (
              <li key={line} className="flex gap-3 text-[14.5px] leading-snug text-ink-3">
                <svg viewBox="0 0 14 14" className="mt-[3px] size-3.5 shrink-0 text-blue" fill="none">
                  <path d="M2.5 7.4 5.6 10.5 11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {line}
              </li>
            ))}
          </ul>
        </Rise>
      </div>

      <Rise delay={0.32}>
        <div className="w-full max-w-md">
          <Button onClick={onStart}>Start &mdash; takes 60 seconds</Button>
          <p className="t-caption mt-4 text-center text-ink-3 sm:text-left">
            Your answers stay between us. No list, no spam.
          </p>
        </div>
      </Rise>
    </div>
  );
}
