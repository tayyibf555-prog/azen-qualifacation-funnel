import { createHash } from "node:crypto";

/**
 * Meta Conversions API. Server-side events survive ad blockers, ITP and the
 * iOS prompt, so bookings keep getting attributed to the ad that caused them.
 * Every event carries the same event_id as its browser twin, which is how Meta
 * deduplicates the pair.
 */

const API_VERSION = "v21.0";

function hash(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  return createHash("sha256").update(normalised).digest("hex");
}

/** UK-first E.164 normalisation: Meta wants digits only, country code included. */
function normalisePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  else if (!digits.startsWith("44") && digits.length <= 10) digits = `44${digits}`;
  return digits;
}

export type CapiInput = {
  eventName: "Lead" | "Schedule" | "CompleteRegistration";
  eventId: string;
  eventTime?: number;
  sourceUrl?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  customData?: Record<string, unknown>;
};

export async function sendMetaEvent(input: CapiInput): Promise<string> {
  const pixelId = process.env.META_PIXEL_ID ?? process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;

  if (!pixelId || !token) return "skipped (META_CAPI_TOKEN unset)";

  const userData: Record<string, unknown> = {
    em: hash(input.email) ? [hash(input.email)] : undefined,
    ph: hash(normalisePhone(input.phone)) ? [hash(normalisePhone(input.phone))] : undefined,
    fn: hash(input.firstName) ? [hash(input.firstName)] : undefined,
    fbp: input.fbp,
    fbc: input.fbc,
    client_ip_address: input.clientIp,
    client_user_agent: input.userAgent,
  };

  for (const key of Object.keys(userData)) {
    if (userData[key] === undefined) delete userData[key];
  }

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: userData,
        custom_data: input.customData ?? {},
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return `failed ${res.status} ${detail.slice(0, 200)}`;
  }
  return "sent";
}
