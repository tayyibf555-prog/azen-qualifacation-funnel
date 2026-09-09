import { NextResponse } from "next/server";
import { STEPS } from "@/lib/questions";
import { scoreAnswers, buildReadout, type Answers } from "@/lib/scoring";
import { sendMetaEvent } from "@/lib/meta-capi";

export const runtime = "nodejs";

/**
 * Every stage of the funnel lands here. "partial" and "abandoned" are what make
 * an incomplete form still worth something: the row exists in the sheet from
 * the moment we have an email, and it gets updated in place after that.
 */
export type Stage = "partial" | "complete" | "booked" | "abandoned";

type Body = {
  answers?: Answers;
  attribution?: Record<string, string>;
  stage?: Stage;
  leadId?: string;
  stepId?: string;
  /** Monotonic per session, so the sheet can ignore an out-of-order write. */
  seq?: number;
  meta?: { fbp?: string; fbc?: string; sourceUrl?: string };
};

/** Choice ids become the labels a human reads in the sheet or an email. */
function humanise(answers: Answers): Record<string, string> {
  const out: Record<string, string> = {};

  for (const step of STEPS) {
    if (step.kind === "single") {
      const value = answers[step.id];
      if (typeof value === "string") out[step.id] = step.choices.find((c) => c.id === value)?.label ?? value;
    } else if (step.kind === "multi") {
      const value = answers[step.id];
      if (Array.isArray(value)) {
        out[step.id] = value.map((v) => step.choices.find((c) => c.id === v)?.label ?? v).join(", ");
      }
    } else if (step.kind === "fields") {
      for (const field of step.fields) {
        const value = answers[field.id];
        if (typeof value === "string" && value.trim()) out[field.id] = value.trim();
      }
    }
  }

  return out;
}

/**
 * One flat object per lead. The sheet writes whatever columns its header row
 * names, so adding a column there needs no redeploy here.
 */
function flatten(
  record: Record<string, unknown>,
  readable: Record<string, string>,
  attribution: Record<string, string>,
) {
  return {
    leadId: record.leadId,
    stage: record.stage,
    updatedAt: record.submittedAt,
    lastStep: record.lastStep ?? "",
    score: record.score,
    tier: record.tier,
    signals: (record.signals as string[]).join(" · "),
    firstName: readable.firstName ?? "",
    email: readable.email ?? "",
    phone: readable.phone ?? "",
    businessName: readable.businessName ?? "",
    website: readable.website ?? "",
    industry: readable.industry ?? "",
    teamSize: readable.teamSize ?? "",
    revenue: readable.revenue ?? "",
    bottleneck: readable.bottleneck ?? "",
    tried: readable.tried ?? "",
    timeline: readable.timeline ?? "",
    budget: readable.budget ?? "",
    authority: readable.authority ?? "",
    recommendedSystems: (record.recommendedSystems as string[]).join(" · "),
    estimatedHours: (record.estimatedHoursPerWeek as number[]).join("-"),
    utm_source: attribution.utm_source ?? "",
    utm_medium: attribution.utm_medium ?? "",
    utm_campaign: attribution.utm_campaign ?? "",
    utm_content: attribution.utm_content ?? "",
    utm_term: attribution.utm_term ?? "",
    fbclid: attribution.fbclid ?? "",
    gclid: attribution.gclid ?? "",
    referrer: attribution.referrer ?? "",
    landingPath: attribution.landingPath ?? "",
  };
}

function emailBody(
  readable: Record<string, string>,
  score: number,
  tier: string,
  signals: string[],
  attribution: Record<string, string>,
) {
  const rows = Object.entries(readable)
    .map(([k, v]) => `${k.padEnd(16)} ${v}`)
    .join("\n");

  const source = attribution.utm_source
    ? `${attribution.utm_source}${attribution.utm_campaign ? " / " + attribution.utm_campaign : ""}`
    : attribution.referrer || "direct";

  return [
    `Score: ${score}/100  (${tier})`,
    signals.length ? `Flags: ${signals.join(" · ")}` : "",
    `Source: ${source}`,
    "",
    rows,
  ]
    .filter(Boolean)
    .join("\n");
}

async function postJson(url: string, payload: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return "sent";
}

