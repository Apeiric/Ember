# FILE OWNERSHIP — read this in the first 30 minutes, together

> "assign FILE OWNERSHIP (no collisions — this cost us last hackathon)."
> — CONTEXT.md §10

One rule: **you only edit files you own.** If you need a change in someone
else's file, say so out loud and let them make it. Two people editing
`judge.ts` at hour 6 is how a hackathon dies.

---

## Shared — CHANGES NEED A HEADS-UP IN CHAT

| File | Why it's shared |
|---|---|
| `shared/src/types.ts` | The contract between all three of you. Adding a field is fine — announce it. Renaming or removing one breaks two other people's code. |
| `shared/src/constants.ts` | Tuning knobs. JUDGE owns the thresholds; anyone may read. |
| `shared/src/contracts.ts` | Zod validation. Update when the request shape changes. |

`backend/src/types.ts` and `frontend/src/types.ts` both re-export `shared` —
there is exactly one definition of every shape in the system, so the two apps
cannot drift.

---

## Navelan — THE JUDGE (+ merge captain, + pitch)

| File | What |
|---|---|
| `backend/src/services/judge.ts` | **THE CORE.** Scoring, rejection, ranking. Pure and deterministic. |
| `backend/src/services/project.ts` | Hazard → time-evolving DangerField. The spread heuristic. |
| `backend/src/services/profiles.ts` | Personalization tuning. |
| `backend/src/core/geo.ts` | Geometry kernel. Pure, zero-dependency. |
| `backend/src/core/routes.ts` | Route construction from paths + durations. |
| `backend/src/pipeline/assess.ts` | Orchestration — the merge point of all three workstreams. |
| `backend/src/__tests__/*` | The tests that protect the pitch. |
| `backend/src/server.ts`, `backend/src/routes/*` | HTTP surface. |

**First job:** open `judge.ts`, read the header, run `npm test`. The engine
already works end to end on canned data — you are improving a working thing,
not building from zero.

---

## Person 2 — DATA LAYER + VERDICT

| File | What |
|---|---|
| `backend/src/services/hazards.ts` | NIFC perimeter + NASA FIRMS hotspots + NWS wind. |
| `backend/src/services/geocode.ts` | Google Geocoding. |
| `backend/src/services/routing.ts` | Google Directions, `alternatives=true`. |
| `backend/src/services/ground.ts` | Mireye terrain + roads out. |
| `backend/src/services/verdict.ts` | Claude → Groq → template. |
| `backend/src/env.ts`, `backend/.env.example` | Environment wiring. |
| `backend/src/core/cache.ts`, `backend/src/core/resilient.ts` | Fetch plumbing. |

**First job:** every one of these already returns correct canned data. Your job
is to add the LIVE tier above the canned one — never to remove the canned tier.
Each file has the request shape sketched out; fill in the adapter and check the
provenance badge flips from `DEMO DATA` to `LIVE` in the UI.

**Do not** put a `fetch` in `judge.ts`, `project.ts` or `geo.ts`. Those stay pure.

---

## Person 3 — MAP, UI, DEMO

| File | What |
|---|---|
| `frontend/src/components/MapView.tsx` | Mapbox GL layers. Cesium/3D later. |
| `frontend/src/components/MapFallback.tsx` | Token-free schematic map. **Do not delete this.** |
| `frontend/src/components/VerdictCard.tsx` | The emergency UI. 25% of the score. |
| `frontend/src/components/*` | Everything else in the rail. |
| `frontend/src/App.tsx`, `frontend/src/lib/*`, `frontend/src/hooks/*` | Shell, client, state. |
| `frontend/tailwind.config.js`, `frontend/src/index.css` | Design system. |
| `backend/src/fixtures/*` | The canned scenarios that drive the demo. |

**First job:** `npm run dev`, click "Palisades Fire", and watch the whole demo
run. Then make the verdict card look like an emergency instead of a dashboard.

⚠️ **Tailwind config changes need a Vite restart** — the CSS will not hot-reload
and you will think your change did nothing.

---

## Git protocol — CONTEXT.md §10

```bash
git checkout -b judge/route-scoring     # or data/..., ui/...
# ... work ...
git add -A && git commit -m "judge: reject routes the fire reaches first"
git push -u origin judge/route-scoring
```

- **Nobody pushes to `main`.** Navelan is merge captain.
- Rebase on `main` before opening a PR: `git fetch && git rebase origin/main`.
- If you hit a conflict in a file you do not own, **stop and ask the owner**.
- `npm test` must pass before you merge. The judge tests protect the demo —
  if they go red, the pitch has become a lie.

---

## Before you demo

- [ ] `npm test` green
- [ ] `npm run typecheck` clean
- [ ] Demo rehearsed **twice** (CONTEXT.md §11)
- [ ] `EMBER_FORCE_OFFLINE=true` tested — the whole demo runs with no network
- [ ] Deployed to Render with env vars set **in the dashboard**, not just locally
