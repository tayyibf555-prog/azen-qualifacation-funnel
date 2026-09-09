import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which integrations are actually wired up. Reports presence only, never the
 * values, so it is safe to hit in production. Add ?test=1 to fire a live probe
 * at each configured destination.
 */

type Check = {
  name: string;
  configured: boolean;
  env: string[];
  purpose: string;
  where: string;
};

function has(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET(request: Request) {
  const checks: Check[] = [
    {
      name: "Calendly",
      configured: has("NEXT_PUBLIC_CALENDLY_URL"),
      env: ["NEXT_PUBLIC_CALENDLY_URL"],
      purpose: "The booking screen at the end of the funnel",
      where: "calendly.com -> your event -> Share -> copy the link",
    },
    {
      name: "Google Sheet backup",
      configured: has("SHEETS_WEBHOOK_URL"),
      env: ["SHEETS_WEBHOOK_URL", "SHEETS_SHARED_SECRET"],
      purpose: "Every lead at every stage, including abandoners",
      where: "Apps Script -> Deploy -> New deployment -> Web app -> copy the /exec URL",
    },
    {
      name: "Generic webhook",
      configured: has("LEAD_WEBHOOK_URL"),
      env: ["LEAD_WEBHOOK_URL", "LEAD_WEBHOOK_STAGES"],
      purpose: "Push leads into Make, n8n, Zapier, Slack or a CRM",
      where: "Your automation tool -> new scenario -> Webhooks -> Custom webhook",
    },
    {
      name: "Email notification",
      configured: has("RESEND_API_KEY") && has("LEAD_NOTIFY_EMAIL") && has("LEAD_FROM_EMAIL"),
      env: ["RESEND_API_KEY", "LEAD_NOTIFY_EMAIL", "LEAD_FROM_EMAIL"],
      purpose: "An email to you per completed lead",
      where: "resend.com -> API Keys -> Create, then verify your sending domain",
    },
    {
      name: "Meta Pixel (browser)",
      configured: has("NEXT_PUBLIC_META_PIXEL_ID"),
      env: ["NEXT_PUBLIC_META_PIXEL_ID"],
      purpose: "Client-side conversion events for ad optimisation",
      where: "Events Manager -> Data sources -> your pixel -> the ID at the top",
    },
    {
      name: "Meta Conversions API (server)",
      configured: has("META_CAPI_TOKEN") && has("NEXT_PUBLIC_META_PIXEL_ID"),
      env: ["META_CAPI_TOKEN", "META_TEST_EVENT_CODE"],
      purpose: "Server-side events that survive ad blockers and iOS",
      where: "Events Manager -> your pixel -> Settings -> Conversions API -> Generate token",
    },
    {
      name: "Google Tag Manager",
      configured: has("NEXT_PUBLIC_GTM_ID"),
      env: ["NEXT_PUBLIC_GTM_ID"],
      purpose: "GA4 and any other tag you manage in GTM",
      where: "tagmanager.google.com -> your container -> the GTM-XXXX ID",
    },
  ];

  const url = new URL(request.url);
  const probes: Record<string, string> = {};

  // A real POST to each configured destination, so you can prove the wiring
  // before spending money sending traffic at it.
  if (url.searchParams.get("test") === "1") {
    const id = `azen_test_${Date.now().toString(36)}`;
    const sample = {
      leadId: id,
      stage: "test",
      note: "Connection test from /api/status?test=1 - safe to delete this row.",
      flat: {
        leadId: id,
        stage: "test",
        firstName: "Connection",
        email: "test@example.com",
        businessName: "Connection test",
      },
      secret: process.env.SHEETS_SHARED_SECRET ?? "",
    };

    for (const [key, target] of [
      ["sheet", process.env.SHEETS_WEBHOOK_URL],
      ["webhook", process.env.LEAD_WEBHOOK_URL],
    ] as const) {
      if (!target) {
        probes[key] = "not configured";
        continue;
      }
      try {
        const res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sample),
          redirect: "follow",
        });
        probes[key] = res.ok ? `reachable (${res.status})` : `unreachable (${res.status})`;
      } catch (error) {
        probes[key] = `unreachable (${(error as Error).message})`;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inboundEndpoint: "/api/lead",
    configured: checks.filter((c) => c.configured).map((c) => c.name),
    missing: checks.filter((c) => !c.configured).map((c) => c.name),
    checks,
    ...(Object.keys(probes).length ? { probes } : {}),
  });
}
