# EMBER — the hour before, the demo, and the questions

*Three people. Read your own section. Do not improvise the numbers.*

---

## 1. Roles (assign now, do not swap later)

| Role | Who | Owns |
|---|---|---|
| **Narrator** | speaks the whole time | The story. Never touches the laptop. |
| **Driver** | laptop only | Clicks the script exactly. Says nothing except "watch this." |
| **Engineer** | answers judges | Architecture + Q&A. Has `AUDIT.md` open. |

The single most common demo failure is two people talking. **Only the Narrator
talks during the 90 seconds.**

---

## 2. The hour before (in this order)

1. **Deploy + verify** (Driver): Render settings → build `npm ci && npm run
   build`, start `node backend/dist/server.js`, auto-deploy ON, add
   `VITE_MAPBOX_TOKEN`, Manual Deploy latest commit. Then open the live URL and
   click the whole script once.
2. **Devpost submission** (Narrator): paste from `DEVPOST.md` — name, elevator
   pitch, story, tags, links. **Submit at the 20-minutes-left mark, not at the
   end.** A draft at the buzzer scores zero.
3. **Record a 60-second backup video** (Driver): screen-capture the golden path
   on localhost. Demos die; videos don't. Upload it to the Devpost video field.
4. **Two dry runs** (all three): full 90 seconds, out loud, timed.
5. **Freeze the code.** No commits in the last 30 minutes. None.

**Demo-day settings:** run the pinned **Palisades Fire** scenario (canned,
reproducible), and if the venue wifi is bad flip **Settings → guaranteed
offline mode** — it still works, and *saying that out loud scores points*.

---

## 3. The 90-second demo script (Narrator speaks, Driver clicks)

**[0:00 — the problem, before any clicking]**
> "In January, people in Pacific Palisades opened their phones during a
> wildfire. Their phone told them a fire existed, and gave them the fastest
> route to the freeway. That route was Sunset eastbound — where cars were
> abandoned and bulldozed. Everyone tells you a fire exists. Nobody tells you
> the safe way out."

**[0:15 — DRIVER: click "Palisades Fire"]**
> "Ember asks the question nobody else asks: not where is the fire, but
> *where will the fire be when I get there*."

**[0:25 — verdict lands, countdown ticking]**
> "Leave soon. Southeast. And that clock is real — it's counting down my actual
> escape window."

**[0:35 — DRIVER: point at the dashed red line and the ✕]**
> "This red route is what your phone gives you: 19 minutes, the fastest way
> out. We **refused** it. The fire reaches that road about twenty minutes
> before you'd clear it. That ✕ is the exact point you lose the race."

**[0:50 — DRIVER: scroll to the plan]**
> "And this isn't a next-turn breadcrumb — it's the whole escape. Every road,
> when you clear it, and what you cannot leave without: her oxygen tank, his
> EpiPen."

**[1:00 — DRIVER: People tab → tap Grandma Rose]**
> "Same fire. Same address. Different human. She uses a walker and needs
> twenty-five minutes just to get out the door — so the same engine tells her
> **stay inside**, every road is already cut. One alert for a whole zone is
> why vulnerable people die. This is the fix."

**[1:15 — DRIVER: back to Escape → "Go live"]**
> "And when it's a family, the hard question isn't where the fire is — it's
> who gets the kids. Watch: Uncle Dev is assigned, live, because diverting me
> costs my own escape window. That's recomputed every second from real
> positions."

**[1:25 — close]**
> "A deterministic engine makes every life-or-death call. AI only reads messy
> human reports and explains the answer — it never decides. Everyone tells you
> a fire exists. Ember tells you the way out."

**If something breaks:** Driver says nothing, switches to the backup video,
Narrator keeps talking. Never debug on stage.

---

## 4. The five-part story (for longer conversations / judging rubric)

**The problem.** Wildfire evacuation is an information failure, not an
awareness failure. People know there's a fire. They don't know which road
survives the next thirty minutes — and the tools they reach for optimize for
the wrong objective (ETA) or the wrong granularity (a whole zone gets one
message).

**The impact.** Paradise 2018: 85 dead, many on evacuation roads. Palisades
2025: gridlock on Sunset, cars abandoned and bulldozed. Lahaina 2023: 100+
dead at a bottleneck. The recurring pattern is people dying *while evacuating*,
often the people who needed the most head start. (Verify current figures before
quoting — we cite these as documented events, not our statistics.)

**The solution.** Race the hazard's arrival against the person's arrival, road
by road, on that person's clock — then refuse the routes they'd lose. Deliver
it as one instruction, one route, and the visible reason we rejected the rest.

**The innovation.** Not the fire model — that's a documented heuristic and
swappable. The innovation is **the join**: hazard-time × person-time ×
personal constraints, shipped as a consumer-grade decision, with a
deterministic core so it's auditable and an AI boundary so it's safe. Nobody
ships that: Watch Duty is awareness without routing, Genasys is zones without
persons, Google/Waze is ETA without survival, Life360 is location without
hazard.

**The technical difficulty.** Time-evolving danger fields; per-segment
time-aware scoring; making an LLM safe by verifying its output against
geometry; a resilience contract where every stage degrades and the last never
fails; reproducibility discipline so a pinned demo is byte-stable.

**Future innovation.** On-device judge (verdicts without cell towers),
pluggable spread models, evacuation-flow modelling, multi-hazard via the same
DangerField, responder deployments.

**Money.** Counties/state agencies buy routing next to the alerting they
already pay for; insurers and utilities buy it as loss-and-liability
reduction; families pay for peacetime household features. **The emergency
function is free forever** — charging someone to evacuate is indefensible.

**Onboarding problem (the honest one).** Nobody installs an evacuation app
while the sky is blue, and nobody configures a household while it's orange.
Our answer is architectural: the household is set up once in peacetime (two
minutes), and the emergency interaction is a single tap on your own name.
Distribution comes from counties and insurers pushing it *before* fire season
— not from consumers finding us during one.

---

## 5. Q&A — one-line answers (Engineer owns these)

- **"Is the AI deciding?"** No. Pure deterministic judge. Claude reads
  free-text reports and phrases prose; geometry verifies every fact it
  extracts; the engine decides. Search our judge for the word "fire" — it's in
  comments only.
- **"Your fire model isn't real physics."** Correct, and we say so on the
  screen. It's two documented rules of thumb, deliberately over-drawn — our
  failure mode is a detour, not a death. The judge consumes an interface, so a
  real model (ELMFIRE) drops in without touching decision logic.
- **"Wouldn't Google just do this?"** Their objective is ETA among currently
  open roads, and their liability posture keeps them descriptive. They will not
  tell a user "your fastest route will kill you." That sentence is our product.
- **"What about traffic?"** The honest gap. We model your clock and the fire's
  clock; crowd-flow modelling is next, and our per-person staggered departure
  times (5 min vs 25 min prep) are already a mitigation.
- **"What if you're wrong and someone dies?"** Every threshold fails toward
  caution, every margin and source is displayed, and we never claim "safe" —
  we claim "we refused the road the fire beats you to." It's a decision aid;
  the disclaimer is on every screen.
- **"Privacy?"** Location off in peacetime; per-incident opt-in;
  household-only; auto-expiring; precise location never sold. Life360 built
  this category then sold location data to brokers — we wrote the opposite
  into the product's Settings tab.
- **"What's the moat?"** The race framework plus the dataset nobody else is
  positioned to collect: which roads stayed passable, at which minute, and how
  long real evacuees took to clear them, by mobility class.
