# EMBER — the user experience, screen by screen

*The design walkthrough: what a person sees at every moment, why it is built
that way, and what we judged "too basic" and rebuilt. Read this before the
pitch — the answer to "walk me through the UX" is this file, spoken.*

---

## 0. The design law the whole app obeys

**One surface, one job. Compartments, not overlays.**

A person mid-evacuation gets exactly one kind of screen: the emergency.
Everything else — profile editing, coordination, settings — lives behind a
tab, never on top of the map. The corollary: anything a frightened person
must do gets ONE obvious control; anything done in peacetime can afford
detail.

Second law: **the interface always shows its reasoning.** Every claim on
screen traces to a number the judge computed (the ✕ where the fire wins, the
"why not" line, provenance badges). Trust is earned per-verdict, not asserted.

---

## 1. First open — the onboarding

**What you see:** the map idling over LA, and one card:

> Everyone tells you a fire *exists*. Ember tells you the way **out**.
> 1. Set up your people once, in peacetime — addresses, mobility, medications
> 2. When it burns, tap who you are — we race the fire for every road
> 3. Follow one green line — and see exactly why we refused the others

Two buttons: **Set up your household** (primary — the one action that matters
before a fire) and **See the Palisades Fire demo** (for judges and skeptics).

**Why this design:** onboarding is a *claim*, not a tour. Three numbered lines
teach the entire product loop (peacetime setup → identity tap → one green
line). No modal, no carousel, no permission-begging — the card simply yields
once there is a verdict to show.

**The identity chip** — "Assessing for **You** · moves quickly — Change →" —
sits under the card from the first frame, so "who is this answer for?" always
has a visible answer and a one-tap path to change it.

## 2. The wait — a pipeline that narrates itself

**What you see** after entering an address: the onboarding card is replaced by
**"Working out your way out"** — six stages that check off in order:

