# Complete Pathfinder platform in RADAR

The full Pathfinder SvelteKit application is included under `apps/pathfinder` at
revision d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a. Its database-backed routes,
16 migrations, auth/roles, hierarchy, projects and approval, PDF annotation/export,
floor versions, media uploads, 3D viewers, sharing/comments, search, audit/admin,
notifications and provider integration code are retained. There is no edition gate.

## Run locally

Use Node.js 24 and the existing checkout; do not create a worktree unless asked.

```sh
npm ci
npm run build
npm run setup:local
npm start
```

The main application is Pathfinder/RADAR Facilities. `/campus/` is the existing
React campus explorer. `/campus-workspace` connects its eleven floors to shared
Pathfinder floorplan documents. Both run on one origin with the existing staff
session cookie. Student Supabase profiles remain separate from staff permissions.

`setup:local` applies migrations to local D1, creates the published upstream local
test accounts, initializes the campus hierarchy without overwriting shared edits,
and stores generated campus PDFs in local R2. It generates a local JWT secret only
if `.dev.vars` does not already exist. The local admin demo login is
`test@test.com` / `test1234`. Never use demo accounts or demo seeds in production.
The supplied images are illustrations, not verified facility survey data.

`npm run dev` prepares the campus bundle and local bindings, then starts SvelteKit
with local D1/R2/KV on port 5173. Svelte pages have hot reload. For React editing,
`npm run dev:campus` runs its standalone Vite server on 5174; `npm run build:campus`
refreshes the campus bundle embedded in the facilities application. The standalone
React server cannot serve the facilities backend. Live processes must be restarted
in future tasks; dependencies, source and local binding state are retained files.

The campus editor can publish a device draft as a **new** shared document after
staff sign-in. The server enforces the existing Pathfinder roles. It uses the same
floor PDF and normalized coordinates; it never overwrites the base floor document
or another staff member's annotations. Shared editing/review then happens in the
full document viewer. Raw scans and GPS are not automatically registered to a floor.

## Checks

```sh
npm run lint
npm run check:pathfinder
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:pathfinder
# Existing student/campus-only regression suite:
npm run build:campus
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e:campus
```

The facilities browser harness builds the unified app, applies local migrations,
loads upstream synthetic fixtures plus the RADAR floor PDFs, and serves port 4173.
It uses one worker because local D1 is a shared SQLite file. The RADAR/GPU integration project runs in a fresh browser after upstream checks. `npm run test:e2e`
aliases this full-platform suite. The previous campus-only suite uses port 4175
and `.build/campus`. Neither suite configures production services.

## Deployment

The full backend targets **Cloudflare Pages/Workers**, not Vercel static hosting.
`npm run build` outputs the combined worker and assets into `dist`. The previous
`vercel.json` describes only the old static app; it cannot deploy this backend.

Before `npm run deploy`, create resources in your own Cloudflare account and replace
the placeholder D1/KV IDs in root `wrangler.toml`. Bind `DB`, `DOCUMENTS` and `CACHE`.
Configure a strong `JWT_SECRET` securely through Cloudflare, apply the included D1
migrations **without demo seeds**, provision your own admin accounts, and initialize
your approved facility records/files. The deployment command refuses the placeholder
D1 ID and never targets the upstream author's deployment. Nothing is deployed by setup.

Existing optional integration interfaces remain available: Workers AI or a selected
external AI provider, Resend email and Sentry. Configure only intended providers and
credentials; they are not fabricated or enabled by the local defaults. Actual email,
provider inference, production access and scanning require their real configuration.
The 3D viewer needs supported SPZ scan assets and browser WebGL2; including the viewer
and passing its shell/math tests does not validate a real campus scan or its alignment.

The whole combined web application retains AGPL-3.0-or-later licensing. The source
archive generated during the root build includes both applications, migrations,
configuration, tests and build scripts, while excluding secrets, local databases,
installed dependencies, generated bundles and runtime output. Keep the public source
download available when hosting modified versions.

## Indoor Map alongside Pathfinder

`/indoor-map/` adds the Leipzig Indoor Map MapLibre renderer without replacing
Pathfinder or the React campus. Open it from either application's navigation.
It provides room search, all eleven illustrated floors, 2D/3D doorway overlays,
within-building walking paths including stairs, and links to each shared
Pathfinder document. The existing pathfinding geometry is reused. These paths
are illustrative and are not approved evacuation or accessibility instructions.

The complete upstream source and its Docker tile/routing configuration are kept
in `apps/indoor-map/upstream`; see `apps/indoor-map/UPSTREAM.md` for provenance
and adapter changes. Original school data is not served. The runtime is self
contained with no public basemap, external font, tile server, geolocation or
Valhalla request. It uses local illustration coordinates, not surveyed GPS.
Martin/PostGIS/Valhalla services are not deployed by this integration.

Root `npm ci` installs this module as well. Root build/dev automatically build it
and copy its assets beside the campus and Pathfinder worker. `npm run
build:indoor` builds only its bundle; root build/dev is needed to refresh the
unified application. Both OSL and AGPL notices and sources remain in the source
archive. No Pathfinder documents, migrations, annotations or scans are removed.

## Preserved preparedness and LifeRouter features

The merged application retains Resources (learning, children, school notices,
drills, reports, community, help, records and school administration), nearby
outdoor facilities, private student accounts/GPS, and optional LifeRouter.
Shared school services still require the Supabase activation described in
`docs/RESQVERSE.md`; Pathfinder staff sessions do not grant Supabase school roles.

The annotation model, renderer, history and JSON format now have one canonical
implementation in Pathfinder. The campus editor uses compatibility re-exports
for device drafts; publishing remains additive. The extra dashboard shortcut was
removed from the campus footer; shared Facilities tools have one main link there.
Indoor Map uses the existing campus room registry and walking geometry. Nearby
facilities stays separate because it maps outdoor services rather than rooms.

Set `LIFEROUTER_ORIGIN=http://127.0.0.1:8091` in local `.dev.vars` after starting
the existing Go bridge to enable simulation routing through the unified app.
Production requires a reachable HTTPS LifeRouter origin configured by the operator.
No external origin is enabled by default. The proxy forwards only route/health
requests, does not forward staff credentials and rejects redirects and large bodies.
The optional Docker Compose deployment remains a campus-only simulation; the
complete Facilities backend still uses Cloudflare. See `docs/LIFEROUTER.md`.
