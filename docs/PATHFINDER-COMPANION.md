# Optional Pathfinder companion deployment

The main platform already includes Pathfinder at `/campus-workspace`. This
optional Docker service runs the same canonical source from this repository,
with a private initial administrator and persistent facility storage. It no
longer downloads a separate upstream copy. Existing companion volume names,
Cloudflare binding IDs and private bootstrap files are preserved.

```bash
docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml up --build -d
```

The campus simulation runs at http://localhost:8080; the complete platform runs
at http://localhost:8082. In this combined Compose configuration, Resources >
Pathfinder opens the companion address. Override the public build setting
`VITE_PATHFINDER_URL` for a different portal origin. In the regular root build,
Resources opens the built-in workspace. A previously saved external address
remains available in compatibility details without copying student data.

## Private bootstrap and existing records

The first empty companion database receives a randomly generated administrator
and JWT secret. It never seeds public demo accounts. Existing users and passwords
are not reset. View the initial credentials locally with:

```bash
docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml exec pathfinder node /opt/radar-pathfinder/show-admin.mjs
```

Keep these credentials private. This command shows the initial password; use
your changed password if you subsequently change it. Supabase student passwords
are separate from Facilities staff accounts.

The existing `pathfinder-data` volume retains D1, R2, KV, signing secret and initial
credentials. Rebuilding the container keeps it. Do not use `down -v` when retaining
facility records. Stop the service and back up the full volume before moving it.
The additive campus registration preserves existing document edits and source
files. Original school images are illustrations, not verified surveys.

The container serves campus exploration, Indoor Map and the full shared facility
workspace from one origin. The separate Go service is still optional. For routing
inside the companion container, Compose configures its internal `router:8091`
service. Other deployments can use HTTPS or a loopback development service. Local pathfinding remains
the default. No provider accounts, email, AI or live emergency feeds are activated.

## Source and operation

The complete licensed source is available at
`/source/radar-campus-explorer.tar.gz`. The old download path
`/pathfinder-upstream-source.tar.gz` remains an alias to this complete source.
Pathfinder's original revision and attribution are in `apps/pathfinder/UPSTREAM.md`.

```bash
docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml ps
docker compose -f compose.liferouter.yaml -f compose.pathfinder.yaml logs --tail=100 pathfinder
```

The main Cloudflare deployment remains independent of this local companion.
See [platform setup](PATHFINDER-PLATFORM.md), [device drafts](PATHFINDER.md), and
[LifeRouter](LIFEROUTER.md) for the other supported workflows.
