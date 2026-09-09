"use client";

import { useEffect, useMemo, useState } from "react";
import * as motionReact from "motion/react";
import { buildReadout, scoreAnswers, type Answers } from "@/lib/scoring";
import { haptic, spring } from "@/lib/motion";
import { track } from "@/lib/track";
import Calendly from "./Calendly";

const { motion } = motionReact;

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL;

function Rise({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.move, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function Result({ answers, onBooked }: { answers: Answers; onBooked: () => void }) {
  const [booked, setBooked] = useState(false);

  const readout = useMemo(() => buildReadout(answers), [answers]);
  const scored = useMemo(() => scoreAnswers(answers), [answers]);

  const firstName = typeof answers.firstName === "string" ? answers.firstName : "";
  const email = typeof answers.email === "string" ? answers.email : "";
  const business = typeof answers.businessName === "string" ? answers.businessName : "your business";

  useEffect(() => {
    track("QuizResult", { score: scored.score, tier: scored.tier });
  }, [scored.score, scored.tier]);

  function handleScheduled() {
    if (booked) return;
    setBooked(true);
    haptic([12, 40, 18]);
    // The Schedule conversion is fired by the funnel, which holds the event id.
    onBooked();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="py-12">
      <Rise>
        <p className="t-eyebrow text-blue-hi">{firstName ? `${firstName}, your breakdown` : "Your breakdown"}</p>
      </Rise>

      <Rise delay={0.06}>
        <h2 className="t-title mt-4 max-w-[17ch] text-ink">Here&rsquo;s what goes first at {business}.</h2>
      </Rise>

      <Rise delay={0.13}>
        <p className="mt-8 max-w-[24ch] text-[clamp(1.5rem,5.2vw,2rem)] font-semibold leading-[1.2] tracking-[-0.024em] text-ink-2">
          Around <span className="text-blue-hi">{readout.hoursLow} to {readout.hoursHigh} hours a week</span> are
          going into work a system can take over.
        </p>
      </Rise>

      <Rise delay={0.2}>
        <p className="t-caption mt-5 max-w-[52ch] text-ink-3">
          A rough estimate from what you told us about team size and where the time goes. We
          pressure-test it properly on the call, with your actual numbers.
        </p>
      </Rise>

      <ol className="mt-14 border-t border-hairline">
        {readout.systems.map((system, i) => (
          <motion.li
            key={system.name}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.move, delay: 0.28 + i * 0.07 }}
            className="flex gap-5 border-b border-hairline py-7"
          >
            <span className="mt-[3px] text-[13px] font-semibold tabular-nums tracking-[0.02em] text-blue-hi">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="t-headline text-ink">{system.name}</h3>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-ink-3">{system.blurb}</p>
            </div>
          </motion.li>
        ))}
      </ol>

      <div className="mt-16">
        {booked ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={spring.sheet}
            className="rounded-[22px] border border-blue/40 bg-blue/8 px-6 py-12 text-center"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ ...spring.sheet, delay: 0.1 }}
              className="mx-auto grid size-12 place-items-center rounded-full bg-blue text-white"
            >
              <svg viewBox="0 0 16 16" className="size-5" fill="none">
                <path d="M3 8.4 6.4 11.8 13 5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <h3 className="t-title mt-6 text-ink">You&rsquo;re booked in.</h3>
            <p className="t-body mx-auto mt-4 max-w-[38ch] text-ink-2">
              Confirmation is on its way to {email || "your inbox"}. We&rsquo;ll have read up on{" "}
              {business} before we speak, so bring the awkward questions.
            </p>
          </motion.div>
        ) : (
          <>
            <Rise delay={0.4}>
              <h3 className="t-title max-w-[18ch] text-ink">Pick a time and we&rsquo;ll walk you through it.</h3>
              <p className="t-body mt-4 max-w-[46ch] text-ink-2">
                Twenty minutes. We map the first system, tell you what it costs to build, and you
                decide. No deck, no follow-up sequence.
              </p>
            </Rise>

            <Rise delay={0.48}>
              <div className="mt-9">
                {CALENDLY_URL ? (
                  <Calendly url={CALENDLY_URL} prefill={{ name: firstName, email }} onScheduled={handleScheduled} />
                ) : (
                  <div className="rounded-[22px] border border-dashed border-hairline-2 px-6 py-14 text-center">
                    <p className="t-body text-ink-2">Booking calendar not connected yet.</p>
                    <p className="t-caption mx-auto mt-3 max-w-[42ch] text-ink-3">
                      Set <code className="text-blue-hi">NEXT_PUBLIC_CALENDLY_URL</code> in your
                      environment to your Calendly event link, then redeploy.
                    </p>
                  </div>
                )}
              </div>
            </Rise>
          </>
        )}
      </div>
    </div>
  );
}
