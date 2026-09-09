# Azen — lead qualification funnel

A Perspective-style quiz funnel that qualifies paid traffic and hands qualified
prospects straight to your Calendly. One question per screen, auto-advancing,
mobile-first.

```bash
npm install
cp .env.example .env.local   # fill in at minimum NEXT_PUBLIC_CALENDLY_URL
npm run dev
```

## What it does

1. **Hook screen** — the promise, the time cost, who it's for.
2. **Two easy questions** — industry and team size. Low friction, builds commitment.
3. **Email capture** — first name and email, two questions in. This is the line
   between an anonymous visitor and a lead you can follow up.
4. **Six qualifying questions** — revenue, bottlenecks, what they've tried,
   timeline, budget, authority, with a midpoint interstitial that uses their name.
5. **Business details and phone** — the closing step.
6. **A short analysing beat**, then a personalised readout and Calendly,
   prefilled.

### Why the email sits at question three

Asking on screen one kills completion; asking only at the end means every
abandoner is lost. Two easy taps in, they are invested enough to give it, and
from that moment every further answer is saved. Someone who quits at the budget
question is still a named lead with a score, sitting in your sheet.

## Lead capture stages

Every stage posts to `/api/lead` with the same `leadId`, so one person is one
row that gets updated, never six duplicates.

| Stage | Fires when | Goes to |
|---|---|---|
| `partial` | Email captured, then after every later answer | Sheet, webhook (opt-in) |
| `abandoned` | Tab hidden or closed mid-funnel, via `sendBeacon` | Sheet, webhook (opt-in) |
| `complete` | Final step submitted | Sheet, webhook, email, Meta CAPI |
| `booked` | Calendly confirms the booking | Sheet, webhook, Meta CAPI |

Repeat writes are suppressed: re-tapping an answer you already picked sends
nothing, and tabbing away twice from the same question beacons once. Each push
carries a `seq` so a late-arriving older write can't overwrite newer answers.

## Qualification

Budget starts at £1,000. There is no lower option, so anyone below that
self-selects out rather than being told no.

Every lead is scored 0-100 and tiered, so you can triage before the call. The
score updates on every partial push, so a half-finished lead already carries one:

| Weight | Question |
|---|---|
| 28 | Budget |
| 20 | Who signs off |
| 18 | Timeline |
| 14 | Monthly revenue |
| 10 | Team size |
| 6 | Bottlenecks |
| 4 | What they've tried |

- **priority** — 72+
- **qualified** — 48 to 71
- **nurture** — under 48

Flags like *Not the decision maker* or *Budget not set* ride along in `signals`.
Tune the weights and thresholds in [`src/lib/scoring.ts`](src/lib/scoring.ts).

## Checking what's wired up

```
GET /api/status          which integrations are configured
GET /api/status?test=1   plus a live POST to each one
```

Reports presence, never values, so it is safe to hit in production. The `test=1`
form writes a row marked `stage: test` to your sheet and webhook so you can prove
the wiring before spending money sending traffic at it. Delete the row after.

```json
{ "configured": ["Google Sheet backup", "Meta Pixel (browser)"],
  "missing": ["Calendly", "Email notification"],
  "probes": { "sheet": "reachable (200)" } }
```

A `401` from the sheet means the Apps Script deployment is not public: **Deploy →
Manage deployments → pencil → Who has access → Anyone**. "Anyone with Google
Account" is not the same thing and will keep returning 401.

## Google Sheet backup

The safety net. Every lead, every stage, independent of any other integration.

1. Create a Google Sheet. **Extensions → Apps Script**.
2. Paste [`google-apps-script/Code.gs`](google-apps-script/Code.gs) over the
   default `Code.gs`.
3. Change `SHARED_SECRET` at the top to a random string.
4. **Deploy → New deployment → Web app.** Execute as *Me*, access
   *Anyone*. Copy the `/exec` URL.
5. Set `SHEETS_WEBHOOK_URL` to that URL and `SHEETS_SHARED_SECRET` to the same
   string.

The script creates the `Leads` tab and its header row on first write. It matches
on `leadId` and **merges** rather than replaces, so a later partial can never
blank a field an earlier push already filled. Anything it can't parse goes to an
`Errors` tab with the raw payload, so nothing is lost to a mapping bug.

To capture an extra column, add its name to the header row in the sheet and to
`COLUMNS` in the script. No redeploy of the app needed.

