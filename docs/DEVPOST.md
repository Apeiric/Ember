# EMBER — Devpost submission (copy-paste ready)

---

## Project name

```
Ember
```

## Elevator pitch (200 char limit — this is 168)

```
Everyone tells you a fire exists. Ember tells you the safe way out — routing by where the fire will BE when you arrive, personalized to how fast you can actually move.
```

---

## About the project (paste into the Markdown box)

## Inspiration

We came to this hackathon thinking about firefighters. A crew rolling up to a
street doesn't have the information they need about the houses in front of
them — who's inside, who can't walk out on their own, which door to hit first.
That's a real gap, and someone here was building for it.

Brainstorming around that problem, we hit a harder one hiding underneath it:
**the people inside those houses are getting even worse information than the
crews are.**

During the January 2025 Palisades Fire, people did what everyone does — they
opened their phone. Their phone told them a fire existed and offered the
fastest route to the freeway. That route was Sunset Boulevard eastbound, and
cars ended up abandoned on it while a bulldozer cleared a path through them.
In Paradise in 2018, 85 people died, many of them on or beside evacuation
roads.

Those people weren't uninformed. They were *misinformed by tools optimizing
for the wrong thing.* An alert tells you a fire exists. A navigation app tells
you the fastest road. Nobody tells you **the safe way out** — and nobody
changes the answer for an 81-year-old on oxygen versus a healthy adult with
car keys in their hand.

So we built the missing layer.

## What it does

Ember answers one question no other product answers:

> **"Where will the fire be when I get there — and how fast can THIS person
> actually move?"**

For every candidate escape route, for every point along it, Ember computes two
numbers: when *you* arrive, and when the *danger* arrives. The gap between
them is your margin. The smallest gap anywhere on the route is your deadline.
If it goes negative, the fire wins the race — and we refuse to send you that
way, no matter how fast the road is.

That produces things nothing else does:

- **A refusal.** On our Palisades scenario, the fastest route (Sunset east to
  the I-405, 19 min) is **REJECTED** — the fire reaches that road ~20 minutes
  before you'd clear it. The map marks the exact point with an ✕ and the words
  "THE FIRE GETS HERE FIRST." The recommended route gets a ✓ where you pass
  ~34 minutes ahead of the danger.
- **A different answer per person.** Same fire, same address, same engine:
  a healthy adult gets *LEAVE SOON — southeast, 24 minutes*. Grandma Rose
  (walker, oxygen, 25 minutes just to get out the door) gets *STAY INSIDE —
  every road out is cut*. The kids at school with no car get *STAY INSIDE*.
  That's not a different mode. It's the same arithmetic with her constraints.
- **The whole plan, not the next turn.** Door-to-safe: prep time, every road
  in sequence with per-step ETAs on *your* clock, the tightest point called
  out, arrival — plus "Don't leave without: oxygen tank · EpiPen" from that
  person's profile, and a "Why not the Getty Center? Because the fire cuts
  that road ~20 min before you would pass" line.
- **Live family coordination.** Everyone's position on one map, and the one
  decision that matters recomputed continuously: *who picks up the kids?* When
  the math flips, it says so and why — "You are nearer on the map, but the
  detour spends ~5 min of your own escape window — Uncle Dev covers it without
  costing anyone theirs."
- **Messy human input, safely.** Paste a neighbour's text — "power line down
  across Sunset near the east side" — and Claude reads it, geometry *verifies*
  it against real route segments, and the deterministic engine re-judges in
  about a second.
- **Responder mode.** The same engine inverted: addresses ranked by whose last
  passable route closes first. A knock list, from the identical data.

## How we built it

**The architecture is the innovation as much as the feature is.**

- **A pure, deterministic judge.** `judge.ts` has no I/O, no network, no LLM,
  and never sees the word "fire" — it consumes a `DangerField` (polygons with
  a severity and an arrival time) and returns verdicts. Same inputs, same
  outputs, every time, fully unit-tested. **The life-or-death decision is
  never made by a language model.**
- **AI reads; geometry verifies; the engine decides.** Claude parses
  unstructured field reports into structured facts. Every extracted road is
  matched against real route geometry — a hallucinated street matches nothing
  and never reaches the judge. Direction-scoped, and it fails closed. A
  hostile report can only ever ADD caution; it can never open a road.
