# RADAR audit

Date: 2 November 2026. Scope: this repository, `radar-campus-explorer`. The PDF inventory was not treated as proof.

## Stack

Vite, React, TypeScript. One page, `src/App.tsx`. Sections are chosen in `RadarShell` and addressed with a URL hash. There is no multi-page router and no application server. Persistence for RADAR records is `localStorage`. Optional student accounts use Supabase from the browser. The map is an SVG over the supplied campus artwork, with A* walking in `src/components/map/navigation.ts`.

## What works

- Campus illustration, building positions, names, walkable areas, collision, stairs, room doors, and the character.
- Device profile, optional student sign-in, and private profile photos.
- Outdoor GPS follow, calibration, accuracy limits, and no broadcast of that position to other students.
- Google Map view when `VITE_GOOGLE_MAPS_API_KEY` is set. Without it the view says the key is not configured.
- Device records for hazards, inspections, alerts, SOS, people, equipment, tasks, visitors, and CSV export.
- Place stamps. Building panels list only that building’s illustrated rooms.

## Broken or incomplete foundation

- Section choice used to live only in component state, so a refresh always returned to the campus. Hash routing is the repair in this session.
- The device role label does not authorize anything. There is no school workspace, membership approval, or the six school roles.
- Hazard reports were only on the Hazards screen. They were not visible on the building they name. This session shows non-rejected reports on that building.
- Illustrated walking routes are not a verified evacuation graph. Safety still says the route is unverified.
- External feeds, SMS, push, and vision models are not connected. Screens that mention them say NOT CONFIGURED.

## Not in this repository

Email school sign-in, Camarines Norte directory, inspection history as a school system, basemap editing, 3D, PAGASA, PHIVOLCS, Twilio, guardians as verified accounts, rosters as school records, and the P001–P104 proposals except the partial pieces named in the feature matrix.
