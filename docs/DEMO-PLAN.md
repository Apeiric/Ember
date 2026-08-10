# EMBER — 3-minute demo + 2-minute Q&A

*One story, told by three people. Problem → what we built → why it works →
what it changes. Nobody sees a feature before they understand why it exists.*

---

## The shape of the story (memorise this, not the words)

| # | Beat | Who | Time | The one thing they must take away |
|---|---|---|---|---|
| 1 | **The problem** | A | 0:35 | People die *while evacuating*, following their phone |
| 2 | **What Ember is** | A | 0:10 | One sentence they can repeat to someone else |
| 3 | **Meet the household** | B | 0:15 | Four people they'll care about for the next 90 seconds |
| 4 | **The demo** | B | 1:10 | Each beat = one product truth + one architecture truth |
| 5 | **Why you can trust it** | C | 0:30 | A machine decides, not an AI |
| 6 | **What it changes** | A | 0:20 | Same engine sells to counties and saves crews time |

**Rule:** whoever is not speaking does not talk. No stage whispers, no
corrections. If someone drops a line, the next person picks it up and moves on.

**Names — fill in now:**
A (Problem & Impact) ________ · B (Product & Demo) ________ · C (Engine) ________

---

## THE SCRIPT

> **Setup:** live URL open on **Escape**, already clicked once so it's warm,
> zoom 110%, Palisades **not** yet clicked. Laptop closed or screen not shown
> until B starts.

### ① THE PROBLEM — A, 35 seconds. No laptop. Just talk.

> "January this year. A fire starts above Pacific Palisades in Los Angeles.
> Thousands of people need to leave at the same time, and every one of them
> does the same thing: they pull out their phone.
>
> Their phone tells them two things. An alert says *there is a fire near you.*
> Maps says *here is the fastest road out* — Sunset Boulevard, east, toward the
> freeway.
>
> So that's where everyone went. And that road is where cars ended up abandoned,
> and a bulldozer had to push them aside to clear it.
>
> This keeps happening. Paradise, California, 2018 — eighty-five people died,
> and many of them died **on the evacuation route itself.**
>
> Here's the thing: those people were not uninformed. They had an alert, and
> they had directions. The tools just answer the wrong question. An alert tells
> you a fire **exists**. Maps tells you the **fastest** road. Nobody tells you
> the road that will still be there when you reach it."

### ② WHAT EMBER IS — A, 10 seconds. Say it slowly.

> "So we built the missing one. Ember is an evacuation app that asks a
> different question: **not where is the fire — where will the fire BE when I
> get there?** And it answers that differently for every person in your family.
>
> B will show you what that looks like."

### ③ MEET THE HOUSEHOLD — B, 15 seconds. Open on **People** tab.

> "Before I show you the fire — this is one household, and these four people
> are the whole point.
>
> **Me.** Healthy, car in the driveway.
> **Rose** — my grandmother. Eighty-one, walker, oxygen tank. It takes her
> twenty-five minutes just to get out the door.
> **Maya and Sam** — my kids, at school, no car. They can't leave alone.
> **Dev** — my uncle, across town, has a car.
>
> You set this up once, months before any fire — that's the only work this app
> ever asks of you. Now the fire starts."

### ④ THE DEMO — B, 70 seconds. One idea per beat.

**[Escape tab → click "Palisades Fire"]**

> "Ember pulls the fire perimeter, satellite hotspots, the wind, road closures —
> and then it does the thing that makes it different. It doesn't just draw where
> the fire is. **It projects where the fire is going**, minute by minute — those
> orange rings each say 'fire here in twenty minutes, thirty, forty-five.'
>
> Then, for every possible escape route, it races two clocks: **when the fire
> reaches each point, and when I reach that point.**"

**[verdict lands]**

> "Leave soon. Head southeast. And that number is counting down live — it's my
> actual escape window closing."

**[point at the dashed red line and the ✕]**

> "Now the important part. **This red line is the route my phone would give
> me** — nineteen minutes, the fastest way out. **Ember refused it.**
>
> Because the fire crosses that road about twenty minutes before I'd get there.
> That ✕ is the exact spot where I lose the race. We don't just hide the bad
> route — we show it to you, and we show you why. That's the whole product in
> one picture."

**[scroll to The Whole Plan]**

> "And this isn't turn-by-turn. It's the whole escape before I commit to it —
> every road, when I clear it, where I end up. Plus the thing you forget when
> you're panicking: **don't leave without the oxygen tank, the EpiPen.**"

**[People tab → tap Rose]**

> "Now the moment that matters. Same fire. Same street. Different person.
>
> Rose needs twenty-five minutes to get out the door, and she moves slower once
> she does. Same engine, same roads, **her** numbers — and it tells her
> something completely different: **stay inside, every road out is already
> cut.**
>
> An official alert sends one message to a whole zone. That's why the people who
> need the most warning get the same warning as everyone else. **This is the
> fix.**"

**[back to Escape → "Go live"]**

