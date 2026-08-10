# EMBER — THE FINAL PITCH

*Every number in this document is sourced. Say only these. If you can't cite
it, don't say it — a judge who checks one fabricated stat discards everything
else you said.*

---

## THE IDEA

> **Every navigation app assumes the map is standing still.**
> **In a wildfire the map is moving — and that assumption kills people.**

A fire is not an obstacle sitting on a map. It is a **front**, running downwind
and uphill. The Palisades Fire went from **20 acres to 200 acres in one hour**
[[1]](#s1). The road that is fastest at 10:30 is gone by 11:30.

So when your phone says *"fastest route, 19 minutes"*, it is answering a
question about a world that will not exist when you arrive.

**Ember is a routing engine that treats the map as moving.** It projects where
the fire will be minute by minute, then on every road runs a race — *the fire's
arrival against yours* — and refuses the roads you would lose.

And **you** is literal. Someone who needs twenty-five minutes to get out the
door is running a different race on the same road.

---

## THE EVIDENCE ARSENAL

### 🔴 The four you say ON STAGE

**1. Fires move faster than maps update.**
> Palisades Fire, 7 Jan 2025: **20 acres at 10:30 a.m. → 200 acres within the
> hour → 2,921 acres by 6:30 p.m.** [[1]](#s1)

**2. The alert arrives after the fire.**
> The first evacuation order for the neighbourhoods closest to the fire came
> **about 40 minutes after some homes were already burning.** (AP
> investigation) [[2]](#s2)

**3. People die on the roads they were told to take.** ← *your strongest stat*
> NIST's case study of the Camp Fire identified **23 entrapment and burnover
> events. Seventeen directly impacted evacuating civilians — twelve of those
> happened on major evacuation roadways.** [[3]](#s3)
> 85 people died; **most were older residents whose circumstances prevented
> them from evacuating.** [[4]](#s4)

**4. Navigation apps have already done this.** ← *your strongest story*
> In the 2017 Skirball Fire, **Waze routed drivers toward the fire** — because
> the streets were empty, and empty reads as fast. The streets were empty
> *because people had fled them.* **The LAPD publicly warned drivers to stop
> using navigation apps to leave the fire zone.** [[5]](#s5)[[6]](#s6)

### ⚪ Keep in reserve for Q&A

- **Gridlock:** Sunset Boulevard jammed; people abandoned cars and fled on
  foot; **a fire bulldozer pushed hundreds of abandoned cars aside** to get
  engines through. One resident reported **two hours** to drive from Pacific
  Palisades to Santa Monica. [[1]](#s1)[[7]](#s7)
- **The alert system itself failed:** on 9 Jan an evacuation alert was
  **erroneously sent to nearly 10 million residents** — LA County called it a
  *"dangerously unacceptable breakdown in the system."* [[8]](#s8)[[9]](#s9)
- **In western Altadena, where 17 deaths were reported, residents said alerts
  came late or not at all.** [[10]](#s10)
- **Capacity:** LA County's Office of Emergency Management had **37 staff for
  ~10 million people** — roughly 1 per 256,000. [[10]](#s10)

> ⚠️ **Do not quote Reddit or Twitter.** We could not verify individual social
> posts, and an unverifiable quote is worse than no quote. Everything above is
> from AP, CNN, NIST, ABC7, CBS and LA County's own statements — say those
> instead, and name the source out loud. "NIST found…" lands harder than
> "someone tweeted…" anyway.

---

## THE SCRIPT — 3 minutes, three voices

| # | Beat | Who | Time |
|---|---|---|---|
| 1 | The broken assumption | **A** | 0:45 |
| 2 | Meet the household | **B** | 0:15 |
| 3 | The demo | **B** | 1:10 |
| 4 | How it's built | **C** | 0:35 |
| 5 | What it changes | **A** | 0:15 |

**Names:** A ________ · B ________ · C ________
**Rule:** whoever is not speaking does not talk.

---

### ① THE BROKEN ASSUMPTION — **A**, 45 s, no laptop

> "Every navigation app in the world makes one assumption: **that the map is
> standing still** — that the road you're driving toward will still be there
> when you arrive.
>
> In a wildfire, that assumption kills people.
>
> January seventh, Pacific Palisades. That fire went from **twenty acres to two
> hundred acres in one hour.** The first evacuation order for the closest
> neighbourhoods arrived **about forty minutes after homes were already
> burning.**
>
> So thousands of people evacuated at once, and they all did the same thing:
> they pulled out their phones. Their phone said *fastest way out — Sunset
> Boulevard, east.* That is where the cars ended up abandoned, and a fire
> **bulldozer had to push them aside** so engines could get through.
>
> And this isn't new. In 2017, **Waze routed drivers straight toward the
> Skirball Fire** — because those streets were empty, and empty looks fast to a
> routing engine. They were empty **because people had already fled them.** The
> LAPD had to publicly tell people to stop using navigation apps to escape.
>
> Here's what it costs. NIST studied the Camp Fire — the one that killed
> eighty-five people in Paradise. They found seventeen burnover events that
> caught evacuating civilians. **Twelve of them happened on major evacuation
> roadways.** People died on the roads they were told to take.
>
> Those people weren't uninformed. They had an alert and they had directions.
> Both were answering questions about a world that had already changed.
>
> So we built the one that doesn't. **B.**"

### ② MEET THE HOUSEHOLD — **B**, 15 s, People tab

> "One household. Four people — they're the whole point.
>
> **Me**, healthy, car in the driveway.
> **Rose**, my grandmother — eighty-one, walker, oxygen tank. **Twenty-five
> minutes just to get out the door.**
> **Maya and Sam**, at school, no car, can't leave alone.
> **Dev**, my uncle, across town, has a car.
>
> Set up once, months before anything happens. That's the only work this app
> ever asks of you. Now the fire starts."

### ③ THE DEMO — **B**, 70 s

**[Escape → "Palisades Fire"]**
> "Perimeter, satellite hotspots, wind, official road closures — pulled live.
> Then the part that makes this different: **it doesn't stop at where the fire
> is.** Those rings are a forecast — fire here in twenty minutes, thirty,
> forty-five.
>
> Every road gets sampled every hundred and fifty metres, and at each point we
> compute two numbers: **when the fire arrives, and when I arrive.** The
> smallest gap on the route is my margin."

**[verdict lands]**
> "Leave soon, southeast — and that clock is my margin, counting down live."

**[the dashed red line + the ✕]**
> "Here's the one that matters. **This red line is what my phone gives me** —
> nineteen minutes, fastest way out. **Ember refuses it.** The fire crosses
> that road about twenty minutes before I'd reach it, and the ✕ is the exact
> point I lose the race.
>
> We don't quietly hide the bad route. We show it, and we show the number that
> killed it. **That's the product.**"

**[The Whole Plan]**
> "Not turn-by-turn — the whole escape before I commit. Every road, when I
> clear it, where I end up. Plus what you forget while panicking: the oxygen
> tank, the EpiPen."

**[People → Rose]**
> "Now. Same fire. Same street. **Different person.**
>
> Rose needs twenty-five minutes before she's even moving. Same engine, same
> roads, **her** numbers — and the answer inverts: **stay inside, every road
> out is already cut.**
>
> Remember that NIST finding — **most of the people who died in Paradise were
> older residents whose circumstances stopped them evacuating.** An official
> alert sends one message to an entire zone, so the people who need the most
> warning get exactly the same warning as everyone else. **This is the fix.**"

**[Escape → "Go live"]**
> "And with a family, the hardest question isn't where the fire is — it's **who
> gets the kids.**
>
> It picks **Dev**, not me. I'm closer. But pulling me off my route spends five
> minutes of my own margin, and Dev covers it without costing anyone theirs.
> Re-checked every second as people move.
>
> **C** — how it's built."

### ④ HOW IT'S BUILT — **C**, 35 s

> "Three engineering decisions, because this decides whether people live.
>
> **One — the decision is a machine, not a model.** Everything the fire does
> collapses into one structure: polygons with a severity and an arrival time.
> The engine consumes that and returns a verdict — no network, no model,
> deterministic, unit-tested. It has never seen the word 'fire', which is why
> flood or chemical plume is a new *input*, not a new product.
>
> **Two — AI reads, geometry decides.** Paste a neighbour's text — *'power line
> down across Sunset'* — Claude turns it into structured facts, then every road
> it names is matched against real route geometry before it counts. Invent a
> street and it matches nothing and is thrown away. A wrong report can only
> ever make us **more** cautious — it can never open a road. **That asymmetry
> is the safety model.**
>
> **Three — it degrades loudly.** Every source has a fallback chain whose last
> link cannot fail; it runs with zero API keys. Every value on screen says
> whether it's live or canned. If a feed dies mid-demo you'll see it say so —
> we never quietly guess."

### ⑤ WHAT IT CHANGES — **A**, 15 s

> "Same engine pointed the other way: give it a neighbourhood and it ranks
> houses by **whose last road out closes first** — a knock list for crews,
> ordered by who runs out of time first. A county buys once and gets both.
>
> Maps route you through the world as it is. **Ember routes you through the
> world as it will be.**"

---

## IF THE ROOM LOOKS LOST

> "Simplest version: your phone gives you the fastest road. We give you the
> road that's still open when you get there — and a different answer for your
> grandmother than for you."

---

## Q&A — owner answers in two sentences, then stops

| Question | Owner | Answer |
|---|---|---|
| "Is AI making life-or-death calls?" | **C** | "No — a deterministic, unit-tested engine makes every call. Claude only reads messy human reports, and geometry verifies everything it extracts before the engine sees it." |
| "Your spread model isn't real physics." | **C** | "Correct, and we say so on screen — two documented rules of thumb, deliberately over-drawn so our failure mode is a detour, not a death. The engine takes danger zones through an interface, so a real model like ELMFIRE drops in without touching decision logic." |
| "Why wouldn't Google build this?" | **A** | "They already tried the adjacent thing and it went wrong — Waze routed people toward the Skirball Fire because empty streets look fast. Their objective is arrival time and their liability position keeps them descriptive; they will never say 'your fastest route will kill you.'" |
| "Traffic and gridlock?" | **C** | "Our honest gap — we model the fire's clock and your clock, not crowd flow. Personalised departure times already stagger people, which is where the fix starts." |
| "Aren't official alerts enough?" | **A** | "They're zone-level and they failed measurably — LA County erroneously alerted nearly 10 million people in one day and called it a 'dangerously unacceptable breakdown.' In western Altadena, where 17 died, residents said alerts came late or never." |
| "How do you make money?" | **A** | "Counties already carry alerting budgets; we're the routing line item beside it, and the responder knock list means one purchase serves residents and crews. Emergency use is free forever — charging someone to evacuate is indefensible." |
| "Who has this installed in time?" | **A** | "Nobody installs an evacuation app while the sky is blue, which is why we sell to the county that pushes it out before fire season. Setup is once in peacetime; the emergency interaction is one tap on your own name." |
| "Privacy?" | **C** | "Location off in peacetime, opt-in per incident, household-only, auto-deleted when the incident ends. Life360 built this category then sold location to brokers — we wrote the opposite into the settings page." |
| "What's real vs faked?" | **B** | "Everything you saw runs — real road geometry, satellite hotspots, Caltrans closures, a real engine. The only simulated part is the family *moving* in the live view, because no one's phone is feeding us GPS today, and the screen says so." |
| "What's the moat?" | **A** | "The data nobody else can collect: which roads stayed passable, at what minute, and how long real people took to clear them by mobility class. Aggregate only — we never sell precise location." |

**If you don't know:** *"We don't know yet — it's in our written weakness
list."* Judges reward that. Never invent a number.

---

## <a name="sources"></a>SOURCES — have this open in a tab

1. <a name="s1"></a>ABC7 Los Angeles — abandoned cars on Sunset Blvd pushed aside by fire dozer; fire growth timeline: https://abc7.com/live-updates/socal-braces-possibly-destructive-windstorm-amid-dangerous-fire-weather/15771235/entry/15773016/
2. <a name="s2"></a>AP via ABC10 — "Homes were burning, roads already jammed when the Pacific Palisades evacuation order came": https://www.abc10.com/article/news/local/california/homes-were-burning-roads-already-jammed-when-the-pacific-palisades-evacuation-order-came-ap-finds/103-c758f3bc-13c4-4be7-82ea-1321e724378d
3. <a name="s3"></a>NIST — *A Case Study of the Camp Fire: Notification, Evacuation, Traffic, and Temporary Refuge Areas (NETTRA)*: https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra
4. <a name="s4"></a>Camp Fire overview — 85 deaths, older residents: https://en.wikipedia.org/wiki/Camp_Fire_(2018)
5. <a name="s5"></a>AI Incident Database #22 — "Waze Navigates Motorists into Wildfires": https://incidentdatabase.ai/cite/22/
6. <a name="s6"></a>"Waze sent commuters toward California wildfires, drivers say": https://www.kare11.com/article/news/nation-world/waze-sent-commuters-toward-california-wildfires-drivers-say/507-497699772
7. <a name="s7"></a>CBS Los Angeles — drivers abandon cars as Palisades Fire grows: https://www.cbsnews.com/losangeles/news/residents-evacuate-and-flee-as-palisades-fire-grows/
8. <a name="s8"></a>County of Los Angeles — "moves to immediately address emergency alert problems": https://lacounty.gov/2025/01/10/los-angeles-county-moves-to-immediately-address-emergency-alert-problems-and-implement-solutions/
9. <a name="s9"></a>CNN — "A 'dangerously unacceptable breakdown' led to errant or delayed evacuation warnings in the LA County fires": https://www.cnn.com/2025/01/16/us/evacuation-warnings-vulnerabilities-la-fires/index.html
10. <a name="s10"></a>"In western Altadena, where 17 wildfire deaths were reported, residents say evacuation alerts came late or not at all": https://www.yahoo.com/news/la-fires-delayed-wildfire-evacuation-183334965.html

---

## THE THREE THINGS THAT MUST LAND

1. **"Every map assumes the world is standing still. A fire moves."**
2. **"Twelve of seventeen civilian burnovers in Paradise happened on major evacuation roadways."**
3. **"Same fire, same street, different person, opposite answer."**
