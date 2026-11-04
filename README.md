# RADAR Campus Explorer

A standalone, interactive pixel-art school map inside the reference-inspired RADAR
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

## Run on your computer

Install Node.js **24 LTS**, then:

```bash
git clone https://github.com/andrewhaha-sudo/radar-campus-explorer.git
cd radar-campus-explorer
npm ci
npm run dev
```

Open the **Local** address printed by Vite. If you already cloned this repository,
stop the previous development server, run `git pull` and `npm ci`, then start it
again with `npm run dev`. There is no seed command. Local routing needs no API server.

For the optional LifeRouter engine, see [LifeRouter setup](docs/LIFEROUTER.md).
Run the complete app and routing service with `docker compose -f compose.liferouter.yaml up --build -d`,
then open http://localhost:8080 and select **LifeRouter (simulation)** in the routing controls.

## Full Pathfinder facility portal

Pathfinder runs alongside the existing app and LifeRouter, with its own staff login
and persistent floorplan/scan storage. See [Pathfinder setup](docs/PATHFINDER.md) for
credentials, backups, licensing and hosted deployment.

```bash
sudo docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml up --build -d
```

Open http://localhost:8080 and choose **Resources > Pathfinder**, or open
http://localhost:8082 directly.

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

## Publish your own website

Import **andrewhaha-sudo/radar-campus-explorer**, branch **main**, into a Vercel project:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | Repository root |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | Public student project settings are included; optional overrides are documented below |

Click **Deploy** and open the address Vercel assigns. To update an existing Vercel
project, deploy the latest commit on `main`. The former full RADAR server settings
are not used. Student accounts use their own project and schema.
[Full deployment instructions](docs/VERCEL.md).

The generated `dist` directory also works on a static host at the site's root.
The map itself does not call a school API. Signed-in profiles and shared characters
communicate with the configured Supabase project over authenticated requests.

## Checks

```bash
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests serve the production build with a static file server and verify
that the map works without signing in, and cover device profiles and mocked account
flows. Database privacy tests run the actual migration and policies in PostgreSQL
(PGlite). To use a Chromium binary already
installed on your machine, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when running
`npm run test:e2e`. `npm run preview` previews the built app locally.

## Source

The [nine-repository evaluation](docs/research/REPOSITORY-EVALUATION.md) compares
external mapping and routing bases with pinned revisions and actual test results.
The isolated [LifeRouter compatibility prototype](experiments/liferouter/README.md)
exports the existing campus geometry for simulation; it is not connected to the
live app or verified emergency guidance.

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

## Preparedness suite

Open **Resources** for learning quizzes, children's activities, records, school
notices and drills, a geographic facilities map, moderated community support,
help requests and administration. The existing campus map and LifeRouter remain
available. Local activities need no backend; shared services require the new
Supabase migration and staff grants. Donations require a verified recipient and
the receipt-verification function.

See [feature scope and activation instructions](docs/RESQVERSE.md). This is an
original implementation inspired by ResQverse, whose repository has no reuse license.
