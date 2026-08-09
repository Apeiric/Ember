# Ember — the safe way out of a wildfire

Everyone tells you a fire exists. Ember tells you the safe way **out** — routed
by where the fire is *going*, not where it is, and personalized to how fast you
can actually move.

Read [CONTEXT.md](CONTEXT.md) first (problem, pipeline, scope rules), then
[OWNERSHIP.md](OWNERSHIP.md) (who edits which file).

---

## Run it

```bash
npm install
```

```bash
npm run dev
```

That starts both services and opens the whole product:

| | |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:8787 |

**No API keys required.** Click **Palisades Fire** and the full pipeline runs on
a reconstructed real scenario — fire perimeter, spread projection, three
candidate routes, a rejected fastest route, and a personalized verdict. Add keys
later to swap canned tiers for live ones, one at a time.

### Individually

```bash
npm run dev:api
```

```bash
npm run dev:web
```

### Checks

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Keys (all optional)

```bash
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
```

Every key is optional. A missing key disables that provider and the request
falls through to the next strategy, ending in canned data. **The app boots,
serves and demos correctly with both files completely empty** — that is the
design, not a compromise (CONTEXT.md §7).

| Key | Unlocks | Without it |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Real geocoding + real route alternatives | Canned addresses and routes |
| `NASA_FIRMS_API_KEY` | Satellite hotspots | Perimeter only |
| `MIREYE_API_KEY` | Terrain, slope, roads out | Canned terrain; slope term disabled |
| `ANTHROPIC_API_KEY` | Claude writes the verdict prose | Groq, then a deterministic template |
| `GROQ_API_KEY` | Fast fallback writer | Deterministic template |
| `VITE_MAPBOX_TOKEN` | Satellite basemap | Token-free SVG schematic map |

NIFC perimeters and NWS wind need no key.

> **Going on stage with bad wifi?** Set `EMBER_FORCE_OFFLINE=true`. Every stage
> uses canned data and the demo becomes byte-for-byte reproducible.

---

## How it works

```
address ──▶ 1 LOCATE ──▶ 2 THREAT ──▶ 3 GROUND ──▶ 4 PROJECT
                                                       │
                              (hazard-specific ENDS HERE — DangerField)
                                                       ▼
            8 VERDICT ◀── 7 PERSONALIZE ◀── 6 JUDGE ◀── 5 ROUTE
```

**The core idea.** For every point on every candidate route the judge computes
two numbers:

- **when *you* reach it** — prep time + travel × your pace
- **when the *fire* reaches it** — from the time-evolving danger field

The smallest gap along a route is `minutesUntilCutoff`. If it goes negative, the
fire wins the race and the route is rejected no matter how fast it is. That is
what "route by where the fire is going" actually means, and it is why the
fastest route on the demo scenario is one we refuse to give you.

**Hazard-agnostic by construction.** `judge.ts` contains the word "fire" only in
comments. It consumes a `DangerField` — polygons with a severity and an arrival
time. Flood and earthquake produce the same structure from different physics.
Swapping hazards means swapping the projector, not the engine.
*(True. Say it in the pitch. Don't build it today — CONTEXT.md §9.)*

**Honest about the model.** The spread projection is a documented heuristic
(fire runs with the wind; roughly doubles per 10° of upslope; widens as it runs)
— not a validated fire-behaviour model. It deliberately **over-draws** the
danger zone: a false "dangerous" costs a detour, a false "safe" costs a life.
The disclaimer ships in the API response and renders in the UI.

---

## Layout

```
shared/src/          types.ts · constants.ts · contracts.ts   ← one source of truth
backend/src/
  core/              geo · routes · resilient · trace · cache  (pure, testable)
  services/          geocode · hazards · ground · routing
                     project · judge · profiles · verdict
  fixtures/          palisades-2025 · camp-2018                ← the demo never breaks
  pipeline/          assess.ts                                 ← the 8 stages
  routes/            assess · health · scenarios
frontend/src/
  components/        MapView · MapFallback · VerdictCard · …
  hooks/ lib/        useAssessment · api · format
```

Both apps resolve `@ember/shared` through a tsconfig path alias (plus a Vite
alias on the frontend). No build step, no package to publish — edit a shared
type and both sides see it immediately.

---

## API

```bash
curl -s localhost:8787/api/health
```

```bash
curl -s -X POST localhost:8787/api/assess -H 'Content-Type: application/json' \
  -d '{"address":"1500 Palisades Drive, Pacific Palisades, CA 90272","profile":{"mobility":"vulnerable","hasCar":true}}'
```

`POST /api/assess` returns the origin, hazard, danger field, **every** scored
route (including rejected ones, with reasons), the recommendation, the naive
"what your phone would do" route, the verdict, and a stage-by-stage trace with
timings and data provenance.

---

## Deploy

`render.yaml` defines both services. Push to GitHub → Render → New → Blueprint.
Set secrets in each service's **Environment tab** — not just locally
(CONTEXT.md §8). It deploys and demos correctly with zero secrets set.

---

Ember is a decision aid, not an official evacuation order. Always follow
instructions from emergency services.
