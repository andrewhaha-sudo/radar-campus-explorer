# Campus Explorer

A standalone, interactive pixel-art school map. The home page opens directly to the
campus. Walk between buildings, explore the supplied indoor hallways, choose a
classroom, and travel between floors using the internal stairs.

This version runs entirely in the browser. It has no RADAR dashboard, login,
backend, database, Supabase configuration, or required API keys.

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
again with `npm run dev`. There is no seed command or API server to start.

## Use the map

- Click a building or a mapped walkway to walk there.
- Use **WASD**, **arrow keys**, or the on-screen direction buttons to move manually.
  Manual movement cancels an automatic route.
- Press **E** near an entrance, staircase, or exit to interact.
- Choose a classroom to follow its connected route, including stairs when needed.
- Open **Indoor floor plans** to view the complete source sheet or an individual building.
- Use zoom, expand, or **Original artwork only** to inspect the maps.

Building A has one floor and two classroom doors. Building B has two floors with
two doors per floor. Building 6 has two floors with five doors per floor; its
interior can be explored independently because the campus artwork does not identify
its outdoor entrance. No interiors are invented for buildings without supplied art.

The original artwork is preserved as extracted from the design PDF. Gameplay and
selection indicators are separate overlays. These are illustration-based walking
routes, not verified evacuation guidance. See [asset provenance](public/maps/README.md).

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
| Environment variables | None required |

Click **Deploy** and open the address Vercel assigns. To update an existing Vercel
project, deploy the latest commit on `main`. Previous Supabase settings are no longer
used. [Full deployment instructions](docs/VERCEL.md).

The generated `dist` directory also works on a static host at the site's root.
The browser requests only the app bundle and local artwork; it does not call a school API.

## Checks

```bash
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests serve the production build with a static file server and verify
that the app works without accounts or an API. To use a Chromium binary already
installed on your machine, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when running
`npm run test:e2e`. `npm run preview` previews the built app locally.

## Source

- `src/App.tsx`: standalone entry page
- `src/components/map/CampusExplorer.tsx`: map, controls, character and scene transitions
- `src/components/map/campus-data.ts`: map bounds, walking corridors, rooms and entrances
- `src/components/map/navigation.ts`: collision checks and A* pathfinding
- `src/components/map/campus-explorer.css`: interface styling
- `public/maps/`: original embedded artwork

Map coordinates use the images' original pixels, independent of screen size or zoom.
The `public/sw.js` file retires an old full-app service worker if this site previously
hosted that version; the standalone app does not register a new service worker.