> "And with a family, the hardest question isn't where the fire is. It's *who
> gets the kids.*
>
> Watch — it assigns **Dev**, not me. Not because he's closer; I'm closer. But
> pulling me off my route would spend five minutes of my own escape window,
> and Dev can cover it without costing anyone theirs. It re-checks that every
> second as everyone moves.
>
> C — tell them why they can trust any of this."

### ⑤ WHY YOU CAN TRUST IT — C, 30 seconds. Verdict stays on screen.

> "Two things, because this decides whether people live.
>
> **First: no AI makes the call.** The decision engine is plain deterministic
> code — no model, no network. Same inputs, same answer, every time, and it's
> unit-tested. We use Claude for exactly one job: reading messy human language.
> Paste a neighbour's text — *'power line down across Sunset'* — Claude turns
> it into structured facts, and then **geometry checks every one of them against
> real roads.** If a road doesn't exist, it never reaches the engine. A wrong
> report can only ever make us *more* cautious. It can never open a road.
>
> **Second: it cannot go dark.** Every data source — Google roads, NASA
> satellite hotspots, Caltrans closures — has a fallback chain, and the last
> one always works. This runs with zero API keys if it has to, and every number
> on screen tells you whether it's live or demo data. It degrades **loudly**,
> never silently."

### ⑥ WHAT IT CHANGES — A, 20 seconds.

> "One more thing, same engine pointed the other way. Give it a neighbourhood
> and it ranks houses by **whose last road out closes first** — a knock list
> for fire crews, ordered by who runs out of time first.
>
> So a county buys one thing and gets both: routing for residents, triage for
> responders.
>
> Everyone tells you a fire exists. **Ember tells you the way out.**"

---

## IF JUDGES LOOK LOST

Have one recovery line ready. Whoever notices, says it:

> "The one-sentence version: your phone gives you the fastest road; we give you
> the road that's still open when you get there — and a different answer for
> your grandmother than for you."

Then continue where you were.

---

## THE 2-MINUTE Q&A

**Rule: the owner answers in two sentences, then stops.** Long answers eat your
other questions. If a question crosses domains: *"—the technical half of that
is C's."*

| Question | Owner | Answer |
|---|---|---|
| "Is AI making life-or-death decisions?" | **C** | "No — a deterministic, unit-tested engine makes every call. Claude only reads messy human reports, and geometry verifies everything it extracts before the engine ever sees it." |
| "Your fire model isn't real physics." | **C** | "Correct, and we say so on screen — two documented rules of thumb, deliberately over-drawn so our failure mode is a detour, not a death. The engine takes danger zones through an interface, so a real model like ELMFIRE drops in without touching the decision logic." |
| "Why wouldn't Google build this?" | **A** | "Their router optimises arrival time among roads that are open right now, and their liability position keeps them descriptive. They will never tell a user 'your fastest route will kill you' — and that sentence is our entire product." |
| "What about traffic and gridlock?" | **C** | "That's our honest gap — we model the fire's clock and your clock, not crowd flow. Personalised departure times already stagger people, which is where the fix starts." |
| "How do you make money?" | **A** | "Counties already pay for alerting; we're the routing line item next to it, and insurers and utilities buy it as liability reduction. The emergency function is free forever — charging someone to evacuate is indefensible." |
| "Who would have this installed in time?" | **A** | "Nobody installs an evacuation app while the sky is blue, which is why we sell to the county that pushes it out before fire season. Setup happens once in peacetime; in the emergency it's one tap on your own name." |
| "Privacy — you're tracking families." | **C** | "Location is off in peacetime, opt-in per incident, household-only, and auto-deleted when the incident ends. Life360 built this category and then sold location data to brokers — we wrote the opposite into the product's settings page." |
| "What's real vs. faked?" | **B** | "Everything you saw runs — real road geometry, satellite hotspots, Caltrans closures, and a real engine. The only simulated part is the family *moving* in the live view, because no one's phone is feeding us GPS today, and the screen says so." |
| "What's next / what's the moat?" | **A** | "Real device tracking, and an on-device engine so a verdict survives dead cell towers. The moat is the data nobody else can collect: which roads stayed passable, at what minute, and how long real people took to clear them." |

**If you don't know:** *"We don't know yet — it's in our written weakness
list."* Judges reward that. Never invent a number.

---

## BEFORE YOU GO ON

1. **Warm the live site** — click Palisades once, leave it on Escape.
2. **Demo with the "Palisades Fire" chip, never a typed address.** The chip is
   road-accurate and can't be broken by wifi or an API key.
3. **Backups in order:** live site → localhost in tab two → 60-second recording
   in tab three. If something stalls, B switches tabs and keeps talking. **Never
   debug on stage.**
4. **Freeze.** No commits, no deploys.

## THE THREE THINGS THAT MUST LAND

1. **"We refused the fastest route"** — with the ✕ visible.
2. **"Same fire, same street, different person, opposite answer"** — Rose.
3. **"A deterministic engine decides. AI only reads and explains."**

Everything else is supporting material.
