# LifeRouter integration

The standalone explorer can now use **LifeRouter v1.0.0** for click-to-walk routes,
room approaches and stairs. Choose **Routing engine → LifeRouter (simulation)**
in the map controls. Local routing remains the default and works without a server.
If LifeRouter fails, the character stays put and the app shows an error; it does
not silently substitute a local route.

## Run the complete app

From the repository root with Docker and Docker Compose installed:

```sh
docker compose -f compose.liferouter.yaml up --build -d
```

Open **http://localhost:8080**. This starts the web app and the Go routing service
on the same origin. Stop them with:

```sh
docker compose -f compose.liferouter.yaml down
```

The web port binds only to localhost. For internet hosting, put the web container
behind your HTTPS reverse proxy. The router and its embedded NATS server do not
need publicly exposed ports. This is independent of the original RADAR repository.

## Develop without Docker

Requires Node 24 and Go 1.25.3 or newer. First terminal, repository root:

```sh
npm ci
node experiments/liferouter/export-campus.mjs --demo
cd services/liferouter
go run .
```

Second terminal, repository root:

```sh
npm run dev
```

Vite forwards `/api/liferouter/*` to `127.0.0.1:8091`. The service defaults to
loopback; `LISTEN_ADDR` and `CAMPUS_GRID_DIR` override its address and grid directory.
The production static preview does not proxy the service; use the Docker stack
for a production-build check.

## Existing Vercel site

A static Vercel deployment cannot run this persistent Go/NATS process. Deploy the
router on a container host first, then add a same-origin proxy/rewrite for
`/api/liferouter/:path*` to that service **before** any SPA fallback. Keep the current
Supabase configuration for accounts. The LifeRouter bridge does not require a
Supabase secret or service-role key. Until the backend is hosted and connected,
the deployed app can still use Local routing and will report LifeRouter as unavailable.
No public backend has been provisioned by this code change.

## API and implementation

- `GET /api/liferouter/health`: engine name, pinned commit, simulation flag.
- `POST /api/liferouter/route`: JSON `{start: {scene, x, y}, goal: {scene, x, y}}`.
  Coordinates are original illustration pixels, **not latitude/longitude**.
- Success: `{engine: "LifeRouter", commit, simulation: true, points: [{scene,x,y},…]}`.
- `400`: invalid or blocked endpoint; `422`: engine cannot finish the route;
  `429`: service is busy. Requests are bounded to 4 KB and 10 seconds.

The bridge embeds the actual upstream engine and a private, loopback NATS server.
A readiness round trip avoids upstream's subscription-startup race. An in-memory
adapter supplies scene regions and temporary simulated agent positions. The public
LifeRouter agent API computes the route and publishes each movement step; those
ordered steps become the returned path. This is not a renamed browser A* algorithm.
Jobs are serialized to bound resource use. Reverse-proxy rate limiting is included.
Requests do not contain student IDs, account tokens or GPS positions, and temporary
positions are deleted after each request. This service has no student database.

The API supports portal routes across scenes. The browser deliberately follows
its existing entrance/stair flow and requests one scene segment at a time, preserving
room selection and arrival callbacks. It validates every returned segment against
its collision geometry and rejects unexpected cross-scene steps. Changing scenes,
manual movement, opening a room, or changing engines cancels pending requests.

## Geometry and limits

The twelve PNG masks and ten portals are generated from `campus-data.ts` by
`experiments/liferouter/export-campus.mjs --demo`. Regenerate and rebuild the service
when map geometry changes. Each cell covers four source pixels. The 0.05 m/pixel
scale and layer heights are fictional adapter units, not surveyed campus measurements.
Building 6's two floors connect to each other but have no invented campus entrance.
Near a blocked cell boundary, LifeRouter may reject a click that the finer local
mask accepts; choose a point farther inside the open area.

This integration is for **simulation**, not a verified evacuation plan. It does not
add live hazard ingestion, crowd avoidance, accessible-route restrictions, emergency
flow fields, or approved exits. Before real emergency navigation, supply surveyed
geometry, verified exits and operational review. GPS mode never calls this API. Enabling GPS or manual location correction switches
to Local routing and disables LifeRouter for the rest of the mounted session.

## Verify

```sh
cd services/liferouter
go test -race ./...
cd ../..
npm run lint
npm test
npm run build
# Start the bridge in another terminal first:
LIFEROUTER_TEST_URL=http://127.0.0.1:8091 npm run test:e2e -- tests/browser/liferouter.spec.ts
```

The Go tests exercise actual same-floor, stair and campus portal paths, blocked
endpoints, disconnected buildings, request validation, busy responses and cancellation.
The browser tests cover visible failures, cancellation, and the real engine moving
the character outdoors and to a second-floor classroom. Other existing browser tests
continue to run without the optional backend. Dependency attribution is in
`services/liferouter/NOTICE.md`.

Implementation checks (2026-11-03): lint, production build, 31 Node tests,
70 existing browser tests, 8 LifeRouter browser tests (desktop and mobile),
and Go integration tests with the race detector passed. The Docker runtime was
smoke-tested with locally compiled artifacts, including a route to B-201 through
Nginx. A clean multi-stage Docker build could not finish in the cloud workspace
because its outbound proxy certificate was not trusted inside build containers;
TLS verification was not disabled.
