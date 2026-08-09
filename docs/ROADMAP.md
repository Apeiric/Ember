# EMBER — roadmap, competitors, and the honest answers

*Companion to PITCH.md (business) and AUDIT.md (pressure test). This file is
the "what next and against whom" document.*

---

## 1. The competitive map (research before quoting ⚠ — verify current state)

| Product | What it does | What it does NOT do (our gap) |
|---|---|---|
| **Watch Duty** (nonprofit) | Best-in-class fire *awareness*: human-verified incident feeds, perimeters, alerts. Millions of users during LA fires. | No routing, no per-person anything, no "what do I do". It tells you about the fire; it never answers "which way". |
| **Genasys Protect / Zonehaven** | The county tool: zone statuses (GO/SET/READY), used by CA counties for evac orders. | Zone-granular, person-agnostic. Everyone in the polygon gets the same instruction. No routes, no timing race. |
| **Google Maps / SOS alerts** | Fire layer, SOS banners, sometimes "avoid area." World-class roads + traffic. | Routing objective is ETA, not survival. No hazard-time vs person-time race; no rejection of a route that will be cut mid-drive; liability posture keeps them descriptive. |
| **Waze** | Crowd hazard reports, fastest-route culture. | Same objective-function problem, worse: speed-seeking actively selects fire-emptied roads. |
| **Life360** | Family location sharing, driving safety, huge ARPU proof. | No hazard model at all. Where your family is, never what they should do. Privacy trust burned once already. |
| **FEMA / county alert apps** | Official push alerts. | One-way, zone-level, no routing, chronically uninstalled until the day of. |
| **Perimeter, Ladris, others (B2G)** | Evac planning/AI for agencies. | Planning-time tools for officials, not run-time tools for families. |

**The one-sentence differentiation:** everyone else describes the hazard or
optimises the drive; Ember is the only one that *races them against each
other, per person, and refuses to lose.*

## 2. "Would Google really send you to the 405?" — the honest answer

Partly fair challenge, and the demo copy is built to survive it:

- We never claim Google navigates you to the Getty. The naive route is "the
  fastest of the candidate escapes" — modelling the *fastest-out instinct*
  (get to the freeway), which is what both humans and ETA-optimisers do.
  In the real January 2025 fire, Sunset eastbound is exactly where cars
  gridlocked and got bulldozed — people genuinely chose it.
- What Google demonstrably does NOT do — and this is the claim we stand on —
  is **reject** a route because the fire will cut it *before you clear it*,
  or change the answer for a walker vs a driver. Their fire layer is
  descriptive; their router optimises ETA among open roads *now*.
- Say it on stage as: *"ask your phone for the fastest way out and it will
  happily aim you at the freeway through the fire's path — not because it's
  malicious, because 'fastest now' is its only question. Our question is
  'fastest of the ones you'll survive'."*

## 3. Live tracking on the web — how hard is it really?

- **Trivial**: `navigator.geolocation.watchPosition()` — continuous fixes,
  same permission prompt we already use for 📍, works on phone browsers over
  HTTPS. One evening of work to wire into the live layer (the sim hook was
  built so `watchPosition` replaces the simulator without touching decision
  logic).
- **Moderate**: sharing between household members needs a small realtime
  channel (WebSocket/SSE room or Firebase). A day, including auth-less
  household codes for a demo.
- **The actually-hard part**: background tracking. A web page stops getting
  fixes when the phone locks or the tab backgrounds. That is *the* reason
  Life360 is a native app — and the honest scope line: web = live while
  open (fine for an active evacuation, screen is on and mounted), native =
  ambient family safety.

## 4. Why web-first was right (and when mobile-first wins)

Chose web because: judges demo on laptops; zero install friction — during a
real emergency "tap this link" beats "download this app" by minutes that
matter; one codebase in a 10-hour build; instant deploys all day. And the
architecture is mobile-ready: the UI is mobile-first responsive, and the pure
judge can run on-device.

Mobile-first wins the moment the product needs: background location, push
alerts that wake a sleeping family at 2 a.m., offline map tiles, and
App-Store trust. That is the Series-A build, not the hackathon build.

**Bridge (cheap, next):** ship as a PWA — installable icon, service-worker
cache of the app shell + last danger field, web push where supported. 80% of
native's demo value for 5% of the cost.

## 5. Roadmap in phases

**Phase 0 — now (hackathon):** everything in this repo. Deterministic race
engine, per-person verdicts, plans, live coordination layer (sim), responder
triage, four-tab product, evidence docs.

**Phase 1 — weeks:** PWA + offline verdict cache; real `watchPosition` live
layer behind per-incident opt-in with household join codes; voice *alerts*
(not narration) for verdict changes; TTS'd turn cues in nav mode; county
pilot demo kit (Responder tab + a sector view over real parcel data).

**Phase 2 — months:** on-device judge (the pure core runs in the browser /
React Native against the last-synced danger field — verdicts survive dead
cell towers); pluggable spread models (ELMFIRE adapter); evacuation-flow
modelling (the queueing science Paradise died from); multi-hazard producers
(flood = water downhill vs fire = flame downwind — same DangerField).

**Phase 3 — the company:** county/utility/insurer deployments (PITCH.md §4);
the road-survivability dataset licensing; hardened trust layer (signed
verdicts, official-source cross-display); native apps for ambient safety.

## 6. Modernization notes (engineering hygiene next sprint)

- Split `App.tsx` (state is outgrowing it) into a store (Zustand) + route-level
  code splitting per tab.
- SSE/streaming assess endpoint: stream stage completions so the narrated
  wait is REAL, then stream the verdict prose as Claude writes it.
- Playwright smoke suite for the six demo beats (the real-click editing bug
  proved synthetic tests lie — the suite must use real input events).
- Error tracking (Sentry) + a /health dashboard for demo day.
- Design tokens file (the Cursor-calm palette lives in Tailwind config;
  extract to CSS vars so themes are one file).
