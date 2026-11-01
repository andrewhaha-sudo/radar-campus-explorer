# Deploy the standalone Campus Explorer

Campus Explorer is a static React/Vite app. It opens directly to the interactive map.
No account system, Supabase project, database, serverless function or API key is required.

## Create a separate website

1. Sign in at [Vercel](https://vercel.com/new).
2. Choose **Add New → Project** and import **andrewhaha-sudo/radar-campus-explorer**.
   Grant the Vercel GitHub integration access to this repository if it is not listed.
3. Choose **main** as the production branch and give the project an available name.
4. Set framework **Vite**, Node.js **24.x**, root directory **repository root**,
   install command **npm ci**, build command **npm run build**, output directory **dist**.
5. Leave environment variables empty. The included `vercel.json` configures static hosting.
6. Click **Deploy**, then open the address assigned by Vercel.

The original RADAR application's hosting project is separate. This repository's
home page is the explorer itself, without a RADAR shell or login redirect.

## Update an existing deployment of this repository

Deploy the newest commit from **main**. A redeployment of an older commit will still
use that older app. Reset any custom install/build/output overrides to the settings
above. Prior Supabase variables are not read by the standalone version and can be
removed from this Vercel project if they were added solely for the previous app.

There is no longer a `functions` section, API rewrite, or backend directory. The
old `functions.api/index.mjs.excludeFiles` error does not apply to this version.

## Check the deployed site

- Open the root address. **Campus Explorer** and the original campus image should appear.
- Click **Building B**, enter the building, and navigate to a floor-two classroom.
- Open **Indoor floor plans** and inspect Building 6's five doors on each floor.
- Check touch controls at a phone-sized viewport.
- Open Building C, Chemistry Lab and Building D; verify their one-, one- and two-room interiors.
- Toggle route arrows and click a room door to add a local photo. Reload and reopen that room.
- In the browser's Network panel, confirm the map images load and no `/api/` requests occur.

Room photo uploads save in the visitor's browser and do not need server configuration.
For photos everyone can view, deploy actual image files in `public/room-photos/` and
their room mappings in `public/room-photos.json`; see that folder's README. Do not add
Supabase variables solely for this feature.

If this origin previously served the full RADAR app, refresh after the new deployment.
The replacement `sw.js` retires the previous shell cache without deleting saved
account/offline data caches. New visitors do not register a service worker.

Publishing in Vercel is separate from committing or uploading source code to GitHub.