> ✓ Finding your address → ✓ Reading the fire (perimeter · hotspots · wind) →
> ✓ Projecting where it goes → ✓ Checking official sources → ⟳ Racing every
> road (fire's arrival vs yours, point by point) → Writing it plainly

**Why:** the 10–20 second first assessment is the most anxious wait in the
product, and it used to show static marketing copy — the single most "basic"
moment we found. Now the wait *teaches the architecture*: the user arrives at
the verdict already knowing how it was made. (Timing is cosmetic; the stages
and their order are the real pipeline. Never list a stage we don't run.)

## 3. The verdict — PRIMARY, unmissable

**What you see:** a full-bleed color card — **LEAVE SOON / Go while the road
is still open** — with exactly three facts: which way (SOUTHEAST), how long
(24 minutes), when the road closes (~34 min). Color = urgency
(red/orange/amber/grey); the only pulsing state is EVACUATE NOW.

Directly beneath, the anti-verdict: **"WE DID NOT SEND YOU THIS WAY"** — the
fastest route, named, with the number that killed it. The refusal is the
product's credibility, so it sits adjacent to the instruction, always.

## 4. The whole plan — the escape as a checklist

**What you see:** a timeline card, "18 km · about 27 min door to safe":

> ● Get out the door (min 0–5) — *Don't leave without: oxygen tank · EpiPen…*
> 1. Palisades Dr — head south (by min 11)
> 2. Sunset Blvd — head south (by min 15) — *✓ tightest point: you pass ~34
>    min ahead of the danger*
> 3. PCH south — head east (by min 27)
> ★ Arrive: Santa Monica Civic Center
> **Why not I-405 / Getty Center?** Because the fire cuts that road ~20 min
> before you would pass.

**Why:** a breadcrumb ("turn left in 400 ft") assumes calm and connectivity.
An evacuation brief must be graspable BEFORE you commit and survivable if the
screen never updates again. Every number derives from the judge's segments on
*this person's* clock (their prep, their pace). The grab-list is personalized
memory under stress — the EpiPen forgotten is a return trip into smoke. The
"why not" row answers the question every passenger asks out loud.

Rows stagger in (70 ms) so the route visibly assembles — motion as meaning,
killed automatically under `prefers-reduced-motion`.

## 5. The map — the argument, drawn

Layer order tells the story: labelled forecast rings ("FIRE HERE IN ~30
MIN") → official evac zones (faint violet) → the fire + satellite hotspots →
dashed red rejected routes → the green line → **"SR-1 CLOSED"** strokes →
the two proof markers (✕ "THE FIRE GETS HERE FIRST ~20 min before you", ✓
"YOU CLEAR THIS POINT ~34 min ahead") → your people as named pins.

Tapping a pin re-runs the assessment as that person — selection is
emergency-flow, so it works everywhere; editing is not, so it doesn't.

**"Understand it in 3D"** lifts the same scene onto photorealistic 3D tiles —
the comprehension beat for someone who cannot read a map under stress: the
fire is *in their actual hills*, over their actual streets.

## 6. Live updates — messy world in, judged world out

**What you see:** "Something changed?" — paste anything ("power line down
across Sunset near the east side"). The reply shows what Claude read, what
geometry verified, and the block lands ON the named segments; the verdict
re-judges in about a second on repeat runs (first read of a new report pays
one ~5 s Claude pass; every re-run after is cached, and the prose pass is
skipped so the deterministic answer returns instantly).

**Why:** the LLM is a *reader*, never a decider — extracted facts are checked
against real route geometry, direction-scoped ("east side" ≠ the western
stretch), and fail closed. A hostile or wrong report can only ever ADD
caution, never open a road.

## 7. PEOPLE — the peacetime tab

Household rows (name, address, mobility tag, no-car tag, grab-list, situation)
with always-available Edit — never disabled, SAVED ✓ flash on save, and if you
edited the person currently on screen their verdict re-runs immediately.
Below, the coordination board: "DO THIS IN ORDER" — who to deal with first
and why, sorted by computed urgency.

## 8. RESPONDER — the same engine, inverted

The knock list: addresses ranked by when their **last passable route**
closes. "1 — Grandma Rose — CUT OFF — needs a crew, not an alert · meds/
equipment: 4." No new model — sorting by minutes-until-cutoff IS triage,
which is the B2G pitch made self-evident.

## 9. SETTINGS — the after-the-demo tab

Scenario launcher (pinned = reproducible), guaranteed-offline toggle, the
data-source table with fallback chains, and the privacy stance in product
language ("in a fire, your location is medical data").

---

## The "too basic" audit — found → fixed

| Moment | Was | Now |
|---|---|---|
| First-assessment wait | Static intro card + button spinner | Narrated pipeline stages checking off |
| Route knowledge | Next-turn only ("head southeast") | Full door-to-safe brief with per-step clock |
| Rejection | Text in a banner | ✕/✓ markers at the exact decisive points on the map |
| Destination choice | Unexplained | "Why not X?" derived from the judge |
| Profile editing | Overlay on the emergency surface; clicks stolen by an invisible map control | Its own tab; z-order fixed; never disabled; save re-runs |
| Meds/equipment | Absent | Per-person grab list in plan + responder counts |
| Report latency | Full ~20 s re-run | ~1 s re-judgement (cache + prose skip) |
| Structure | One long scroll + modal-ish views | Four tabs, one job each; onboarding first-run |
| Motion | None | Rise + staggered plan, reduced-motion safe |

## Known gaps (say them before a judge finds them)

- The 3D scene doesn't yet draw the pinch markers/ring labels the 2D map has.
- The plan is not yet the *live* turn-by-turn (no GPS position on the line) —
  deliberate for now; the privacy model in SETTINGS defines how it ships.
- Voice — an evacuation brief should read itself aloud; TTS is a small,
  high-value add.
- Household edits are in-memory by design (demo truth: refresh = reset).
