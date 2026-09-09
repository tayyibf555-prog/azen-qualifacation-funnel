import { STEPS, type Choice } from "./questions";

export type Answers = Record<string, string | string[]>;

/**
 * Relative pull of each question on the final score. Budget, authority and
 * timeline decide whether a call is worth taking; the rest is texture.
 */
const WEIGHTS: Record<string, number> = {
  budget: 28,
  authority: 20,
  timeline: 18,
  revenue: 14,
  teamSize: 10,
  bottleneck: 6,
  tried: 4,
};

function choicesFor(stepId: string): Choice[] {
  const step = STEPS.find((s) => s.id === stepId);
  if (!step || (step.kind !== "single" && step.kind !== "multi")) return [];
  return step.choices;
}

function weightOf(stepId: string, answer: string | string[] | undefined): number {
  if (answer === undefined) return 0;
  const choices = choicesFor(stepId);
  if (Array.isArray(answer)) {
    if (answer.length === 0) return 0;
    // Best-of, not average: picking one high-value bottleneck shouldn't be
    // diluted by also picking a low-value one.
    return Math.max(...answer.map((id) => choices.find((c) => c.id === id)?.weight ?? 0));
  }
  return choices.find((c) => c.id === answer)?.weight ?? 0;
}

export type Tier = "priority" | "qualified" | "nurture";

export type Scored = {
  score: number;
  tier: Tier;
  signals: string[];
};

export function scoreAnswers(answers: Answers): Scored {
  let earned = 0;
  let available = 0;

  for (const [stepId, max] of Object.entries(WEIGHTS)) {
    available += max;
    earned += weightOf(stepId, answers[stepId]) * max;
  }

  const score = available === 0 ? 0 : Math.round((earned / available) * 100);

  const signals: string[] = [];
  if (answers.authority === "someone") signals.push("Not the decision maker");
  if (answers.timeline === "browsing") signals.push("Researching only");
  if (answers.budget === "unsure") signals.push("Budget not set");
  if (answers.revenue === "u10k") signals.push("Sub-£10k monthly revenue");
  if (answers.teamSize === "solo") signals.push("Solo operator");
  if (answers.timeline === "asap") signals.push("Wants it live now");
  if (answers.budget === "5-10k" || answers.budget === "10k+") signals.push("Budget £5k+");
  if (answers.authority === "me") signals.push("Sole decision maker");

  const tier: Tier = score >= 72 ? "priority" : score >= 48 ? "qualified" : "nurture";

  return { score, tier, signals };
}

/* --- Personalised readout ---------------------------------------------- */

type SystemSpec = { name: string; blurb: string; hours: [number, number] };

const SYSTEMS: Record<string, SystemSpec> = {
  admin: {
    name: "Back-office autopilot",
    blurb: "Job data lands once and flows to every system that needs it. No re-typing, no reconciliation evening.",
    hours: [4, 9],
  },
  leads: {
    name: "Speed-to-lead responder",
    blurb: "Every enquiry gets a qualified, human-sounding reply within sixty seconds, day or night.",
    hours: [3, 7],
  },
  followup: {
    name: "Follow-up sequencer",
    blurb: "Sent quotes get chased on a schedule that doesn't depend on anyone remembering.",
    hours: [2, 5],
  },
  quotes: {
    name: "Quote generator",
    blurb: "Scope in, priced proposal out, in your format and your language, in under a minute.",
    hours: [3, 6],
  },
  support: {
    name: "Front-line support agent",
    blurb: "The questions you answer forty times a week get answered without you.",
    hours: [4, 8],
  },
  scheduling: {
    name: "Booking coordinator",
    blurb: "Diary, travel time and job length reconciled automatically, with confirmations and reminders.",
    hours: [2, 6],
  },
  reporting: {
    name: "Live numbers dashboard",
    blurb: "One place that tells you where the month stands, without anyone building a spreadsheet.",
    hours: [2, 4],
  },
  onboarding: {
    name: "Onboarding engine",
    blurb: "New starters get trained by a system that already knows how you do things.",
    hours: [2, 5],
  },
};

const TEAM_MULTIPLIER: Record<string, number> = {
  solo: 0.6,
  "2-5": 1,
  "6-15": 1.5,
  "16-50": 2.1,
  "50+": 2.6,
};

export type Readout = {
  systems: SystemSpec[];
  hoursLow: number;
  hoursHigh: number;
};

export function buildReadout(answers: Answers): Readout {
  const picked = Array.isArray(answers.bottleneck) ? answers.bottleneck : [];
  const systems = picked.map((id) => SYSTEMS[id]).filter(Boolean);

  const list = systems.length > 0 ? systems : [SYSTEMS.admin, SYSTEMS.leads];
  const mult = TEAM_MULTIPLIER[String(answers.teamSize)] ?? 1;

  const low = Math.round(list.reduce((n, s) => n + s.hours[0], 0) * mult);
  const high = Math.round(list.reduce((n, s) => n + s.hours[1], 0) * mult);

  return { systems: list, hoursLow: low, hoursHigh: high };
}
