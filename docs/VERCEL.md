# Deploy the standalone Campus Explorer

Campus Explorer is a static React/Vite app. It opens directly to the interactive map.
The map opens without signing in. Optional student accounts connect directly to
the separate Supabase project through owner and sharing policies. No Vercel
serverless function or private server key is required.

## Create a separate website

1. Sign in at [Vercel](https://vercel.com/new).
2. Choose **Add New → Project** and import **andrewhaha-sudo/radar-campus-explorer**.
   Grant the Vercel GitHub integration access to this repository if it is not listed.
3. Choose **main** as the production branch and give the project an available name.
4. Set framework **Vite**, Node.js **24.x**, root directory **repository root**,
   install command **npm ci**, build command **npm run build**, output directory **dist**.
5. The public student project settings are included. Apply the
   [student profile SQL setup](STUDENT-PROFILES.md) in Supabase to enable accounts.
   Environment overrides are optional. The included `vercel.json` configures static hosting.
6. Click **Deploy**, then open the address assigned by Vercel.

The original RADAR application's hosting project is separate. This repository's
home page is the explorer itself, without a RADAR shell or login redirect.

## Update an existing deployment of this repository

Deploy the newest commit from **main**. A redeployment of an older commit will still
use that older app. Reset any custom install/build/output overrides to the settings
above. Prior full-RADAR server variables are not read by this version. Student
accounts use the public project settings in `src/lib/student-project.json` or the
two optional `VITE_STUDENT_SUPABASE_*` overrides described in the profile guide.

There is no longer a `functions` section, API rewrite, or backend directory. The
old `functions.api/index.mjs.excludeFiles` error does not apply to this version.

## Check the deployed site

- Open the root address. **Campus Explorer** and the original campus image should appear.
- Click **Building B**, enter the building, and navigate to a floor-two classroom.
- Open **Indoor floor plans** and inspect Building 6's five doors on each floor.
- Check touch controls at a phone-sized viewport.
- Open Building C and verify five rooms on each of two floors; check Building E's
  three rooms on each of two floors. Chemistry Lab has one room and Building D has two.
- Click open grass and visit the pond bank or canteen. Toggle **Breeze animation**
  and check that reduced-motion preferences keep foliage still.
- Toggle route arrows and click a room door to add a local photo. Reload and reopen that room.
- In the browser's Network panel, confirm the map images load and no `/api/` requests occur.
- Open **Student profile**, save an identity and character, and try the photo editor.
  After the SQL setup, sign in and check a second account sees only shared fields.
- Open **My live location** on the HTTPS website. GPS starts OFF and needs verified
  map calibration before activation. Follow the [calibration and on-site phone
  checks](LIVE-LOCATION.md); this feature needs no new Supabase migration or server key.

Room photo uploads save in the visitor's browser and do not need server configuration.
For photos everyone can view, deploy actual image files in `public/room-photos/` and
their room mappings in `public/room-photos.json`; see that folder's README. Do not add
Supabase variables solely for this feature.

If this origin previously served the full RADAR app, refresh after the new deployment.
The replacement `sw.js` retires the previous shell cache without deleting saved
account/offline data caches. New visitors do not register a service worker.

Publishing in Vercel is separate from committing or uploading source code to GitHub.
