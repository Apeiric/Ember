# EMBER — the pitch

*One idea, stated once, then proven. Three voices, five minutes.*

---

## THE IDEA (everything below is downstream of this)

> **Every navigation app assumes the map is standing still.**
> **In a wildfire, the map is moving — and that assumption kills people.**

A fire is not an obstacle sitting on a map. It is a **moving front**, running
downwind and uphill at kilometres per hour. The road that is fastest at 9:00 is
gone at 9:20.

So when your phone says *"fastest route, 19 minutes"*, it is answering a
question about a world that will not exist by the time you arrive.

**Ember is a routing engine that treats the map as moving.** It computes where
the fire will be, minute by minute, and then on every road it runs a race:
*the fire's arrival time against yours.* If you lose that race, the road is
refused — no matter how fast it is.

And **you** matters. Someone who needs twenty-five minutes to get out the door
is running a different race, on the same road, than someone with keys in hand.

**One-line version, for anyone who asks:**
> "Maps route you through the world as it is. Ember routes you through the
> world as it will be — and it runs the numbers differently for your
> grandmother than for you."

---

## Beat map

| # | Beat | Who | Time | Take-away |
|---|---|---|---|---|
| 1 | The broken assumption | A | 0:40 | Maps freeze the world; fires move |
| 2 | Meet the household | B | 0:15 | Four people the room will care about |
| 3 | The demo | B | 1:15 | Each beat proves one claim |
| 4 | How it's built | C | 0:35 | The engine is a machine, not a model |
| 5 | What it changes | A | 0:15 | One engine, two customers |

**Rule:** whoever is not speaking does not talk. Drop a line and the next person
picks it up.

**Names:** A ________ · B ________ · C ________

---

## ① THE BROKEN ASSUMPTION — A, 40 s, no laptop

> "Every navigation app in the world makes one assumption: **that the map is
> standing still.** That the road you're driving toward will still be there
> when you arrive.
>
> In a wildfire, that assumption kills people.
>
> Because a fire isn't an obstacle on a map. It's a **front**, moving downwind
> and uphill, kilometres an hour. The safest road at nine o'clock is gone at
> nine twenty.
>
> January, Pacific Palisades. Thousands of people evacuating at once, and every
> one of them pulls out their phone. The alert says *there is a fire near you.*
> Maps says *fastest way out — Sunset Boulevard, east, nineteen minutes.*
>
> That's where everyone went. That's where cars were abandoned and bulldozed
> aside.
>
> Paradise, 2018: eighty-five people dead, many of them **on the evacuation
> route.** They weren't uninformed. They had the alert, and they had directions.
> Both tools were answering a question about a world that had already changed.
>
> So we built the one that doesn't. **Ember treats the map as moving.** It
> computes where the fire will be, minute by minute, and races that against
> where *you* will be — on every road, at your speed.
>
> B."

## ② MEET THE HOUSEHOLD — B, 15 s, People tab open

> "One household, four people. They're the whole point.
>
> **Me** — healthy, car in the driveway.
> **Rose**, my grandmother — eighty-one, walker, oxygen tank. Twenty-five
> minutes just to get out the door.
> **Maya and Sam** — at school, no car, can't leave alone.
> **Dev**, my uncle — across town, has a car.
>
> You set this up once, months before anything happens. That's the only work
> this app ever asks of you. Now the fire starts."

## ③ THE DEMO — B, 75 s

**[Escape → "Palisades Fire"]**

> "Perimeter, satellite hotspots, wind, official closures — pulled live. Then
> the part that makes this different: **it doesn't stop at where the fire is.**
> Those rings are a forecast. Fire here in twenty minutes. Thirty. Forty-five.
>
> Now every candidate road gets sampled every hundred and fifty metres, and at
> each point we compute two numbers: **when the fire arrives, and when I
> arrive.** The smallest gap on the whole route is my margin."

**[verdict lands]**

> "Leave soon, head southeast — and that clock is my margin, counting down in
> real time."

**[the dashed red line and the ✕]**

