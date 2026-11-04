# RADAR Campus Explorer + Pathfinder

The complete Pathfinder facilities platform, with an interactive pixel-art school map inside the RADAR
game dashboard. Walk between buildings, explore the supplied indoor hallways,
choose a classroom, and travel between floors using the internal stairs.

This repository runs independently of the original RADAR application. The map opens
directly without a login wall. Map navigation,
room photos and a device-only student profile work in the browser. Separate student
accounts use Supabase for private profiles, photos and shared campus characters.
The public connection settings for your separate project are included; apply the
[student database setup](docs/STUDENT-PROFILES.md) before using online accounts.

The blue-and-purple dashboard includes navigation, building information, a mini-map,
an actual clock, a profile menu, static assistant help and classroom-card missions.
Weather, hazard, AI, messaging and emergency services explicitly show unavailable
states until configured. See [dashboard behavior and integrations](docs/DASHBOARD.md).

## Complete facilities platform

The full SvelteKit/Cloudflare Pathfinder application lives in `apps/pathfinder`.
It includes staff accounts/permissions, shared documents, PDF editing/export,
floor versions, project review, collaboration/sharing, audit/admin, search,
media uploads and the 3D scan viewer. The React campus explorer is available
without staff login at `/campus/`. Staff use `/campus-workspace` for its eleven
linked floor documents and can publish device drafts as new shared documents.

[Full platform setup, tests and deployment](docs/PATHFINDER-PLATFORM.md).
The combined application is AGPL-3.0-or-later; see LICENSE and THIRD_PARTY_NOTICES.md.

## Run on your computer

Install Node.js **24 LTS**, then:

```bash
git clone https://github.com/andrewhaha-sudo/radar-campus-explorer.git
cd radar-campus-explorer
npm ci
npm run dev
```

`npm ci` also installs the locked Pathfinder dependencies. `npm run dev`
prepares local D1/R2/KV and starts RADAR Facilities; choose **Campus explorer**
for the student map. Local setup uses upstream demo accounts only. For a built
preview, run `npm run build`, `npm run setup:local`, then `npm start`.
Live provider credentials and real scan assets are configured separately.

## Floorplan editing

Use **Edit floorplan** to annotate each indoor floor with Pathfinder safety markers,
areas, arrows and notes. Drafts save on this device and support undo/redo and JSON
import/export. [Editor details and source licensing](docs/PATHFINDER.md).
The combined web application incorporates AGPL-3.0-or-later code; see
[third-party notices](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE).

Local campus routing needs no API server. Local Facilities uses the D1/R2 setup above.

For the optional LifeRouter engine, see [LifeRouter setup](docs/LIFEROUTER.md).
Run the optional campus-only simulation and routing service with `docker compose -f compose.liferouter.yaml up --build -d`,
then open http://localhost:8080 and select **LifeRouter (simulation)** in the routing controls.

## Use the map

- Click a building to view information, then choose **Walk to entrance**, **Explore
  building**, or **Floor plan**. Click a walkway or open grass to walk there. The lawns, garden clearings,
  court, pond bank, gazebo, flagpole and canteen entrance have connected routes.
- Use **WASD**, **arrow keys**, or the on-screen direction buttons to move manually.
  Manual movement cancels an automatic route.
- Press **E** near an entrance, staircase, or exit to interact.
- Choose a classroom to follow its connected route, including stairs when needed.
- Toggle **Show route arrows** to show or hide the direction of travel. The character
  keeps walking when the arrows are hidden; keyboard movement cancels the route.
- Toggle **Breeze animation** for gently moving tree foliage and grass. It pauses
  offscreen and in background tabs, and stays still with reduced-motion preferences.
- Click any room door to open its photo viewer. Choose **Add room photo** to save an
  image, then click the same room later to see it. **Walk to this room** starts a route.
- Open **Indoor floor plans** to view the complete source sheet or an individual building.
- Use zoom, expand, or **Original artwork only** to inspect the maps.
- Use **Inspect** for room and route controls, and **Settings** for identity, private
  GPS and display controls. Breeze, route-arrow and walkable-area preferences persist
  on this device. GPS permission is never enabled automatically.
- Open three different room cards to complete **Current Mission**. Progress stays
  on this device, separately for each signed-in account or the device profile.
- Open **Student profile** or click your own character to create a trainer card,
  change your boy/girl character, and upload or take a profile photo.

| Building | Floors | Rooms per floor | Total rooms |
| --- | --- | --- | --- |
| A | 1 | 2 | 2 |
| B | 2 | 2 | 4 |
| C | 2 | 5 | 10 |
| Chemistry Lab | 1 | 1 | 1 |
| D (upper right) | 1 | 2 | 2 |
| E (beside the pond) | 2 | 3 | 6 |
| 6 | 2 | 5 | 10 |

Every two-floor building has working stairs. Added interiors reuse sections of the
supplied floor plan, with connected exits. Building 6 can be explored independently
because the campus artwork does not identify its outdoor entrance. Open grounds
are walkable; solid buildings, pond water, fences and dense tree clusters block travel.

The original artwork is preserved as extracted from the design PDF. Gameplay and
selection indicators are separate overlays. These are illustration-based walking
routes, not verified evacuation guidance. See [asset provenance](public/maps/README.md).

## Student profiles and characters

The trainer card has editable name, grade, section, teacher and sex. **Change Character**
switches the walking sprite without changing identity fields or the profile photo.
Both characters have idle and four-direction walking sprites.

