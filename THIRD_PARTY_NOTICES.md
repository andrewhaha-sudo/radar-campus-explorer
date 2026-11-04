# Pathfinder integration

This web application incorporates the Pathfinder 2D annotation engine from
https://github.com/melonmelonz/pathfinder, revision
`d07b3fcf96c3dd04f9ffc5e59120a61d93e99e5a`, under **AGPL-3.0-or-later**.
The combined web application is provided under AGPL-3.0-or-later. See LICENSE.
Existing third-party dependencies and artwork retain their respective notices
and rights; see package metadata and public/maps/README.md for asset provenance.

Ported source files under `src/vendor/pathfinder/`:

- types.ts: annotation model and safety-marker metadata
- coords.ts: normalized page coordinates
- hittest.ts: selection geometry
- render.ts: canvas rendering
- undo.ts: snapshot-based history
- export-json.ts: Pathfinder JSON envelope and import/export

The upstream comments and license are preserved. Local changes add explicit
`.ts` imports so the modules also run in the Node.js test suite. The React editor,
per-floor registration, browser persistence, validation and integration wrappers
are local additions. The complete upstream Svelte UI, Cloudflare backend, auth and 3D viewer are
now included under `apps/pathfinder`, with its LICENSE, tests and migrations.
Local brand, navigation, deployment configuration and campus bridge additions
are described in `apps/pathfinder/UPSTREAM.md`.

The editor links to `/source/radar-campus-explorer.tar.gz`, generated from the
current web source by `scripts/package-source.mjs` during `npm run build`.
This includes the source, build scripts, dependency lockfile, tests, documentation
and available static assets. It excludes environment files, Git metadata and
installed/generated dependency caches. Keep this download available when hosting
the combined app. Rebuild it when making changes. No GitHub connection or account
is required to obtain the offered source.

## Indoor Map

Evangelisches-Schulzentrum-Leipzig/indoor-map, revision 8b921c37642da24ba52a5ec857f6026543e583ae, OSL-3.0. Original source and notices are retained in apps/indoor-map/upstream. RADAR adapters are marked in apps/indoor-map/UPSTREAM.md. MapLibre dependencies retain their own license notices.
