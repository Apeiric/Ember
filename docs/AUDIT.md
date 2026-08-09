# EMBER — the adversarial audit

*Prosecution first, then defense, then verdict. Written to be read before any
pitch, investor meeting, or sponsor conversation. Companion to PITCH.md.*

---

## A. Technical standpoint

### Prosecution
1. **The fire model is a toy.** Wind-fraction + slope-doubling is a 1940s rule
   of thumb. Real spread depends on fuel moisture, ember cast, canopy, humidity
   recovery. Our rings could be off by 2× in either direction.
2. **Traffic is the actual killer and we barely model it.** Paradise's deaths
   were a *queueing* failure. Our durations are "evacuation-realistic"
   constants, not a flow model. In a real mass evacuation, the green route is
   as gridlocked as the red one.
3. **Three candidate routes is not a search.** A real router explores the
   graph; we judge a shortlist from one provider. The best escape might be a
   road we never considered.
4. **Canned-vs-live seam.** The demo is reconstructed geometry; live mode
   depends on feeds (NIFC latency is minutes-to-hours). The gap between demo
   quality and 2 a.m. reality is real and must be said out loud.
5. **Single-node, no offline client.** The night the cell network dies — which
   is fire night — a server-rendered verdict is unreachable. The product most
   needs to exist exactly when its architecture is weakest.

### Defense
1. The judge consumes a `DangerField` interface, not our heuristic — ELMFIRE or
   a vendor model slots in without touching decision logic. We over-draw
   danger deliberately: our failure mode is a detour, not a death. And the
   *race framing* (their clock vs your clock) is correct regardless of which
   spread model feeds it.
2. True — and no competitor models it either. Our per-profile pace multipliers
   are honest placeholders; the roadmap item is a real evacuation-flow model,
   and our deployments would generate the training data for it.
3. The shortlist comes from the routing provider's alternates — the same set a
   civilian would actually be choosing between. Judging *those* honestly beats
   pretending to a full-graph search we can't verify.
4. Provenance is first-class in the product: every value says live/cached/
   canned on screen. We are the only demo in the room that tells the judges
   when it is lying.
5. Correct and roadmap: the judge is pure TypeScript with zero I/O — it can run
   *on the phone* against the last-synced danger field. Offline-first is an
   architecture we are one sprint from, not a rewrite away from.

---

## B. Moral / ethical standpoint

### Prosecution
1. **A wrong "LEAVE NOW" can kill.** Sending a walker-bound 81-year-old onto
   a road that gridlocks is worse than telling her to shelter. We accept
   life-or-death liability with a heuristic under the hood.
2. **A wrong "STAY INSIDE" can kill too** — and it's the verdict we give when
   every route fails. Shelter-in-place during a firestorm is sometimes right
   (Getty Center) and sometimes a death sentence (Greenville).
3. **Two-tier safety.** If this becomes a paid product, do the poor burn?
   Wealthy WUI households get computed escapes; renters get the same old
   siren.
4. **Automation over-trust.** People will follow the green line into smoke
   because a confident app said so — the Waze-into-the-lake problem with
   mortal stakes.
5. **Panic amplification.** "The fire beats you by 20 minutes" at scale could
   trigger the exact simultaneous rush that causes gridlock.

### Defense
1. The deterministic asymmetry is our ethics: false-dangerous costs minutes,
   false-safe costs lives, and every threshold is tuned to fail toward
   caution. The margin, the model name, and the disclaimer are ON the verdict
   card — we show uncertainty instead of laundering it.
2. STAY INSIDE always ships with "call 911" and never claims safety — it
   claims *the roads are worse*. That is a statement about roads, which we can
   defend, not about survival, which nobody can promise.
3. Emergency function is free forever; revenue is peacetime features and
   B2G/B2B (the county buys it for everyone, including renters). This is a
   policy we write down now, while it's cheap, so it binds us later.
4. We are the anti-Waze by construction: the UI leads with *why* (the ✕ where
   the fire wins, the rejected route shown, provenance badges) precisely so
   trust is earned per-verdict, not borrowed from a brand.
5. Staggered departure is literally our output — personalized clocks spread
   the load (prep 5 vs prep 25 = a built-in 20-minute stagger). A future
   county deployment can shape departure waves deliberately.

---

## C. Security / privacy standpoint

### Prosecution
1. **Household dossiers are stalker gold**: names, addresses, mobility,
   medications, "kids at school without a car." A breach is catastrophic and
   the victims are pre-selected for vulnerability.
2. **Field reports are an injection surface** — a malicious neighbour texts
   "PCH is blocked" and steers a family into the fire.
3. **Location during emergencies** is the most sensitive telemetry that
   exists; Life360 already showed the industry will sell it.
4. **A spoofed Ember** (or a compromised one) is a weapon. Authority over
   evacuation routes must be unforgeable.

### Defense
1. Today: profiles are in-memory only, by design — nothing persists, nothing
   to breach. Product policy for later: E2E-encrypted household vault, local-
   first storage, no server-side dossier at all (the judge needs numbers, not
   names).
2. Already engineered, not just policied: LLM extraction is **geometrically
   verified** (a road that matches no real route is displayed but never fed to
   the judge), direction-scoped, and fails closed. A hostile report can close
   a road (cost: a detour) but cannot *open* one — reports only ever ADD
   danger. The asymmetry is the security model.
3. Peacetime off, per-incident opt-in, household-only visibility, auto-expiry,
   aggregates-only for sale — written in SETTINGS inside the product, not
   buried in a policy page.
4. Roadmap: signed verdicts + official-source cross-display (we already show
   Cal OES zones beside our own reasoning). We present as decision *aid*;
   authority stays with emergency services, and the disclaimer says so on
   every screen.

---

## D. The idea itself — is the innovation real?

**The claim to novelty that survives scrutiny:** everyone else answers
"where is the danger?" or "what is the fastest route?" Nobody ships the
*join*: danger-arrival-time vs person-arrival-time, per road segment, per
human. That join is (a) genuinely new as a consumer product, (b) small enough
for a team of three to own end-to-end, (c) big enough to matter — it is THE
question of every evacuation.

**Where the idea is genuinely weak, no spin:**
- It's a low-frequency product (you need it twice a decade) → must live inside
  something used weekly (family-safety, insurance app) or be bought FOR you
  (county). Standalone consumer app is the weakest go-to-market.
- The data moat starts at zero and only fills during disasters we route.
- Incumbents (Google SOS, Genasys) could copy the framing; our defense is
  liability-shaped product courage (they will not tell users "your fastest
  route will kill you") plus per-person modelling they have no data for.

**Verdict:** the core is real and defensible; the wrapper (distribution,
persistence, flow modelling) is where the startup work lives. Say exactly
that when asked — it reads as self-awareness, which funds better than bravado.

---

## E. Judge-proofing quickfire

- "Is the AI deciding?" — No. Pure deterministic judge; Claude reads messy
  text and phrases prose; geometry verifies everything it extracts.
- "What if your projection is wrong?" — It's over-drawn on purpose; margins
  are displayed; the interface swaps for a real fire model without touching
  the decision core.
- "Why not just Waze?" — Waze optimises the next 20 minutes of traffic; we
  race the next 90 minutes of fire. Different objective function, and theirs
  is legally frozen.
- "Where's the business?" — Counties and insurers buy readiness; families buy
  peace-of-mind subscriptions in peacetime; emergencies are free forever.
- "What's the moat?" — The race framework + the per-person evacuation dataset
  no one else is positioned to collect.