> "Here's the one that matters. **This red line is what my phone gives me** —
> nineteen minutes, the fastest way out. **Ember refuses it.**
>
> The fire crosses that road about twenty minutes before I'd reach it. The ✕ is
> the exact point I lose the race. We don't quietly hide the bad route — we
> show it, and we show the number that killed it. **That's the product.**"

**[The Whole Plan]**

> "And it's not turn-by-turn — it's the whole escape before I commit: every
> road, when I clear it, where I end up. Plus what you forget while panicking:
> the oxygen tank, the EpiPen."

**[People → Rose]**

> "Now. Same fire. Same street. **Different person.**
>
> Rose needs twenty-five minutes before she's even moving, and she's slower
> once she is. Same engine, same roads, **her** numbers — and the answer
> inverts: **stay inside, every road out is already cut.**
>
> An official alert sends one message to an entire zone. Which means the people
> who need the most warning get exactly the same warning as everyone else.
> That's who dies. **This is the fix.**"

**[Escape → "Go live"]**

> "With a family, the hardest question isn't where the fire is — it's **who
> gets the kids.**
>
> It picks **Dev**, not me. I'm physically closer. But diverting me spends five
> minutes of my own margin, and Dev can cover it without costing anyone theirs.
> Re-evaluated every second as people move.
>
> C — how it's built."

## ④ HOW IT'S BUILT — C, 35 s

> "Three engineering decisions, because this decides whether people live.
>
> **One — the decision is a machine, not a model.** Everything the fire does
> becomes one structure: polygons with a severity and an arrival time. The
> engine takes that structure and returns a verdict. No network, no model,
> deterministic, unit-tested. It has never seen the word 'fire' — which is why
> flood or chemical plume is a new input, not a new product.
>
> **Two — the AI reads, geometry decides.** Paste a neighbour's text, *'power
> line down across Sunset'* — Claude turns that into structured facts, and then
> every road it names is matched against real route geometry before it counts.
> Invent a street and it matches nothing and is discarded. A wrong report can
> only ever make us **more** cautious — it can never open a road. That
> asymmetry is the safety model.
>
> **Three — it degrades loudly.** Every source has a fallback chain and the
> last link cannot fail. It runs with zero API keys. Every value on screen
> declares whether it's live or canned — if a feed dies mid-demo, you'll see it
> say so rather than quietly guess."

## ⑤ WHAT IT CHANGES — A, 15 s

> "Same engine, pointed the other way: give it a neighbourhood and it ranks
> houses by **whose last road out closes first.** A knock list for fire crews,
> ordered by who runs out of time first.
>
> A county buys once and gets both — routing for residents, triage for crews.
>
> Maps route you through the world as it is. **Ember routes you through the
> world as it will be.**"

---

## IF THE ROOM LOOKS LOST

> "Simplest version: your phone gives you the fastest road. We give you the
> road that's still open when you get there — and a different answer for your
> grandmother than for you."

---

# DEEP DIVE — for the judging table, not the stage

Use these when you get more than five minutes. Two sentences on stage;
everything below when someone leans in.

## The four hardest engineering problems

**1. Making the danger field time-aware, not a snapshot.**
Naively you'd ask "is this point dangerous?" — that's what every hazard map
does, and it's useless for routing, because you're asking about *now* and
driving into *later*. We generate nested time rings (0/10/20/30/45/60/90 min)
from a spread model, each carrying a severity and an arrival time, and the
engine queries `dangerAt(point, minutesFromNow)`. Every question the system
asks is indexed by **when**, not just where.

**2. Timing the route correctly.**
"How far along am I?" is the wrong denominator. A canyon road and a highway
cover the same distance in wildly different times, so we time each segment
independently and carry a cumulative clock — your arrival at any point is
`prep time + travel × your pace multiplier`. The prep time is why Rose's
verdict inverts: twenty-five minutes of not moving while the fire keeps
moving.