- **Hazard-agnostic by construction.** Fire, an official evacuation order, a
  neighbour's text, and a Caltrans closure all become the same `DangerZone`
  structure. Flood would be a new producer of the same type — the judge,
  routing, personalization, and verdict wouldn't change by a line.
- **Every external call has a fallback chain** (live → cached → canned →
  mock), each with a timeout, and **the last strategy can never fail**. Every
  value carries provenance, and the UI badges LIVE vs DEMO DATA. It degrades
  loudly instead of lying quietly. It runs with zero API keys.

**Stack:** React + TypeScript + Tailwind + Vite; Node + Express + TypeScript;
Mapbox GL for 2D, Cesium + Google Photorealistic 3D Tiles for the fly-in;
Claude Opus 5 for interpretation and phrasing; Google Directions/Geocoding,
NASA FIRMS, NIFC, Open-Meteo, Caltrans LCS, CAL FIRE/Cal OES evacuation zones.
npm workspaces monorepo with one canonical shared types file.

## Challenges we ran into

- **Routes drew straight lines across the Pacific.** Our offline demo geometry
  was hand-drawn waypoints, and straight segments between coarse points clipped
  the coastline. We fetched real Google Directions geometry once and baked it
  into the fixtures — so the demo follows real roads *and* still runs with zero
  network. Re-deriving the betrayal on real geometry then required correcting
  the fire's shape to match how it actually moved (a southeast finger toward
  Rustic Canyon, plus an eastern spot fire).
- **A bug that would have killed someone.** Claude extracted "power line across
  PCH **south**" as a danger area; our locator saw the word "south" and dropped
  a 1.2 km hazard **on the user's own house**. We now require a real area phrase
  and scope blocks to the correct side of the road. It's the sharpest lesson we
  learned about LLM output: it must be verified against geometry, never trusted.
- **An invisible element ate real clicks.** Profile editing "didn't work" and
  we twice believed we'd fixed it — because our tests used synthetic
  `.click()`, which bypasses hit-testing. Driving real mouse events exposed the
  Mapbox logo (z-index 2) floating over the panel and swallowing clicks exactly
  where SAVE sat. **Synthetic tests lie.**
- **A React updater timing bug** made every first pickup assignment log as a
  "reassignment" — the event object was built inside a `setState` updater, which
  runs at render time, after the ref it read had already advanced.
- **Reproducibility discipline.** A pinned demo scenario must be *fully* canned
  at every stage; we found three separate places where one stage silently went
  live and produced an incoherent story on stage.

## Accomplishments we're proud of

- The betrayal is **derived, not staged.** We tuned real geometry until the
  real judge produced the rejection, then locked it with tests. 51 passing
  tests, and the judge has never been special-cased for the demo.
- **Same fire, three different verdicts for three people** — the accessibility
  argument made undeniable in one screen.
- It **cannot break on stage**: zero keys, zero network, and it says so.
- We wrote down our own weaknesses (see `docs/AUDIT.md`) instead of hiding them.

## What we learned

The hard part of applying AI to safety isn't capability — it's **boundaries**.
Our best decision was refusing to let the model decide anything. It reads
messy human language; geometry checks it; deterministic code owns the
life-or-death call. That's what makes it defensible to a user, an engineer,
and a lawyer.

We also learned that in an emergency interface, **explaining the refusal is
the product.** People don't follow a green line because an app is confident.
They follow it because they can see the ✕ where the other route dies.

## What's next

Real `watchPosition` live tracking (per-incident opt-in, household-only,
auto-expiring — we treat location like medical data); a PWA with an
**on-device judge** so verdicts survive dead cell towers; a pluggable
fire-spread model (ELMFIRE) behind the same interface; evacuation-flow
modelling for the queueing failure that actually killed Paradise; and county
deployments where residents get routing and crews get the knock list from one
engine.

---

## Built with (tags)

```
typescript, react, tailwindcss, vite, node.js, express, claude, anthropic,
mapbox, cesium, google-maps, geospatial, nasa-firms, arcgis, zod, vitest, render
```

## Try it out links

```
https://github.com/Apeiric/Ember
https://ember-lk17.onrender.com
```

## Sponsor / special prizes to tick

```
1st Place · Developer Track · AI/ML Track · R&I Track
```
