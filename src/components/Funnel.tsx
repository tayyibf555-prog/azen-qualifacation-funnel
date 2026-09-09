"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as motionReact from "motion/react";
import { STEPS, SCORED_STEPS, interpolate, type Step } from "@/lib/questions";
import type { Answers } from "@/lib/scoring";
import { haptic, spring } from "@/lib/motion";
import { captureAttribution, track, type Attribution } from "@/lib/track";
import { clearProgress, getLeadId, loadProgress, saveProgress } from "@/lib/storage";
import { beaconLead, pushLead } from "@/lib/leads";
import Analysing from "./Analysing";
import Backdrop from "./Backdrop";
import Button from "./Button";
import FieldsStep from "./FieldsStep";
import Interstitial from "./Interstitial";
import Intro from "./Intro";
import Option from "./Option";
import Progress from "./Progress";
import Result from "./Result";
import Wordmark from "./Wordmark";

const { motion, AnimatePresence } = motionReact;

type Phase = "intro" | "steps" | "analysing" | "result";

const CAPTURE_STEP_ID = "capture";
const FINAL_STEP_ID = "final";

/**
 * Screens enter and exit along the same axis, so going back retraces the path
 * forward took. Spatial consistency: nothing arrives from a direction it
 * cannot leave in.
 */
const screenVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0, pointerEvents: "none" as const }),
  // The arriving screen accepts input immediately; waiting for the spring to
  // settle would put latency back on the input path.
  center: { x: 0, opacity: 1, pointerEvents: "auto" as const },
  // The departing screen stops being a target the instant it starts leaving,
  // so nobody taps a ghost of the question they just answered.
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, pointerEvents: "none" as const }),
};