**3. Making an LLM safe enough to touch a life-or-death system.**
Our sharpest lesson: Claude extracted "power line across PCH **south**" as a
danger area, and our first locator saw the word "south" and dropped a 1.2 km
hazard **on the user's own house**. The fix is architectural, not a better
prompt: extracted facts are *proposals*, and geometry is the judge. Road names
are matched against real route segments; direction qualifiers are scoped so
"the east side of Sunset" can't close the western stretch; anything unmatched
is shown to the user but never reaches the engine. Fails closed, always.

**4. A demo that cannot lie.**
Every stage runs a chain — live → cached → canned → mock — each with a
timeout, and the last link is required never to fail. Every value carries
provenance, and the UI badges it. The discipline that costs the most: a pinned
scenario must be canned at *every* stage, because one stage silently going
live produces a coherent-looking, completely incoherent story.

## The safety architecture (ask us about any of these)

- **Asymmetric failure.** We deliberately over-draw danger. A false "dangerous"
  costs a detour; a false "safe" costs a life. Every threshold is tuned toward
  caution, on purpose.
- **Reports can only add danger.** There is no code path where user input opens
  a road. Hostile or mistaken input costs you a detour, never a life.
- **The vulnerable are never volunteered.** The coordination engine will not
  assign a rescue to someone with reduced mobility — they're who we're trying
  to get out. (We caught this one *in testing*: it had assigned the
  eighty-one-year-old on oxygen to collect two children.)
- **Advisory vs lethal are different types.** An evacuation *order* means
  "leave", not "this ground is lethal" — treating them the same makes your own
  doorstep a hazard and returns "shelter in place" to someone who was simply
  told to evacuate.
- **We never say "safe".** We say "we refused the road the fire beats you to."
  Every screen carries the disclaimer that this is a decision aid and emergency
  services outrank us.
- **Degradation is visible.** If routing falls back to straight-line bearings,
  the app says so in words rather than drawing confident lines.

## The business

**Free forever in an emergency.** Charging someone to evacuate is
indefensible, and we'd rather bind ourselves to that now than discover the
temptation later.

**Revenue, in order of how believable it is:**
1. **Counties and state agencies.** They already carry budget for mass
   alerting. We're the *routing* line item next to the *alerting* line item —
   and the responder knock list means one purchase serves residents and crews.
2. **Insurers.** Wildfire is why carriers are leaving California. Life and auto
   loss reduction, retention, and better catastrophe modelling from real
   evacuation data.
3. **Utilities.** They run public-safety power shutoffs and carry ignition
   liability. Evacuation readiness for customers in their risk zones is
   liability spend, not marketing spend.
4. **Households, in peacetime.** Profiles, drills, coordination — the Life360
   shape, where families already pay for "are my people safe."

**The data flywheel — and the line we won't cross.** Every routed evacuation
produces something that does not currently exist: *which roads stayed passable,
at what minute, under what fire behaviour, and how long real people took to
clear them, by mobility class.* That's ground truth for fire-model validation,
for insurers' catastrophe models, and for county planners. **Aggregate and
de-identified only** — precise location is never sold. Life360 built this
category and then sold location data to brokers; we wrote the opposite into the
product's own settings page.

## What we'd fix next, in order

1. Real device tracking (`watchPosition`, per-incident opt-in) — the
   coordination layer is built against exactly this interface today.
2. An on-device engine — it's pure code with no I/O, so a verdict can survive
   dead cell towers. That's the version that works when it matters most.
3. A real fire-spread model (ELMFIRE) behind the existing interface.
4. Evacuation flow modelling — the queueing failure that actually killed
   Paradise, and our honest gap today.

---

## BEFORE YOU GO ON

1. Warm the live site — click Palisades once, leave it on Escape.
2. **Demo with the "Palisades Fire" chip, never a typed address.**
3. Backups: live → localhost tab → 60-second recording. Never debug on stage.
4. Freeze. No commits, no deploys.

## THE THREE THINGS THAT MUST LAND

1. **"Every map assumes the world is standing still. A fire moves."**
2. **"We refused the fastest route"** — with the ✕ on screen.
3. **"Same fire, same street, different person, opposite answer."**
