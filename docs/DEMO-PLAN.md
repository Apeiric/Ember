# EMBER — 3-minute demo + 2-minute Q&A, for three people

*Everyone speaks. Everyone is seen. Read your own lines out loud twice before
you present.*

---

## 0. Why all three talk

Judges score teams, not slide decks. A team where one person narrates and two
stand silent reads as one person's project. So the demo is **split into three
owned segments**, each person hands off with a named cue, and each person owns
a Q&A domain. The handoffs are the chemistry — they prove you built this
together.

**Names:** fill these in now and never deviate.

| Role | Name | Owns on stage | Owns in Q&A |
|---|---|---|---|
| **A — The Problem** | ________ | Opening 45 s + closing line | Impact, users, go-to-market |
| **B — The Product** | ________ | Live demo, drives the laptop | UX decisions, the personalization story |
| **C — The Engine** | ________ | The 45 s "how it's built" beat | Architecture, AI safety, data |

Rule: **whoever is not speaking does not talk.** No stage whispers, no
corrections. If someone misses a line, the next person picks it up and moves.

---

## 1. THE 3-MINUTE SCRIPT (timed, three voices)

> Setup before you start: live URL open on the **Escape** tab, already loaded
> once so it's warm, browser zoom 110%, Palisades not yet clicked.

### [0:00 – 0:40] — **A** opens. Laptop untouched.

> "In January, a family in Pacific Palisades did exactly what you'd do. They
> opened their phone. It told them a fire existed, and gave them the fastest
> route to the freeway — Sunset Boulevard, eastbound. That road is where cars
> were abandoned and bulldozed out of the way.
>
> In Paradise in 2018, eighty-five people died. Many of them died *on the
> evacuation route.*
>
> These people were not uninformed. They were informed by tools built to
> answer the wrong question. An alert tells you a fire exists. Maps tells you
> the fastest road. **Nobody tells you the safe way out.**
>
> That's what we built. B, show them."

### [0:40 – 2:05] — **B** demos. A and C stay quiet.

**[click Palisades Fire]**
> "Ember asks the one question nobody else asks: not *where is the fire* — but
> **where will the fire be when I get there.**"

**[verdict lands]**
> "Leave soon. Southeast. Twenty-four minutes — and that clock is live, it's
> counting down my real escape window."

**[point at the dashed red route and the ✕]**
> "This red line is what your phone gives you. Nineteen minutes, the fastest
> way out. **We refused it.** The fire reaches that road about twenty minutes
> before I'd clear it — and that ✕ is the exact point I lose the race. This is
> the whole product in one picture: we show you the road we *wouldn't* send
> you down, and why."

**[scroll to The Whole Plan]**
> "And this isn't a next-turn breadcrumb. It's the entire escape — every road,
> when I clear it, where I arrive — and what I cannot leave without: her
> oxygen tank, his EpiPen."

**[People tab → tap Grandma Rose]**
> "Now watch. Same fire. Same address. Different human. Grandma Rose uses a
> walker and needs twenty-five minutes just to get out the door — so the same
> engine tells her **stay inside, every road out is already cut.**
>
> One alert for a whole zone is *why vulnerable people die in evacuations.*
> This is the fix, and it's the same arithmetic — just with her constraints."

**[back to Escape → Go live]**
> "And when it's a family, the hardest question isn't where the fire is. It's
> who gets the kids. Watch it decide, live: Uncle Dev is assigned — because
> diverting *me* would spend five minutes of my own escape window. That's
> recomputed every second from everyone's position.
>
> C — tell them why they can trust it."

### [2:05 – 2:45] — **C** on the engine. B leaves the verdict on screen.

> "Three decisions make this trustworthy.
>
> **One: an AI never makes the call.** The engine is pure deterministic code
> — no network, no model. Search it for the word 'fire' and you'll only find
> it in comments; it consumes danger polygons with arrival times. Same inputs,
> same output, every time, and it's unit tested.
>
> **Two: AI reads, geometry verifies.** Paste a neighbour's text — 'power line
> down across Sunset' — Claude parses it, but every road it extracts is
> checked against real route geometry. A road that doesn't exist matches
> nothing and never reaches the engine. A bad report can only ever *add*
> caution. It can never open a road.
>
> **Three: it cannot break.** Every data source has a fallback chain ending in
> canned data, and every value on screen says whether it's live or demo. Right
> now this is running on live Google roads, NASA satellite hotspots, Caltrans
> closures — and if every one of them died mid-demo, it would still answer,
> and it would tell you it was degraded."

