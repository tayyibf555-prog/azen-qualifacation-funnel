/**
 * Funnel definition. Everything the lead sees and everything we score
 * lives here so the copy can be changed without touching the machinery.
 */

export type Choice = {
  id: string;
  label: string;
  sub?: string;
  /** 0-1 weight within its own question. Rolled up in scoring.ts. */
  weight: number;
};

export type Field = {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "email" | "tel" | "url";
  required: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "url";
};

export type Step =
  | {
      kind: "single";
      id: string;
      eyebrow: string;
      question: string;
      help?: string;
      choices: Choice[];
    }
  | {
      kind: "multi";
      id: string;
      eyebrow: string;
      question: string;
      help?: string;
      max: number;
      choices: Choice[];
    }
  | {
      kind: "fields";
      id: string;
      eyebrow: string;
      question: string;
      help?: string;
      cta: string;
      fields: Field[];
    }
  | {
      kind: "interstitial";
      id: string;
      eyebrow: string;
      headline: string;
      body: string;
      cta: string;
    };

export const STEPS: Step[] = [
  {
    kind: "single",
    id: "industry",
    eyebrow: "First, the basics",
    question: "What kind of business do you run?",
    choices: [
      { id: "trades", label: "Trades or field service", sub: "Plumbing, electrical, HVAC, construction", weight: 0.9 },
      { id: "professional", label: "Professional services", sub: "Accounting, legal, consulting, finance", weight: 1 },
      { id: "health", label: "Clinic or healthcare", sub: "Dental, physio, private practice", weight: 0.95 },
      { id: "agency", label: "Agency or studio", sub: "Marketing, design, recruitment", weight: 1 },
      { id: "ecom", label: "E-commerce or retail", weight: 0.8 },
      { id: "property", label: "Property or lettings", weight: 0.9 },
      { id: "other", label: "Something else", weight: 0.7 },
    ],
  },
  {
    kind: "single",
    id: "teamSize",
    eyebrow: "Scale",
    question: "How many people are on the team?",
    help: "Including you, part-timers and regular contractors.",
    choices: [
      { id: "solo", label: "Just me", weight: 0.25 },
      { id: "2-5", label: "2 to 5", weight: 0.6 },
      { id: "6-15", label: "6 to 15", weight: 0.9 },
      { id: "16-50", label: "16 to 50", weight: 1 },
      { id: "50+", label: "More than 50", weight: 1 },
    ],
  },
  {
    kind: "fields",
    id: "capture",
    eyebrow: "Quick one",
    question: "Where should we send your breakdown?",
    help: "So you don't lose it if you get interrupted. It shows on screen either way.",
    cta: "Continue",
    fields: [
      {
        id: "firstName",
        label: "First name",
        placeholder: "Sam",
        type: "text",
        required: true,
        autoComplete: "given-name",
      },
      {
        id: "email",
        label: "Email",
        placeholder: "sam@acmeplumbing.co.uk",
        type: "email",
        required: true,
        autoComplete: "email",
        inputMode: "email",
      },
    ],
  },
  {
    kind: "single",
    id: "revenue",
    eyebrow: "Scale",
    question: "Roughly what does the business turn over each month?",
    help: "Nobody sees this but us. It tells us what's realistic to build.",
    choices: [
      { id: "u10k", label: "Under £10k", weight: 0.15 },
      { id: "10-30k", label: "£10k to £30k", weight: 0.5 },
      { id: "30-100k", label: "£30k to £100k", weight: 0.85 },
      { id: "100-500k", label: "£100k to £500k", weight: 1 },
      { id: "500k+", label: "£500k+", weight: 1 },
      { id: "private", label: "Rather not say", weight: 0.5 },
    ],
  },
  {
    kind: "multi",
    id: "bottleneck",
    eyebrow: "The real question",
    question: "Where does the week actually disappear to?",
    help: "Pick up to three. These become the first things we automate.",
    max: 3,
    choices: [
      { id: "admin", label: "Admin and data entry", sub: "Re-typing the same thing into three systems", weight: 1 },
      { id: "leads", label: "Answering new enquiries", sub: "Leads go cold before anyone replies", weight: 1 },
      { id: "followup", label: "Chasing and following up", sub: "Quotes sent, then silence", weight: 1 },
      { id: "quotes", label: "Writing quotes and proposals", weight: 0.9 },
      { id: "support", label: "Repetitive customer questions", weight: 0.9 },
      { id: "scheduling", label: "Booking and scheduling", weight: 0.85 },
      { id: "reporting", label: "Reporting and chasing numbers", weight: 0.8 },
      { id: "onboarding", label: "Training and onboarding staff", weight: 0.75 },
    ],
  },
  {
    kind: "interstitial",
    id: "midpoint",
    eyebrow: "Halfway",
    headline: "That's the expensive part, {firstName}.",
    body: "Owner-led businesses your size typically lose ten to twenty hours a week to work that no longer needs a human. Four more questions and we'll show you which of yours goes first.",
    cta: "Keep going",
  },
  {
    kind: "multi",
    id: "tried",
    eyebrow: "Context",
    question: "What have you already tried?",
    help: "Honest answers get you a better call. Pick any that apply.",
    max: 4,
    choices: [
      { id: "nothing", label: "Nothing yet", sub: "Still working out where to start", weight: 0.6 },
      { id: "chatgpt", label: "ChatGPT here and there", sub: "Useful, but nothing that runs on its own", weight: 0.8 },
      { id: "zapier", label: "Zapier or Make automations", weight: 1 },
      { id: "hired", label: "Hired someone to absorb it", weight: 0.95 },
      { id: "agency", label: "Worked with an agency before", weight: 0.9 },
      { id: "internal", label: "Built something in-house", weight: 0.9 },
    ],
  },
  {
    kind: "single",
    id: "timeline",
    eyebrow: "Timing",
    question: "How soon do you want this live?",
    choices: [
      { id: "asap", label: "As soon as possible", sub: "It's already costing us", weight: 1 },
      { id: "1mo", label: "Within a month", weight: 0.9 },
      { id: "3mo", label: "Next quarter", weight: 0.6 },
      { id: "browsing", label: "Just researching for now", weight: 0.2 },
    ],
  },
  {
    kind: "single",
    id: "budget",
    eyebrow: "Investment",
    question: "What have you set aside to solve this?",
    help: "Straight answer so neither of us wastes a call. Most builds start at £1,000.",
    choices: [
      { id: "1-2.5k", label: "£1,000 to £2,500", sub: "One system, built properly", weight: 0.6 },
      { id: "2.5-5k", label: "£2,500 to £5,000", sub: "A few connected systems", weight: 0.85 },
      { id: "5-10k", label: "£5,000 to £10,000", sub: "A department's worth of work", weight: 1 },
      { id: "10k+", label: "£10,000+", sub: "Rebuild how the business runs", weight: 1 },
      { id: "unsure", label: "Depends what it's worth", sub: "Show me the return first", weight: 0.55 },
    ],
  },
  {
    kind: "single",
    id: "authority",
    eyebrow: "Last one",
    question: "Who signs off on a decision like this?",
    choices: [
      { id: "me", label: "Me, on my own", weight: 1 },
      { id: "me-partner", label: "Me and a business partner", weight: 0.9 },
      { id: "board", label: "It goes to a board or committee", weight: 0.6 },
      { id: "someone", label: "Someone above me", weight: 0.3 },
    ],
  },
  {
    kind: "fields",
    id: "final",
    eyebrow: "Last step",
    question: "Who are we looking up before the call?",
    help: "We read up on you beforehand so the twenty minutes aren't spent on background.",
    cta: "See my plan",
    fields: [
      {
        id: "businessName",
        label: "Business name",
        placeholder: "Acme Plumbing Ltd",
        type: "text",
        required: true,
        autoComplete: "organization",
      },
      {
        id: "website",
        label: "Website",
        placeholder: "acmeplumbing.co.uk",
        type: "text",
        required: false,
        autoComplete: "url",
        inputMode: "url",
      },
      {
        id: "phone",
        label: "Mobile",
        placeholder: "07700 900123",
        type: "tel",
        required: true,
        autoComplete: "tel",
        inputMode: "tel",
      },
    ],
  },
];

/** Steps that count toward the visible progress bar. */
export const SCORED_STEPS = STEPS.filter((s) => s.kind !== "interstitial");

export function stepIndexById(id: string) {
  return STEPS.findIndex((s) => s.id === id);
}

/** Substitutes {firstName} and friends into step copy. */
export function interpolate(text: string, values: Record<string, unknown>) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }).replace(/\s+([,.!?])/g, "$1");
}
