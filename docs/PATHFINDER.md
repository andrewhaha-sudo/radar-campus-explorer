# Full Pathfinder companion

The complete upstream Pathfinder application runs alongside Campus Explorer and
LifeRouter. Open **Resources > Pathfinder > Open Pathfinder**. It uses its own staff
accounts, Cloudflare-compatible storage, and interface. Existing campus navigation,
room photos, student accounts, GPS privacy, routing, and preparedness features remain
in Campus Explorer. Opening the portal does not synchronize student or location data.

## Start locally

From your existing checkout (do not clone over it):

```bash
cd ~/radar-campus-explorer
git pull
sudo docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml up --build -d
```

If Git reports local edits, commit or stash them before pulling. The first build
fetches and tests the pinned upstream application and can take several minutes.

- Campus Explorer: http://localhost:8080
- Pathfinder: http://localhost:8082
- LifeRouter retains its existing configuration.

Pathfinder is bound to this computer's loopback interface. View its initial private
administrator credentials with:

```bash
sudo docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml exec pathfinder node /opt/radar-pathfinder/show-admin.mjs
```

The password and signing secret are randomly generated on first startup. No public
demo users are seeded. Existing users are never reset by startup. Use your changed
password if you subsequently change it; the command displays only the initial one.
These credentials are separate from Supabase. Keep them private.

Create your facility hierarchy and projects in Pathfinder, then upload your own
floorplans and scans. The original annotation, safety-symbol, floor, scan-viewer,
review, collaboration, export, and audit tools are included without edition gates.
This does not automatically convert the pixel-art campus into a surveyed floorplan
or connect Pathfinder geometry to LifeRouter. AI, email, and other external-provider
features still require the corresponding upstream configuration and accounts.
3D viewing requires supported scan files and a WebGL2-capable browser.

## Storage and troubleshooting

D1, R2, KV state, initial credentials and the signing secret persist in the Docker
volume `pathfinder-data` (Compose adds the project prefix). Container rebuilds retain
that volume. Do not run `docker compose down -v` unless you intend to delete its data.
For backups, stop Pathfinder and back up the entire volume; restore it as a unit.
The volume contains private facility data and credentials, so protect backups.

```bash
sudo docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml ps
sudo docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml logs --tail=100 pathfinder
```

If port 8082 is occupied, change the host port in `compose.pathfinder.yaml` and save
the corresponding address under Resources > Pathfinder. You can also set
`VITE_PATHFINDER_URL` before building Campus Explorer. The launcher accepts HTTPS
origins or HTTP loopback origins, without paths, credentials or query parameters.
Saving an address does not test its availability.

## Hosted deployment

The Docker companion uses Wrangler's local development emulator, not a production
Cloudflare deployment. For shared access, deploy the pinned upstream to your own
Cloudflare Pages project with new D1, R2 and KV resources and its upstream migrations.
Follow that revision's deployment documentation; do not reuse resource IDs from the
upstream example. Configure a private JWT secret and required provider secrets in
Cloudflare, provision your staff administrator, and use HTTPS. Do not seed public
demo users. Keep source availability and license notices on the hosted portal.

Save the deployed HTTPS origin in the launcher on each device (or build with
`VITE_PATHFINDER_URL`). A Git push alone does not deploy Pathfinder. The separate
service deliberately keeps facility permissions and data independent of Supabase.

## Source and license

Upstream: https://github.com/melonmelonz/pathfinder

Pinned revision: `d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a`

Pathfinder is AGPL-3.0-or-later. Its upstream copyright and license remain intact.
The image contains its full source, and serves the exact upstream source archive at
`/pathfinder-upstream-source.tar.gz` and license at `/pathfinder-license.txt`. The
launcher links that archive and the public integration source. Local configuration
and startup scripts are in `integrations/pathfinder`; they do not replace upstream
engines. Archives contain tracked upstream source only, never runtime data or secrets.
If you modify or redistribute Pathfinder, follow its license's corresponding-source
and notice requirements, including for network users. This integration does not
relicense the upstream application.

## Integration verification

The pinned upstream passed Svelte checks and 331 unit tests. Its browser suite had
62 passes and one login-hydration timeout; the affected four-test scan group passed
on rerun. A clean local companion instance passed generated-admin login, dashboard,
source-download and restart/account-preservation smoke checks. The merged Compose
configuration validates. A clean Docker image build could not complete in the
integration workspace because its Docker network could not reach Debian package
repositories; the image build itself is not claimed as verified here.

Campus Explorer validation: build and lint passed; 49 unit/database tests and 100
browser tests passed. The two optional real-LifeRouter browser tests also passed
separately against the running Go bridge on desktop and mobile.