**Upload photo** supports JPG, PNG and WebP up to 15 MB. **Take photo** opens the
camera after permission is granted. Crop, zoom and reposition the image, choose
**Use cropped photo**, then **Save Changes**. Real photos use the same portrait
frame as the default character. Remove a photo and save to restore the default portrait.

Without sign-in, the profile is stored in this browser. Signed-in profiles save to
the separate account; the device profile is never uploaded automatically. Photos
and identity fields start private. Enable **Show my character to signed-in students**
and choose which fields to share. Other signed-in students can click that character
to see only the permitted fields and photo. Hidden photos use the character portrait.

See [Student profiles: setup and privacy](docs/STUDENT-PROFILES.md).

## Live location and identity

**My live location** can move your character from actual device GPS readings.
First use **Calibrate map** to match at least three verified campus geographic
references to points on the supplied image, then choose **Enable location sync**
and grant browser permission. No campus GPS coordinates are invented or preset.
Use HTTPS (or localhost). The panel shows signal status and accuracy; unreliable
readings preserve the last reliable marker. GPS never guesses a classroom or floor.

**Edit identity** sets a nickname, role, avatar and uniform color. Nickname, role
and color stay on this device. Live location is private, is never uploaded or kept
as history, and pauses existing character sharing for the page session. **Disable
location sync** stops the watch; **Correct location manually** allows an explicit
correction. See [calibration, privacy and phone testing](docs/LIVE-LOCATION.md).

## Room photos

Every room door is clickable, including the doors on the original floor-plan overview.
Open a room and select a JPG, PNG, WebP or GIF image up to 10 MB. A saved photo appears
when you reopen that room and survives a page reload in the same browser. Each room
has its own photo; adding a photo to one room does not change any other room.

Uploads are stored locally in **IndexedDB on that device**. They are not sent to a
server or automatically shared with other visitors. Clearing browser/site storage
can remove them, so keep the original files. To publish photos for all visitors,
add them to `public/room-photos/`, map room IDs to image paths in
`public/room-photos.json`, then commit and deploy. See the
[published photo instructions](public/room-photos/README.md) for an example.

## Deploy the complete application

The full platform targets Cloudflare Pages/Workers with D1, R2 and KV bindings.
`npm run build` outputs the combined application into `dist`. Configure your own
resources, admin accounts and secrets before `npm run deploy`; local defaults
contain placeholder resource IDs and deployment is blocked until configured.

The earlier Vercel static-host setup cannot run the facilities backend. Its
configuration is retained only as `docs/VERCEL-STATIC-LEGACY.json`. See
[the platform deployment guide](docs/PATHFINDER-PLATFORM.md).

## Checks

```bash
npm run lint
npm run check:pathfinder
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The full-platform browser suite uses local D1/R2/KV, generated campus PDFs and
synthetic scan data. `npm run test:e2e:campus` retains the separate campus-only
suite; run `npm run build:campus` first. Both have local-only fixture accounts.
See the platform guide for browser installation and deployment limitations.

## Source

- `apps/pathfinder/`: complete Pathfinder frontend, backend, migrations and tests
- `scripts/platform.mjs`: unified build and local binding setup
- `scripts/campus-registry.mjs`: stable campus-to-document registration


The [nine-repository evaluation](docs/research/REPOSITORY-EVALUATION.md) compares
external mapping and routing bases with pinned revisions and actual test results.
The isolated [LifeRouter compatibility prototype](experiments/liferouter/README.md)
exports the existing campus geometry for simulation; the separate LifeRouter bridge connects simulation routing to the app. It is not verified emergency guidance.

- `src/App.tsx`: standalone entry page
- `src/components/dashboard/`: dashboard panels, navigation, assistant, mini-map and dialogs
- `src/lib/dashboard-config.ts`: school represented by the supplied campus artwork
- `src/components/map/CampusExplorer.tsx`: map, controls, character and scene transitions
- `src/components/map/campus-data.ts`: map bounds, walking corridors, rooms and entrances
- `src/components/map/navigation.ts`: collision checks and A* pathfinding
- `src/components/map/CampusBreeze.tsx`: tree and grass animation overlays
- `src/components/student/`: trainer card, editor, character sprites, camera and cropper
- `src/lib/student-project.json`: public connection settings for the separate accounts
- `supabase/migrations/`: profile tables, ownership rules and private photo bucket
- `src/components/map/campus-explorer.css`: interface styling
- `public/maps/`: original embedded artwork

Map coordinates use the images' original pixels, independent of screen size or zoom.
The `public/sw.js` file retires an old full-app service worker if this site previously
hosted that version; the standalone app does not register a new service worker.

Indoor Map is available at `/indoor-map/` alongside Facilities and the existing
campus explorer, with local room search, floor switching and walking paths.
See [integration notes](apps/indoor-map/UPSTREAM.md) for scope and licensing.

## Preparedness suite

Open **Resources** for learning quizzes, children's activities, records, school
notices and drills, a geographic facilities map, moderated community support,
help requests and administration. The existing campus map and LifeRouter remain
available. Local activities need no backend; shared services require the new
Supabase migration and staff grants. Donations require a verified recipient and
the receipt-verification function.

See [feature scope and activation instructions](docs/RESQVERSE.md). This is an
original implementation inspired by ResQverse, whose repository has no reuse license.