export default function Funnel() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const attribution = useRef<Attribution>({});
  const leadId = useRef<string>("");
  /** Latest answers, readable from unload handlers that never re-render. */
  const answersRef = useRef<Answers>({});
  const completed = useRef(false);
  const lastBeacon = useRef("");
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const step = STEPS[index] as Step | undefined;
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    attribution.current = captureAttribution();
    leadId.current = getLeadId();

    const saved = loadProgress();
    if (saved && Object.keys(saved.answers).length > 0) {
      const resumeAt = STEPS.findIndex((s) => s.id === saved.stepId);
      if (resumeAt > 0) {
        setAnswers(saved.answers);
        setIndex(resumeAt);
        setPhase("steps");
      }
    }
  }, []);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  /**
   * A lead who leaves mid-funnel is still a lead. Once we have their email,
   * the last thing the tab does on its way out is save where they got to.
   */
  useEffect(() => {
    function flush() {
      if (document.visibilityState !== "hidden") return;
      if (completed.current) return;
      if (!answersRef.current.email) return;

      // Tabbing away and back from the same spot is one abandonment, not six.
      const spot = `${indexRef.current}:${Object.keys(answersRef.current).length}`;
      if (spot === lastBeacon.current) return;
      lastBeacon.current = spot;

      beaconLead({
        leadId: leadId.current,
        stage: "abandoned",
        answers: answersRef.current,
        attribution: attribution.current,
        stepId: STEPS[indexRef.current]?.id,
      });
    }

    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const answeredCount = useMemo(
    () => SCORED_STEPS.filter((s) => STEPS.indexOf(s) < index).length,
    [index],
  );
  const progress = answeredCount / SCORED_STEPS.length;
  const stepNumber = Math.min(answeredCount + 1, SCORED_STEPS.length);

  const goTo = useCallback(
    (next: number, dir: number) => {
      setDirection(dir);
      setIndex(next);
      const target = STEPS[next];
      if (target) saveProgress(answers, target.id);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    },
    [answers],
  );

  const advance = useCallback(
    (from: number) => {
      if (from >= STEPS.length - 1) return;
      goTo(from + 1, 1);
    },
    [goTo],
  );

  function handleBack() {
    clearTimeout(advanceTimer.current);
    haptic(6);
    if (index === 0) {
      setDirection(-1);
      setPhase("intro");
      return;
    }
    goTo(index - 1, -1);
  }

  function handleStart() {
    track("QuizStart", { funnel: "azen-qualifier" });
    setDirection(1);
    setPhase("steps");
    setIndex(0);
  }

  /** Saves the answer, then backs it up if we already know who they are. */
  function recordAnswer(stepId: string, value: string | string[]) {
    const next: Answers = { ...answersRef.current, [stepId]: value };
    setAnswers(next);
    answersRef.current = next;
    saveProgress(next, stepId);

    // Every answer after the email capture updates the same sheet row, so an
    // abandoner is always saved at the furthest point they reached. Once they
    // have finished, nothing may push a partial again and demote the row.
    if (next.email && !completed.current) {
      void pushLead({
        leadId: leadId.current,
        stage: "partial",
        answers: next,
        attribution: attribution.current,
        stepId,
      });
    }
  }

  function handleSingle(stepId: string, choiceId: string) {
    recordAnswer(stepId, choiceId);
    track("QuizStep", { step: stepId, answer: choiceId, position: stepNumber });

    // Just long enough for the selection to register visually, no longer.
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => advance(index), 220);
  }

  function handleMultiToggle(stepId: string, choiceId: string, max: number) {
    const current = Array.isArray(answers[stepId]) ? (answers[stepId] as string[]) : [];
    const next = current.includes(choiceId)
      ? current.filter((id) => id !== choiceId)
      : current.length >= max
        ? [...current.slice(1), choiceId]
        : [...current, choiceId];
    recordAnswer(stepId, next);
  }

  async function submitLead(finalAnswers: Answers) {
    setBusy(true);
    completed.current = true;
    // The event id ties this to the server-side Conversions API event so Meta
    // counts one conversion, not two.
    track("Lead", { funnel: "azen-qualifier", currency: "GBP", value: 1 }, `${leadId.current}_complete`);

    try {
      await pushLead({
        leadId: leadId.current,
        stage: "complete",
        answers: finalAnswers,
        attribution: attribution.current,
        stepId: FINAL_STEP_ID,
      });
    } finally {
      // A network hiccup must not cost them their result.
      setBusy(false);
      setPhase("analysing");
    }
  }

  function handleFields(stepId: string, values: Record<string, string>) {
    const merged: Answers = { ...answers, ...values };
    setAnswers(merged);
    saveProgress(merged, stepId);
    answersRef.current = merged;
    track("QuizStep", { step: stepId, position: stepNumber });

    if (stepId === FINAL_STEP_ID) {
      void submitLead(merged);
      return;
    }

    if (stepId === CAPTURE_STEP_ID) {
      // The moment that turns an anonymous visitor into a recoverable lead.
      track("CompleteRegistration", { funnel: "azen-qualifier" }, `${leadId.current}_capture`);
      void pushLead({
        leadId: leadId.current,
        stage: "partial",
        answers: merged,
        attribution: attribution.current,
        stepId,
      });
    }

    advance(index);
  }

  function handleBooked() {
    completed.current = true;
    clearProgress();
    track("Schedule", { funnel: "azen-qualifier" }, `${leadId.current}_booked`);
    void pushLead({
      leadId: leadId.current,
      stage: "booked",
      answers: answersRef.current,
      attribution: attribution.current,
    });
  }

  if (phase === "intro") {
    return (
      <main className="relative">
        <Backdrop />
        <div className="mx-auto w-full max-w-2xl lg:max-w-3xl">
          <Intro onStart={handleStart} />
        </div>
      </main>
    );
  }

  if (phase === "result") {
    return (
      <main className="relative">
        <Backdrop />
        <div className="mx-auto w-full max-w-2xl px-6 pb-28 pt-10 sm:px-10">
          <Result answers={answers} onBooked={handleBooked} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative">
      <Backdrop />

      <div className="mx-auto grid w-full max-w-6xl lg:grid-cols-[0.8fr_1fr] lg:gap-16 lg:px-10">
        <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-[100svh] lg:flex-col lg:justify-between lg:py-14">
          <Wordmark />

          <div>
            <p className="max-w-[16ch] text-balance text-[clamp(2rem,2.6vw,2.8rem)] font-semibold leading-[1.06] tracking-[-0.028em] text-ink">
              Most of what eats your week
              <span className="block text-blue-hi">no longer needs a person.</span>
            </p>
            <p className="mt-7 max-w-[38ch] text-[15px] leading-relaxed text-ink-3">
              We build the infrastructure that takes it over, then hand you the keys. No retainer
              you can&rsquo;t leave, no black box.
            </p>
          </div>

          <p className="t-caption text-ink-3">
            {stepNumber} of {SCORED_STEPS.length} &middot; about a minute left
          </p>
        </aside>

        <div className="flex min-h-[100svh] flex-col px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-4 sm:px-10 lg:px-0 lg:py-14">
          {/* Floating chrome: content passes beneath it rather than being cut off by it. */}
          <header className="material-chrome sticky top-0 z-20 -mx-6 px-6 pb-3 pt-3 sm:-mx-10 sm:px-10 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:backdrop-blur-none">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                className="-ml-2 flex items-center gap-1 rounded-full px-2 py-1.5 text-[14px] text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                <svg viewBox="0 0 14 14" className="size-4" fill="none">
                  <path d="M8.6 3 4.6 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>

              <span className="t-caption tabular-nums text-ink-3 lg:hidden">
                {stepNumber} of {SCORED_STEPS.length}
              </span>
            </div>

            <Progress value={progress} />
          </header>

          {/* Scroll edge effect in place of a hard divider under the chrome. */}
          <div
            aria-hidden
            className="pointer-events-none sticky top-[68px] z-10 -mx-6 h-6 sm:-mx-10 lg:hidden"
            style={{ background: "linear-gradient(to bottom, #020202, transparent)" }}
          />

          {phase === "analysing" ? (
            <Analysing onDone={() => setPhase("result")} />
          ) : (
            <div className="relative flex flex-1 flex-col">
              <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                <motion.div
                  key={step?.id ?? "none"}
                  custom={direction}
                  variants={screenVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={spring.move}
                  style={{ willChange: "transform" }}
                  className="flex flex-1 flex-col"
                >
                  {step?.kind === "interstitial" ? (
                    <Interstitial
                      eyebrow={step.eyebrow}
                      headline={interpolate(step.headline, answers)}
                      body={interpolate(step.body, answers)}
                      cta={step.cta}
                      onContinue={() => advance(index)}
                    />
                  ) : step ? (
                    <div className="flex flex-1 flex-col pt-8">
                      <p className="t-eyebrow text-blue-hi">{step.eyebrow}</p>

                      <h2 id={`${step.id}-question`} className="t-title mt-3.5 max-w-[18ch] text-ink">
                        {step.question}
                      </h2>

                      {step.help ? (
                        <p className="mt-4 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-3">
                          {step.help}
                        </p>
                      ) : null}

                      {step.kind === "single" ? (
                        <div
                          role="group"
                          aria-labelledby={`${step.id}-question`}
                          className="mt-8 space-y-2.5 pb-10"
                        >
                          {step.choices.map((choice) => (
                            <Option
                              key={choice.id}
                              label={choice.label}
                              sub={choice.sub}
                              selected={answers[step.id] === choice.id}
                              onSelect={() => handleSingle(step.id, choice.id)}
                            />
                          ))}
                        </div>
                      ) : null}

                      {step.kind === "multi" ? (
                        <>
                          <p aria-live="polite" className="t-eyebrow mt-7 text-ink-3">
                            {(Array.isArray(answers[step.id]) ? (answers[step.id] as string[]).length : 0)} of{" "}
                            {step.max} chosen
                            {Array.isArray(answers[step.id]) &&
                            (answers[step.id] as string[]).length >= step.max
                              ? " · picking another swaps the first"
                              : ""}
                          </p>

                          <div
                            role="group"
                            aria-labelledby={`${step.id}-question`}
                            className="mt-3 space-y-2.5"
                          >
                            {step.choices.map((choice) => {
                              const picked = Array.isArray(answers[step.id])
                                ? (answers[step.id] as string[]).includes(choice.id)
                                : false;
                              return (
                                <Option
                                  key={choice.id}
                                  multi
                                  label={choice.label}
                                  sub={choice.sub}
                                  selected={picked}
                                  onSelect={() => handleMultiToggle(step.id, choice.id, step.max)}
                                />
                              );
                            })}
                          </div>

                          <div className="material-chrome sticky bottom-0 mt-8 -mx-6 px-6 pb-3 pt-4 sm:-mx-10 sm:px-10 lg:mx-0 lg:px-0">
                            <Button
                              onClick={() => advance(index)}
                              disabled={
                                !Array.isArray(answers[step.id]) ||
                                (answers[step.id] as string[]).length === 0
                              }
                            >
                              Continue
                            </Button>
                          </div>
                        </>
                      ) : null}

                      {step.kind === "fields" ? (
                        <div className="pb-14">
                          <FieldsStep
                            fields={step.fields}
                            cta={step.cta}
                            busy={busy}
                            values={answers as Record<string, string>}
                            onSubmit={(values) => handleFields(step.id, values)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
