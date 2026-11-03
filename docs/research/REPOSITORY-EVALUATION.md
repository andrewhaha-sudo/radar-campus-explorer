# Repository evaluation — 3 November 2026

## Decision

**Best external application base: Pathfinder. Best routing companion: LifeRouter.**
Keep the existing standalone React campus explorer as the student-facing app.
Use a separately maintained Pathfinder fork for staff floorplan annotation,
review, documentation and auditing if its AGPL source-sharing obligations are
acceptable. Do not replace the working explorer with nine combined applications.
LifeRouter is the strongest indoor routing candidate, but its service-readiness
failure must be resolved before production integration.

This recommendation is based on inspected source and local execution, not stars
or README claims. All nine repositories were shallow-cloned. Exact commit hashes,
licenses and outcomes are recorded in [repository-evaluation.json](repository-evaluation.json).
The GitHub metadata API was unavailable; repository content was obtained through Git.

## Results across all nine

| Repository | Execution evidence | What is useful | Decision / limitation |
|---|---|---|---|
| [Pathfinder](https://github.com/melonmelonz/pathfinder) | Build and Svelte checks pass; 331 unit tests pass, one todo; all 63 local browser tests pass | Floorplan annotation, marker types, floor ordering, review workflow, collaboration and audit model; 3D scan support | Best facility-portal base. AGPL-3.0-or-later declared in package. SvelteKit + Cloudflare D1/R2 is a separate stack from React/Supabase. |
| [Indoor Map](https://github.com/Evangelisches-Schulzentrum-Leipzig/indoor-map) | Frontend build passes; stubbed Valhalla request exposes a routing bug | Room search, floor filtering, vector map presentation | OSL-3.0. `js/routing.js:getRoute(start,end)` ignores arguments and submits fixed Leipzig coordinates. `RoutingEngine` only initializes fields. Do not use unchanged for your campus. Tile/routing servers not launched. |
| [LifeRouter](https://github.com/Kentalives/LifeRouter) | Grid, agent and emergency package tests pass. API suite fails once on multi-floor emergency subscription; that test passes on three isolated retries | Floor portals, occupancy grids, incremental routing and emergency flow fields | Apache-2.0; strongest routing component. Requires Go, NATS and external position/cost/region adapters. Not a complete school app. |
| [ResQverse](https://github.com/Prasi24bms017/resqverse-ready) | Clean install fails due to stale lockfile. Non-lockfile install succeeds; build and one example test pass | Role-oriented school experience, preparedness activities | No reuse license found. `src/components/tabs/MapTab.tsx` and teacher/parent maps contain literal IMD/NDMA alert strings. Those strings are not verified live feeds. Do not copy or present them as Philippine alerts. |
| [Evacuation-Optimiser](https://github.com/0-robert/Evacuation-Optimiser) | Original classes loaded without GUI autorun; synthetic GeoJSON route to exit succeeds; 2 pupils become 4 agents | Offline exit-placement experiments and congestion modelling | MIT. `_add_people` duplicates each pupil; `Person` ignores its speed argument and fixes speed at 0.5. Requires source GeoJSON; GUI/genetic optimization was not fully run. Not a live routing base. |
| [Water Watch](https://github.com/mishanilkazreen/water-watch) | TypeScript build fails. No test files. In-process report POST succeeds; invalid geographic coordinates also return 201 | Hazard-report lifecycle and buffered avoidance polygons | MIT. Browser ORS call uses `driving-car`, 200 m buffers and UK geocoding. Mapbox/ORS credentials required. Report API lacks coordinate-range checks and tested inserts require no authentication. Adapt concepts, not its emergency claims or default API. |
| [RouteOut](https://github.com/Andrii-Samiilenko/RouteOut) | Dashboard frontend builds | Coordinator/citizen separation and simulation controls | No reuse license found. `dashboard/backend/app/engine.py` is a simulation engine with Barcelona presets. Backend, hazard physics and notification delivery not verified. |
| [ResilienceMap AI](https://github.com/Kaiserzanmato/ResilienceMapAI) | Frontend build and 46 frontend tests pass | Source provenance, freshness and explicit unavailable-data states | No reuse license found. Broad geographic screening, not indoor routing. README says PHIVOLCS volcano data permission is DocypherLabs-only and forbids redistribution; data is absent from repo. That permission does not transfer to RADAR. Live sources/AI/PostGIS not verified. |
| [Disaster Response GIS](https://github.com/HyLuthfi/disaster-response-gis) | Frontend builds; backend source inspected | Excluding closed edges from pgRouting queries; dispatch data model | MIT. Regional road/fleet system rather than indoor navigation. `backend/main.py` login compares supplied password directly in SQL; privileged endpoints need an authentication/authorization review. PostGIS backend was not launched. |

## Pathfinder verification details

The first unit command ran before generated SvelteKit configuration existed and
failed at setup. `npm run check` generates it; the subsequent unit run passed.
Local browser tests used Chromium, Miniflare/D1 migrations, synthetic seeded users
and an evaluation-only JWT secret. No production deployment or messages were sent.
The browser suite exercised login, hierarchy, annotation, review, search, sharing,
floors, exports and audit screens. I inspected its generated map-mode screenshot.

The screenshot explicitly shows a demo floorplan where object storage is absent.
This does not verify real uploaded school plans, actual splat files, survey accuracy,
or production R2 access. A splat viewer is not automatically a Blender GLB game
viewer, and annotation markers do not automatically generate valid collision meshes.

Pathfinder's README still describes a Community/Pro split. Its current AGENTS.md
says that split was abolished on 18 August 2026. Treat the README edition table as
stale; assess the actual pinned source and deployment before adoption. Do not strip
copyright notices or assume its safety symbols confer NFPA certification.

## Reuse performed now

The [LifeRouter adapter](../../experiments/liferouter/README.md) is a concrete,
runnable proof of compatibility with your current data. It exports 12 floor/campus
masks, ten stair/entrance portal pairs and 35 room endpoints. A test executed inside
the pinned LifeRouter checkout loads them through the actual production rasterizer
and verifies room-to-portal connectivity. All checks pass.

The adapter is original glue code. It reuses your existing map geometry without
copying third-party application code into RADAR. Building 6 remains unlinked to
the outdoors because its entrance is unknown. Its illustrative demo scale must
not be used as a measured campus scale. No private GPS data is sent anywhere.

## What to reuse next, in order

1. Keep RADAR's existing artwork, rooms, profile accounts, character movement and
   privacy controls. They are already integrated and tested.
2. Fork Pathfinder as the staff facility portal: preserve license notices and
   meet AGPL corresponding-source obligations for modifications made available
   over a network. Define mappings between its building/floor/document/marker IDs
   and RADAR's building, scene and room IDs. Do not silently merge account stores.
3. Integrate LifeRouter behind an authenticated server adapter after fixing and
   stress-testing NATS startup readiness. Use real occupancy masks, explicit stairs,
   approved exits and closure revisions. Keep the browser's private GPS policy.
4. Adapt MIT-licensed hazard-buffer/reporting ideas from Water Watch and closed-edge
   filtering from Disaster Response GIS. Use pedestrian/indoor geometry, validation,
   authorization and source timestamps. Include upstream notices if copying code.
5. Use Evacuation-Optimiser only as an offline research module after correcting
   duplicated agents and speed handling, with measured widths and validated inputs.
6. Request explicit reuse permission for ResQverse, RouteOut and ResilienceMap AI
   before copying their source. Their public availability is not a reuse license.

## Scope and deployment

No application base was replaced, no external source was relicensed, and no new
external service was connected to student accounts. The experiment is outside the
web app's imports, so it does not change the shipped app or claim safe routes.
Clones and raw test logs are in `/workspace/repo-evaluation` for local inspection;
these clones are not included in RADAR's Git history. Some initial setup failures
were repaired in those disposable checkouts and are recorded above.

Test counts are development evidence, not a security audit or certification for
emergency use. A real deployment needs surveyed floorplans, school-approved exits,
independent accessibility/evacuation review, verified hazard sources and permission
for any real communications. The recommendation remains Pathfinder for the portal,
LifeRouter for routing, and the current RADAR app for the student experience.