/** One retry: most Apps Script and Zapier failures are transient. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    return fn();
  }
}

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const answers = body.answers ?? {};
  const attribution = body.attribution ?? {};
  const stage: Stage = body.stage ?? "complete";
  const leadId = body.leadId?.trim();

  const email = typeof answers.email === "string" ? answers.email.trim() : "";
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "leadId required" }, { status: 400 });
  }
  if (!email && stage !== "booked") {
    return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });
  }

  const { score, tier, signals } = scoreAnswers(answers);
  const readout = buildReadout(answers);
  const readable = humanise(answers);

  const record = {
    leadId,
    stage,
    seq: body.seq ?? 0,
    lastStep: body.stepId ?? "",
    submittedAt: new Date().toISOString(),
    score,
    tier,
    signals,
    recommendedSystems: readout.systems.map((s) => s.name),
    estimatedHoursPerWeek: [readout.hoursLow, readout.hoursHigh],
    lead: readable,
    rawAnswers: answers,
    attribution,
  };

  const flat = flatten(record, readable, attribution);
  const delivery: Record<string, string> = {};

  // Only the finished article is worth an email or an ad conversion; partials
  // are for the backup sheet and the webhook.
  const isFinal = stage === "complete" || stage === "booked";

  const jobs: Array<[string, Promise<string>]> = [];

  // 1. Google Sheet: the backup of record. Every stage, always.
  const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
  if (sheetsUrl) {
    jobs.push([
      "sheet",
      withRetry(() =>
        postJson(sheetsUrl, {
          secret: process.env.SHEETS_SHARED_SECRET ?? "",
          seq: body.seq ?? 0,
          flat,
          record,
        }),
      ),
    ]);
  } else {
    delivery.sheet = "skipped (SHEETS_WEBHOOK_URL unset)";
  }

  // 2. Generic webhook: Make, n8n, Zapier, Slack, a CRM.
  //    Finished leads only by default, so pointing this at Slack doesn't ping
  //    you eight times while one person works through the questions. Widen it
  //    with LEAD_WEBHOOK_STAGES=partial,abandoned,complete,booked.
  const webhook = process.env.LEAD_WEBHOOK_URL;
  const webhookStages = (process.env.LEAD_WEBHOOK_STAGES ?? "complete,booked")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (webhook && webhookStages.includes(stage)) {
    jobs.push(["webhook", withRetry(() => postJson(webhook, record))]);
  } else if (!webhook) {
    delivery.webhook = "skipped (LEAD_WEBHOOK_URL unset)";
  } else {
    delivery.webhook = `skipped (${stage} not in LEAD_WEBHOOK_STAGES)`;
  }

  // 3. Email notification via Resend.
  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.LEAD_NOTIFY_EMAIL;
  const notifyFrom = process.env.LEAD_FROM_EMAIL;

  if (resendKey && notifyTo && notifyFrom && stage === "complete") {
    jobs.push([
      "email",
      (async () => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: notifyFrom,
            to: [notifyTo],
            reply_to: email || undefined,
            subject: `${tier === "priority" ? "Priority" : tier === "qualified" ? "Qualified" : "New"} lead: ${readable.businessName ?? email} (${score}/100)`,
            text: emailBody(readable, score, tier, signals, attribution),
          }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return "sent";
      })(),
    ]);
  } else {
    delivery.email = stage === "complete" ? "skipped (Resend env unset)" : "skipped (not a completion)";
  }

  // 4. Meta Conversions API, deduplicated against the browser pixel by event id.
  if (isFinal) {
    const forwarded = request.headers.get("x-forwarded-for");
    jobs.push([
      "metaCapi",
      sendMetaEvent({
        eventName: stage === "booked" ? "Schedule" : "Lead",
        eventId: `${leadId}_${stage}`,
        sourceUrl: body.meta?.sourceUrl,
        email,
        phone: readable.phone,
        firstName: readable.firstName,
        fbp: body.meta?.fbp,
        fbc: body.meta?.fbc,
        clientIp: forwarded?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        customData: { value: 1, currency: "GBP", lead_score: score, lead_tier: tier },
      }),
    ]);
  } else {
    delivery.metaCapi = "skipped (not a conversion stage)";
  }

  // Independent destinations: one failing must never take the others down.
  const settled = await Promise.allSettled(jobs.map(([, promise]) => promise));
  settled.forEach((result, i) => {
    const name = jobs[i][0];
    delivery[name] = result.status === "fulfilled" ? result.value : `failed ${(result.reason as Error).message}`;
  });

  // The log is the last line of defence if every integration is down.
  console.log("[azen-lead]", JSON.stringify({ ...record, delivery }));

  return NextResponse.json({ ok: true, leadId, score, tier, delivery });
}
