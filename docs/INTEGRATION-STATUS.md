# Combined RADAR application

The latest main-branch preparedness and LifeRouter work is merged with the full
Pathfinder platform and Indoor Map. Existing Android, student accounts, GPS,
photos, learning activities, school services and community features are retained.

| Capability | Main implementation |
| --- | --- |
| Campus exploration, characters, room photos and private GPS | Existing React campus at /campus/ |
| Learning, children, notices, drills, reports, records and community | Existing Resources suite inside the campus |
| Nearby outdoor services and school map notices | Existing Leaflet facilities map |
| Indoor room search and 2D/3D floor views | Indoor Map at /indoor-map/ |
| Device floorplan drafts | React editor using the canonical Pathfinder engine |
| Shared floorplans, review, annotations, media and 3D scans | Full Pathfinder workspace at /campus-workspace |
| Optional simulation routing | Existing LifeRouter service through a same-origin proxy |
| School staff permissions | Existing Supabase staff grants |
| Facilities document permissions | Existing Pathfinder staff roles |

## Consolidated overlap

Both floorplan editors now use one annotation model, coordinate conversion,
renderer, hit testing, undo/redo and JSON implementation. The compatibility
modules contain exports only. Device drafts and shared documents remain separate
storage workflows; publishing creates a new shared document. No document edits
or student data are migrated or deleted by the merge.

Indoor Map reuses existing campus room and pathfinding data rather than seeding
a second campus. The outdoor facilities map remains because it serves a different
purpose. The redundant Facilities dashboard shortcut was removed from the campus
footer; the shared-workspace link still opens Facilities tools.

## Activation boundaries

Local exploration and learning work without live accounts. Shared school services
still need the Supabase migration and role grants in RESQVERSE.md. Shared Facilities
uses Cloudflare D1/R2/KV and its own staff session. Simulation routing requires the
existing Go service plus LIFEROUTER_ORIGIN; local pathfinding remains the default.
No cloud deployment, payment, live emergency feed or provider activation is
performed by this merge. Paths and synthetic scan fixtures are not surveyed
emergency guidance. See PATHFINDER-PLATFORM.md and LIFEROUTER.md for operation.

The later companion-portal commit is also retained. Its Resources tab now opens
the built-in shared workspace; saved external portals remain under compatibility
details. The optional companion Docker service builds the same canonical code,
preserves its existing volume and resource IDs, and uses private bootstrap rather
than demo accounts. See PATHFINDER-COMPANION.md.
