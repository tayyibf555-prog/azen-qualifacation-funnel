import type { Answers } from "./scoring";
import type { Attribution } from "./track";
import { metaCookies } from "./track";

export type Stage = "partial" | "complete" | "booked" | "abandoned";

/**
 * Pushes arrive out of order if the network hiccups, so each carries a
 * sequence number and the sheet ignores anything older than what it holds.
 */
let sequence = 0;

/** Re-tapping an answer they already picked is not new information. */
let lastPartialKey = "";

type PushInput = {
  leadId: string;
  stage: Stage;
  answers: Answers;
  attribution: Attribution;
  stepId?: string;
};

function payload({ leadId, stage, answers, attribution, stepId }: PushInput) {
  return {
    leadId,
    stage,
    stepId,
    seq: ++sequence,
    answers,
    attribution,
    meta: {
      ...metaCookies(),
      sourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
    },
  };
}

/** Fire-and-forget: the funnel must never wait on a save to move on. */
export function pushLead(input: PushInput): Promise<{ leadId?: string } | null> {
  if (!input.answers.email) return Promise.resolve(null);

  if (input.stage === "partial") {
    const key = JSON.stringify(input.answers);
    if (key === lastPartialKey) return Promise.resolve(null);
    lastPartialKey = key;
  }

  return fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload(input)),
    keepalive: true,
  })
    .then((res) => res.json())
    .catch(() => null);
}

/**
 * The last write before the tab goes away. sendBeacon survives unload where a
 * normal fetch is cancelled, which is exactly when an abandoner leaves.
 */
export function beaconLead(input: PushInput): boolean {
  if (typeof navigator === "undefined" || !input.answers.email) return false;

  const blob = new Blob([JSON.stringify(payload(input))], { type: "application/json" });

  try {
    if (typeof navigator.sendBeacon === "function") return navigator.sendBeacon("/api/lead", blob);
  } catch {
    /* fall through */
  }

  try {
    void fetch("/api/lead", { method: "POST", body: blob, keepalive: true });
    return true;
  } catch {
    return false;
  }
}