## Environment

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_CALENDLY_URL` | The booking screen. Without it you get a placeholder. |
| `SHEETS_WEBHOOK_URL`, `SHEETS_SHARED_SECRET` | The Google Sheet backup above. |
| `LEAD_WEBHOOK_URL` | POSTs the full lead JSON to Make, n8n, Zapier, Slack, a CRM. |
| `LEAD_WEBHOOK_STAGES` | Which stages reach that webhook. Defaults to `complete,booked`. |
| `RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL`, `LEAD_FROM_EMAIL` | Email per completed lead. All three or none. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Browser pixel. |
| `META_CAPI_TOKEN` | Server-side Conversions API. |
| `META_TEST_EVENT_CODE` | Only while testing in Events Manager. Remove after. |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager / GA4. |

Every integration is optional and fails soft: they run in parallel, one failing
never stops the others, and each gets one retry. Whatever happens, the full lead
is written to the server log, so nothing is unrecoverable.

The API response reports what happened per destination, which is the fastest way
to debug a live funnel:

```json
{ "ok": true, "score": 81, "tier": "priority",
  "delivery": { "sheet": "sent", "webhook": "sent",
                "email": "sent", "metaCapi": "sent" } }
```

## Ad tracking

Fired to Meta Pixel and `dataLayer`:

| Event | When | Use it for |
|---|---|---|
| `QuizStart` | Hook screen CTA | Cheap traffic tests |
| `QuizStep` | Each answer | Drop-off diagnosis |
| `CompleteRegistration` | **Email captured** | Your early optimisation event |
| `Lead` | Final step submitted | **Your main conversion** |
| `QuizResult` | Readout shown | — |
| `Schedule` | Calendly booking confirmed | **Optimise here once volume allows** |

`CompleteRegistration`, `Lead` and `Schedule` are Meta standard events, so they
map onto conversion campaigns with no extra setup. `CompleteRegistration` fires
early enough to give the algorithm signal at a realistic volume; `Schedule` is
the one that actually correlates with revenue, so move to it once you have
roughly 50 a week.

### Meta Conversions API

Server-side events survive ad blockers, ITP and the iOS prompt, which is where
most attribution is lost. Set `META_CAPI_TOKEN` (Events Manager → your pixel →
Settings → Conversions API → Generate access token) alongside the pixel id.

Browser and server events share an `event_id`, so Meta deduplicates the pair
rather than counting two conversions. Email, phone and first name are SHA-256
hashed before they leave the server, and the `_fbp` / `_fbc` cookies are passed
through so a server event still matches the ad click that caused it. Phone
numbers are normalised to E.164 with a UK default.

Verify with `META_TEST_EVENT_CODE` and the Test Events tab, then remove it.

### Attribution

`utm_*`, `fbclid`, `gclid`, `ttclid` and `li_fat_id` are captured on landing,
held in `sessionStorage` for the session, and attached to every lead at every
stage. A booking traces back to the exact ad and campaign that produced it.

## Design

The palette and typeface are lifted directly from azen.io so the funnel and the
site read as one product: `#020202` ground, `#0f1011` surfaces, hairlines at
white/5%, Apple system blue `#0071e3`, `#86868b` secondary text, Hanken Grotesk
over the `-apple-system` stack. Tokens live in
[`src/app/globals.css`](src/app/globals.css).

Small blue text uses `#0a84ff` rather than `#0071e3` — Apple's dark-mode blue.
The brand value is only 3.98:1 on near-black, which fails AA at label sizes; it
stays on fills, where white-on-blue is 5:1.

Motion follows Apple's *Designing Fluid Interfaces*:

- **Springs, not keyframes.** Two parameters, per Apple's model: critically
  damped (`bounce 0`) at `0.42s` response for screen moves, a little bounce
  (`0.18`) only where a gesture put something in flight. Presets in
  [`src/lib/motion.ts`](src/lib/motion.ts).
- **Response on pointer-down.** Options depress and fire a haptic the instant
  they're touched, and commit on release. Dragging off cancels.
- **Spatial consistency.** Screens enter and exit along the same axis, so going
  back retraces the path forward took.
- **Nothing stale is tappable.** A screen stops accepting input the moment it
  starts leaving.
- **Translucent chrome.** Header and the sticky Continue bar are
  `backdrop-filter` layers with content passing underneath, plus a scroll edge
  fade instead of a divider.
- **Size-specific typography.** Tracking goes negative as type grows and
  slightly positive at caption sizes; leading tightens as size grows.

`prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast`
are all honoured — including by the springs, via `MotionConfig reducedMotion="user"`.

## Editing the funnel

All copy, questions, options and scoring weights live in
[`src/lib/questions.ts`](src/lib/questions.ts). Add, remove or reorder steps
there; progress, scoring and the payload all follow automatically.

The recommended systems and the hours estimate are in
[`src/lib/scoring.ts`](src/lib/scoring.ts) — one entry per bottleneck option.
If you add a bottleneck choice, add its matching system.

## Deploy

```bash
npx vercel
```

Set the environment variables in the Vercel project, then redeploy. The page is
`noindex` by default (see `robots` in [`src/app/layout.tsx`](src/app/layout.tsx))
since it's an ad destination, not something you want ranking.
