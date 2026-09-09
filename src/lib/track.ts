/**
 * Ad-platform conversion events. Every call is a no-op unless the relevant
 * pixel actually loaded, so this is safe to call unconditionally.
 */

type Payload = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Payload[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Meta's standard events get sent via `track`; ours via `trackCustom`. */
const META_STANDARD = new Set(["Lead", "Schedule", "CompleteRegistration", "ViewContent"]);

/**
 * `eventId` must match the `event_id` the server sends to the Conversions API,
 * or Meta counts the same conversion twice.
 */
export function track(event: string, payload: Payload = {}, eventId?: string) {
  if (typeof window === "undefined") return;

  try {
    if (window.fbq) {
      const method = META_STANDARD.has(event) ? "track" : "trackCustom";
      if (eventId) window.fbq(method, event, payload, { eventID: eventId });
      else window.fbq(method, event, payload);
    }
  } catch {
    /* pixel blocked, keep going */
  }

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, event_id: eventId, ...payload });
  } catch {
    /* ignore */
  }
}

/**
 * Meta's own first-party cookies. Passing them to the Conversions API is what
 * lets a server-side event be matched back to the ad click that caused it.
 */
export function metaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};

  const read = (name: string) => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
  };

  return { fbp: read("_fbp"), fbc: read("_fbc") };
}

/* --- Attribution -------------------------------------------------------- */

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ttclid",
  "li_fat_id",
] as const;

const ATTRIBUTION_KEY = "azen.attribution";

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & {
  landingPath?: string;
  referrer?: string;
  capturedAt?: string;
};

/**
 * Captured once on first landing and kept for the session, so attribution
 * survives a lead refreshing the page or coming back from their email.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored) as Attribution;
  } catch {
    /* storage unavailable */
  }

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
    landingPath: window.location.pathname,
    referrer: document.referrer || undefined,
    capturedAt: new Date().toISOString(),
  };

  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = value;
  }

  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    /* ignore */
  }

  return attribution;
}
