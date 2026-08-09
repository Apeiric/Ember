# EMBER — the pitch, the moat, and the hard questions

*Working doc for the presentation. Every claim marked ⚠ should be re-verified
against a primary source before you say it on stage — do not quote numbers you
have not checked that morning.*

---

## 1. The through-line (say this in every answer)

> **Everyone tells you a fire exists. Nobody tells you the safe way out.**
> Alerts draw a polygon. Navigation apps optimise for traffic. Ember is the
> only layer that asks the question that decides whether you live:
> **"where will the fire be when I get there — and how fast can THIS person
> actually move?"**

Three sentences that survive any question:
1. **Alerts describe the hazard. We decide the route.** (product)
2. **A deterministic judge decides; AI only reads and explains.** (trust)
3. **Same fire, different verdict per person — because an 81-year-old on
   oxygen and a healthy adult are not the same evacuee.** (why it's new)

---

## 2. "How do you account for disabilities / grandparents?" — the exact math

This is not a label, it is arithmetic the judge runs (`shared/src/constants.ts`,
`backend/src/services/profiles.ts`):

| Knob | Healthy adult | Reduced mobility | Why |
|---|---|---|---|
| Prep time (out the door) | 5 min | **25 min** | walker, oxygen tank, medication, another person to move |
| Pace multiplier | 1.0× | **1.45×** | slower to load, drive, decide at junctions |
| Safety margin | 10 min | **30 min** | no capacity to sprint if the projection is wrong |
| Max tolerable danger | 0.6 | **0.35** | do not send frail people through smoke |
| Slope penalty | 0 | 1.5 | steep routes cost extra |
| No car | — | pace ×7 (walking), +10 prep, +25 margin | a 15-min drive is a 2-hour walk |
| Pets | +5 min prep | +5 min prep | loading the cat is real minutes |

Then the same deterministic race is run point-by-point: *your* arrival time vs
the fire's arrival time. The demo shows the consequence live: at the same
address, the healthy adult gets **LEAVE — PCH south, 24 minutes**; Grandma
Rose gets **STAY INSIDE — every road is cut**, because her 25-minute prep eats
the escape window. That is the product in one screen.

**Roadmap version:** profiles come from a 2-minute setup done in peacetime
(already in the app), eventually imported from Medicare/Medicaid special-needs
registries and county access-and-functional-needs (AFN) lists — the exact
population that died in Paradise.

---

## 3. "Prove Google/alerts fail at this" — the evidence list

⚠ Verify each before quoting. The pattern you are proving: **existing tools
either describe the hazard or optimise for traffic — neither models the hazard's
motion against the evacuee's motion.**

- **Camp Fire, Paradise 2018:** 85 dead, many in or beside their cars on
  gridlocked evacuation roads. The town had an evacuation plan; the fire moved
  faster than the plan. (⚠ Butte County DA report "The Camp Fire Public
  Report" documents road-by-road deaths.)
- **Palisades Fire, Jan 2025:** Sunset Blvd gridlock; people abandoned cars
  and fled on foot; a bulldozer cleared abandoned vehicles. Navigation still
  showed "fastest route" logic. (⚠ LAFD/LA Times coverage, 7–8 Jan 2025.)
- **Lahaina, Maui 2023:** 100+ dead; Front Street bottleneck; no evacuation
  order reached many; some who followed the obvious coastal road died, some
  who broke "wrong way" survived. (⚠ Maui After-Action reports.)
- **2017 LA-area fires:** navigation apps were reported directing drivers
  toward burning neighbourhoods because those roads were "empty" — the
  traffic-optimiser reading fire-emptied streets as fast streets. (⚠ widely
  reported; find the primary LAPD/Waze statements.)
- **What Google actually ships:** SOS alerts, a fire-perimeter layer, and
  (since 2019-2023) *static* "avoid area" hints. It draws where the fire IS.
  It does not (a) project where it is GOING, (b) reject a route that will be
  cut off mid-drive, or (c) change the answer for a walker vs a driver. Their
  routing objective is ETA, and their liability posture keeps them there.
- **Official alerts (WEA/Genasys/Watch Duty):** zone-level, identical text
  for everyone in the polygon, no route. Watch Duty (nonprofit, ~1M+ users
  during LA fires ⚠) proves demand for fire INFO; nobody owns fire ROUTING.

**The one-line indictment:** *during the LA fires, your phone could tell you
where the fire was and the fastest road — and both of those answers could
kill you. The gap between "informed" and "safe" is our product.*

---

## 4. Revenue model (in order of credibility)

1. **B2G — counties & states (SaaS).** Emergency management offices already
   buy Genasys/Everbridge for alerting ($50k–$500k/yr contracts ⚠). We are the
   *routing* line-item next to the *alerting* line-item. CalOES + the 10
   WUI-heaviest counties is a real first-year pipeline.
2. **B2B — insurers.** Wildfire is why insurers are fleeing California.
   A carrier that gives Ember to policyholders reduces life & auto losses and
   earns retention; parametric-style data (who was where, what was passable)
   feeds their cat models. Pilot: one carrier, one county, one season.
3. **B2B — utilities (PG&E, SCE).** They already run PSPS event ops and carry
   the liability for ignition. Evacuation-readiness for customers in their
   ignition-risk zones is corporate-liability money, not marketing money.
4. **B2C freemium.** The app is free in an emergency, always (charging to
   evacuate is both immoral and terrible PR). Paid tier ($5–8/mo, Life360
   pricing) is the *peacetime* product: household profiles, drills, multi-hazard
   monitoring, family coordination. Life360 proved families pay ~$25/mo for
   "know my people are safe" (⚠ check their current ARPU/plans).
5. **Data (see §6)** — aggregated, consented, sold to routing/insurance/gov,
   never individual location resale (see §5).

Say #1 first. Judges believe governments buy safety; they are skeptical
consumers will.

---

## 5. Privacy — "you're tracking families" (learn from Life360's scar tissue)

Life360's lesson: they built the family-safety category, then got caught
**selling precise location data to ~a dozen brokers** (The Markup, 2021 ⚠),
faced backlash, and had to publicly stop selling precise data. The category
works; the data-resale model poisons it.

Our policy, stated as product design, not legalese:
- **Peacetime:** location OFF by default. Profiles are static (address,
  mobility, vehicle) and editable; nothing pings.
- **Emergency mode:** live location is opt-in per event, shared only with
  your named household, and **auto-expires when the incident closes.**
- **No precise-location resale, ever.** The only data products are aggregate
  and k-anonymised (see §6).
- **On-record deletion:** end of incident → purge raw traces; keep only the
  derived, de-identified telemetry.
- Frame: *"Life360 built trust and spent it. We treat location like medical
  data because in a fire, it is."*

---

## 6. "What if Google pulls the Maps API?" + the data flywheel

**Dependency honesty:** today Google supplies geocoding + road-following
routes. If they cut us off tomorrow:
- **Already built:** every stage of our pipeline has a fallback chain
  (live → cached → canned); the demo runs with zero keys. The judge, the
  danger projection, the personalization — the actual IP — never touch Google.
- **Swap path:** routing on **OSRM/Valhalla over OpenStreetMap** (self-hosted,
  free), geocoding on **Pelias/Nominatim**, tiles on **Mapbox/Protomaps**.
  Directions quality drops slightly; the verdict logic is untouched. This is
  a 1–2 week migration, not an existential event — and for B2G deployments we
  would self-host routing anyway (govs require it).
- **Deeper truth:** Google's strength is *traffic*; in a mass evacuation,
  historical traffic priors are exactly what's WRONG. Our edge is the hazard
  field, not the road graph. Roads are commodity; the race calculation is not.

**The flywheel (the "sell it back" question):** every evacuation we route
generates the dataset nobody has — *which roads actually stayed passable, at
what minute, under what fire behaviour, and how long real evacuees (by
mobility class) took to clear them.* That is:
- ground truth for **fire-spread model validation** (sell to modellers/agencies),
- **evacuation-time curves** for insurers' cat models and county planners,
- a **"resilience layer"** Google/Apple could license — aggregated
  road-survivability during disasters, which their traffic layer cannot see
  because traffic dies when the cell towers do.
Positioning: we are not a Maps competitor; we are the **hazard-race layer**
that any map company would rather license than rebuild under liability.

---

## 7. Firefighter / responder mode (roadmap, don't overbuild)

Same engine, inverted question: civilians ask "route me around the fire";
responders ask **"which addresses lose their last exit in the next 30
minutes?"** The judge already computes per-address cutoff times — sorting a
neighbourhood by `minutesUntilCutoff` IS a triage list:
- **Knock-list ordering:** send engines to the streets whose escape windows
  close soonest (we already demo this — the family view sorted by urgency is
  the same feature at house scale).
- **Resource placement:** a road that dies at minute 40 is where you stage
  the traffic officers at minute 20.
- Sales channel: this is the B2G demo that makes counties buy §4.1.

---

## 8. Weak points — own them before the judges find them

1. **Fire projection is a heuristic** (wind + slope rules of thumb, deliberately
   over-drawn). Answer: the architecture accepts any `DangerField` — swap in
   ELMFIRE/WRF-SFIRE server-side without touching the judge. The moat is the
   race framework, not the spread model.
2. **Traffic under panic is unmodelled.** Congestion multipliers per-profile
   exist (evacuation-realistic durations), but real mass-evac flow modelling
   (contraflow, intersection failure) is roadmap — say "we model the fire's
   clock and your clock; crowd dynamics is our next data partnership."
3. **Liability.** We never say "safe"; we say "we refused the road the fire
   beats you to." Deterministic + explainable + logged = defensible. The LLM
   never decides — that sentence matters to lawyers as much as to judges.
4. **Cold start / adoption.** Nobody downloads an evacuation app the night of
   the fire. Answer: distribution through counties/insurers/utilities (§4),
   who push it to residents BEFORE fire season — the household setup is the
   peacetime hook.
5. **False alarms erode trust.** Over-drawn danger = earlier "leave" calls.
   We show margins and provenance on every verdict; trust is a UI feature.

---

## 9. Demo script beats (90 seconds)

1. Address in, **LEAVE SOON — 24 minutes** fills the screen.
2. *"Your phone says take Sunset to the 405 — 19 minutes, fastest."* Point at
   the dashed red line dying at the ✕: **"the fire reaches that road 20
   minutes before you do. We refused it."**
3. Tap **Grandma Rose** → same fire, **STAY INSIDE** — *"same fire, different
   human, different answer."*
4. Paste a neighbour's text — *"power line down across Sunset east side"* —
   watch the block land on the exact segments and the plan re-route. *"Claude
   read it; geometry verified it; the judge decided."*
5. **The whole plan** panel: door-to-safe, step by step, with the minute you
   pass the tightest point. *"This is what 'told to evacuate' should feel
   like."*