### [2:45 – 3:00] — **A** closes.

> "Same engine, one more direction: point it at a neighbourhood and it ranks
> addresses by whose last road out closes first — a knock list for fire crews.
> That's how a county buys it for residents and gets triage for responders
> from the same data.
>
> Everyone tells you a fire exists. **Ember tells you the way out.**"

---

## 2. THE 2-MINUTE Q&A — who answers what

**The rule that wins the room:** the person who owns the domain answers, in
**two sentences**, then stops. Long answers eat your other questions. If a
question spans two owners, the first answerer names the second: *"—the
architecture side of that is C's."*

| Question | Owner | Two-sentence answer |
|---|---|---|
| "Is the AI making life-or-death decisions?" | **C** | "No — a deterministic engine makes every call, and it's fully testable. Claude only reads messy human reports and phrases the result, and everything it extracts is verified against real geometry first." |
| "Your fire spread model isn't real physics." | **C** | "Correct, and we say so on screen — it's two documented rules of thumb, deliberately over-drawn so our failure mode is a detour, not a death. The engine consumes an interface, so a real model like ELMFIRE drops in without touching decision logic." |
| "Why wouldn't Google just build this?" | **A** | "Their router optimizes ETA among currently-open roads, and their liability posture keeps them descriptive — they will not tell a user 'your fastest route will kill you.' That sentence is our entire product." |
| "What about traffic and gridlock?" | **C** | "That's our honest gap — we model the fire's clock and your clock, not crowd flow. Though personalized departure times already stagger people, which is the beginning of the fix." |
| "How do you make money?" | **A** | "Counties already pay for alerting — we're the routing line item next to it, and insurers and utilities buy it as liability reduction. The emergency function is free forever; charging someone to evacuate is indefensible." |
| "How would anyone have this installed in time?" | **A** | "Nobody installs an evacuation app while the sky is blue — which is why we sell to the county that pushes it out before fire season. Setup happens once in peacetime; the emergency interaction is one tap on your own name." |
| "Privacy — you're tracking families." | **C** | "Location is off in peacetime, opt-in per incident, visible only to your household, and auto-deleted when the incident closes. Life360 built this category and then sold location to brokers — we wrote the opposite into the product's settings page." |
| "What did you actually build vs. fake?" | **B** | "Everything you saw is running — live Google roads, satellite hotspots, Caltrans closures, and a real engine. The only simulated piece is the family's movement in the live view, because nobody's phone is feeding us GPS today, and it's labeled as simulated on screen." |
| "What's next / what's the moat?" | **A** | "Real device tracking and an on-device engine so verdicts survive dead cell towers. The moat is the dataset nobody else can collect: which roads stayed passable, at which minute, and how long real people took to clear them." |

**If you don't know:** *"We don't know yet — that's in our written weakness
list."* Judges reward that. Never invent a number.

---

## 3. FINAL CHECKS ON RENDER (do these in order, now)

1. Open **https://ember-lk17.onrender.com** and **click all the way through
   the script once.** A warm instance is the difference between an instant
   demo and a 50-second blank screen.
2. **Upgrade off free tier with your credits** — free instances spin down
   after inactivity. This is the single biggest demo risk left.
3. Confirm on the live site: root shows the app (not JSON), Palisades gives
   **LEAVE SOON** with the red rejected route, People tab loads four members,
   Responder tab shows the knock list.
4. **Have localhost running as a hot backup** on the same laptop, one tab
   over. If the live site stalls, B switches tabs and keeps talking.
5. **Have the 60-second screen recording** ready in a third tab. If both fail,
   play it and narrate over it. Never debug on stage.

---

## 4. THE HOUR BEFORE

- **T-45:** submit Devpost (paste from `DEVPOST.md`). Do not leave this to the
  buzzer.
- **T-35:** record the 60-second backup video of the golden path.
- **T-25:** full dry run, timed, all three voices, standing up.
- **T-15:** second dry run. Fix only the handoffs, not the words.
- **T-10:** **freeze.** No commits, no deploys, no "one more fix."
- **T-5:** load the live URL, click Palisades once so it's warm, leave it on
  Escape.

---

## 5. THE THREE THINGS THAT MUST LAND

If you only get three moments through, make them these:

1. **"We refused the fastest route"** — with the ✕ visible.
2. **"Same fire, same address, different human, opposite verdict"** — Grandma
   Rose.
3. **"A deterministic engine decides; AI only reads and explains"** — the
   sentence that makes judges trust everything else.

Everything else is supporting material.
