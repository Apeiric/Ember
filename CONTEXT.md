# EMBER — Master Context Document
### The safe way out of a wildfire.

## 0. ONE-LINE PITCH
Everyone tells you a fire exists. Ember is the only one that tells you the safe
way OUT — personalized to you, routed by where the fire is GOING, not where it is.

## 1. THE PROBLEM (life-or-death, present tense)
People don't die in wildfires because they didn't know there was a fire. They die
because they don't know which way to run — and Google Maps routes by traffic, so it
will route them INTO the fire. Following GPS into flames is a documented cause of
death. Existing apps (Watch Duty: 17M users; Genasys/Zonehaven) only do AWARENESS
(a fire exists) or ONE official evacuation zone. Nobody gives an individual the
actual safe route out, right now.

## 2. THE SOLUTION
Enter your address during a live wildfire → get a personalized escape verdict:
- LEAVE NOW / you have time
- WHICH DIRECTION to go
- WHY (cited)
Routed AWAY from the fire and its projected path, not by speed.

## 3. THE INNOVATION (two things nobody does)
1. Route by where the fire is GOING, not where it is. A road safe now is an inferno
   in 20 min as fire moves with wind. We score routes by CUMULATIVE danger over the
   whole escape. (NIST research: snapshot-routing gets people killed inside buildings;
   we're first to do time-evolving hazard routing for neighborhoods.)
2. Personalized to the person. Official alerts treat a whole zone the same. An
   elderly/disabled person, someone with no car or with kids, needs to leave EARLIER
   and move DIFFERENTLY. Same fire, different verdict per person.

## 4. THE DEMO (the "betrayal" moment — this is what wins)
1. "This is a real wildfire burning right now near [CA town]." → fire glows on map.
2. Type a real address in its path → camera flies into the real 3D neighborhood,
   house lights up.
3. "Here's what your phone would do." → Google's fastest route draws in RED, straight
   toward the fire. "Google Maps optimizes for traffic. It just routed you into the fire."
4. "Here's what we do." → safe route draws GREEN, away from danger. Verdict slams up:
   "EVACUATE NOW → head WEST → ~40 min before this road is cut off."
5. Kicker: "And it's personalized. Healthy adult: 40 min. 80-year-old who moves
   slower —" → verdict changes → "leave NOW, take this flatter route."

## 5. THE PIPELINE (core logic)
1. LOCATE   → address → lat/long (Google Geocoding)
2. THREAT   → fire perimeter (NIFC) + hotspots (NASA FIRMS) + wind (NWS)
3. GROUND   → Mireye: terrain/slope + roads out for that address
4. PROJECT  → heuristic (NOT real fire modeling): fire spreads WITH wind + faster
              UPHILL. Expand danger zone in wind direction. State honestly if asked.
5. ROUTE    → Google Directions, alternatives=true → 3-4 candidate routes
6. JUDGE    → CORE: score each route — does it cross fire perimeter OR projected
              danger zone? Reject dangerous routes. This is where "Google's fastest
              route goes through the fire, we reject it" happens.
7. PERSONALIZE → healthy adult = fastest safe route; vulnerable = wider safety margin,
              leave earlier, prefer flatter routes (Mireye slope).
8. VERDICT  → Claude writes it: GO/direction/time/why, cited.

### Two-speed principle (architecture)
- SLOW layer (Claude, on request): scores danger, picks route, writes verdict.
- FAST layer (graph selection): "road blocked" → next pre-scored route instantly,
  no LLM. [Live reroute = post-hackathon; do NOT build today.]

## 6. API STACK (all keys in .env.local / Render env vars)
| Purpose        | API                              | Auth        |
|----------------|----------------------------------|-------------|
| Fire perimeter | NIFC Wildfire Perimeters (ArcGIS)| none        |
| Fire hotspots  | NASA FIRMS                       | key         |
| Wind           | NWS / weather.gov                | none (UA)   |
| Routing        | Google Directions (alternatives) | key         |
| Geocoding      | Google Geocoding                 | key         |
| 3D visual      | Google 3D Tiles + Cesium ion     | keys        |
| Map fallback   | Mapbox                           | key         |
| Physical facts | Mireye (code BUILD)              | key         |
| Reasoning      | Claude (Anthropic)               | key         |
| Fast/fallback  | Groq                             | key         |
| Air quality    | AirNow / PurpleAir (optional)    | key         |
| Alerts         | Twilio/Vonage/Resend (optional)  | on-site     |

## 7. ROBUSTNESS (steal from FireflAI — wins when APIs die on stage)
- Every external call: try primary → secondary → HARDCODED canned scenario.
- Wrap feeds in Promise.allSettled: one dead API ≠ blackout.
- HARDCODE one real fire scenario so the demo NEVER breaks live.

## 8. STACK & HOSTING
- Frontend: React + TypeScript + Tailwind. Backend: Node/Express or FastAPI.
- Map/3D: Cesium + Google Photorealistic 3D Tiles (fallback: Mapbox 2D).
- HOST ON RENDER (sponsor). Deploy a skeleton to Render in HOUR 1, push all day.
  Set API keys in Render's env var dashboard, not just local.

## 9. SCOPE DISCIPLINE (READ THIS TWICE)
- BUILD TODAY: FIRE only. One hazard. One scene. Flawless.
- Engine is hazard-agnostic (takes "danger zone + spread direction") so flood/quake
  are "swap the data source" — TRUE, say it in pitch, don't build it.
- PITCH: multi-hazard (fire/flood/quake) + live rerouting = "what's next / engine
  already supports it."
- Personalization (step 7) is a LIGHT add-on — build step 6 (JUDGE) FIRST.
- DO NOT build: real fire prediction, 3D reconstruction, live reroute, multi-hazard,
  offline mesh, scraping. All post-hackathon.

## 10. TEAM (3 people) + WORKFLOW
- Navelan: JUDGE (routing + danger-score + reject logic) + pitch.
- Person 2: data layer (NIFC + FIRMS + NWS) + Claude verdict.
- Person 3: map/3D + verdict UI + canned fallback.
- First 30 min TOGETHER: scaffold repo, lock types.ts (Hazard, Route, Verdict),
  assign FILE OWNERSHIP (no collisions — this cost us last hackathon).
- Everyone on own branch. Navelan = merge captain. Nobody pushes to main directly.

## 11. JUDGING (optimize for this)
- Innovation 25% | Technical execution 25% | Design/UX 25% | Presentation 20% | Impact 10%
- Design + Presentation = 45%. Make the verdict screen LOOK like an emergency:
  big, red, urgent, ONE instruction, huge. Rehearse the 3-min pitch TWICE.
- 3-min pitch: 0:00 problem (visceral) → 0:30 demo (the betrayal) → 1:30 how/why-hard
  (cite NIST, honest heuristic) → 2:15 impact + what's next → 2:45 close.
- Close: "Everyone tells you a fire exists. We tell you the safe way out." Stop.
