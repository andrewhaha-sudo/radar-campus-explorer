# Standalone RADAR dashboard

The reference dashboard is implemented in `radar-campus-explorer`. It does not
load the original RADAR repository or require its server. Run `npm ci` and
`npm run dev` with Node.js 24. Static hosting builds with `npm run build` and serves
`dist`; the existing Vercel configuration is retained.

## Interface and behavior

- The header has a configured school selector, unverified safety status, real
  Asia/Manila clock, application notice and account menu. Only the school represented
  by the provided artwork is configured in `src/lib/dashboard-config.ts`.
- The sidebar and bottom navigation open actual map, room, account, student,
  resource and settings controls. Missing services have explicit explanations.
- Building hotspots use the original image coordinates. They open information with
  entrance walking and available interior/floor-plan actions. GPS mode permits
  reading details but disables simulated entrance/interior travel.
- Keyboard, touch and route movement retain the existing collision/pathfinding
  system. The outdoor camera fits the dashboard and follows southward movement;
  Center and zoom controls adjust the current scene. Original-artwork view remains
  available under Inspect. Added C/E rooms retain composed hallway artwork in both
  the main map and mini-map.
- The assistant is an original SVG owl with expandable static guidance. It does
  not produce AI responses. Mission progress counts unique room cards actually
  opened, with a target of three. Progress is local and keyed by account/device.
- Breeze, route arrows and walkable-area display preferences are saved locally.
  Neither mission storage nor display preferences contain physical location data.
- The right panels collapse on desktop and mobile. On phones, sidebar buttons
  scroll horizontally and bottom navigation wraps into two rows. GPS, identity,
  directory and room controls are below the dashboard, reachable through Settings
  and Inspect. Dialogs trap focus and support Escape.

## Rendering and design limits

`RadarDashboard.tsx` supplies the header, navigation, panels, mini-map, assistant
and mission components. `DashboardDialogs.tsx` contains building and feature
dialogs. `radar-dashboard.css` defines the neon frame, button and responsive styles.
`CampusExplorer.tsx` remains the owner of gameplay, scenes, room/profile dialogs
and location state; its SVG layers and world coordinates remain intact.

The existing front-facing campus artwork, floor-plan artwork and character sprites
are reused. No collision regions or building entrances are shifted to approximate
the newer reference's different perspective. The implementation follows the
reference's layout, colors and framing; it is not a pixel-identical reproduction.
Its original owl, vector interface icons and browser fonts differ from the supplied
mascot and illustrated text. The building beside the pond remains correctly
renamed E. See `public/maps/README.md` for source artwork provenance.

## Services that still need configuration

| Feature | Current state | Required integration |
| --- | --- | --- |
| Weather | Not connected; no invented readings | A verified campus coordinate and weather provider, with observation timestamp, units and stale/error handling |
| Disaster watch / safety / hazard map | Unverified | Approved current school advisories and authoritative hazard sources with provenance and expiry |
| Evacuation guidance | Illustration-based walking only | A school-approved emergency plan and verified route data |
| AI room assessment | Room photos available; AI unavailable | An authenticated analysis service and an explicit image submission workflow |
| Hazard reports | No reports submitted | Authenticated reporting endpoint, staff destination, validation and successful-response handling |
| SOS / school messages | No communications sent | Verified contacts and an authorized communications service; never infer delivery from a button click |
| Online student accounts | Separate public Supabase project configured | Apply the existing student migration, configure auth redirect URLs and verify hosted access policies; see `STUDENT-PROFILES.md` |
| Physical GPS alignment | Browser tracking implemented | At least three verified on-site calibration references, HTTPS and device permission; see `LIVE-LOCATION.md` |

No service-role key belongs in browser code. Mission progress and local preferences
need no database migration. This dashboard change introduces no outgoing reporting,
messaging or emergency requests.

## Verification

Build/type checking: `npm run build`. Lint: `npm run lint`. Unit/database checks:
`npm test`. Production-browser checks: `npm run test:e2e` (install Playwright
Chromium, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an installed executable).

`tests/browser/dashboard.spec.ts` covers navigation/unavailable states, building
details and focus restoration, mission persistence, display preferences, mini-map
controls, collapsible panels and desktop/mobile overflow. Existing suites retain
movement, collisions, floors, room photos, profile privacy and GPS checks. GPS
browser tests simulate readings; actual on-campus accuracy and hosted Supabase
configuration must still be verified on the intended devices and project.

Screenshots captured from the production build are included for visual review:

- [Reference dimensions, 1672 × 941](screenshots/radar-reference.png)
- [Desktop, 1648 × 1088](screenshots/radar-desktop.png)
- [Phone, 390 × 844](screenshots/radar-phone.png)

The captures were checked for framing, panel proportions, readable controls and
horizontal overflow. The supplied campus arrangement and coordinate alignment are
retained. The larger desktop height reveals more of the lower garden; phones use
stacked panels. None of these screenshots is a claim of pixel-identical artwork or
connected live services.
