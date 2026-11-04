# Pathfinder floorplan base

Open **Edit floorplan** beside the map's zoom controls. Choose a building and
floor. Each floor uses its existing source artwork and crop, preserving all
room IDs, stair connections and walking routes.

Place exits, extinguishers, AEDs, stairs, doors, overhead-hazard markers and notes
by choosing a tool and tapping the drawing. Drag for areas, circles and arrows.
Select an annotation from the list to edit its note or percentage position, or
delete it. Undo/redo supports additions, edits, deletions and imported replacements.
For keyboard placement, focus the drawing, use arrow keys and press Enter.

Annotations save locally on this browser/device, independently per floor. They
are shown over the corresponding indoor exploration scene. They are not uploaded
to student accounts or a shared school database. Storage failures are displayed;
export before closing if changes are only in memory. No safety resources are
invented or seeded. A marker is a draft note, not a verified inspection finding
or an evacuation route constraint.

**Export floor JSON** downloads a Pathfinder-format annotation envelope with
RADAR floor/source registration metadata. **Import floor JSON** accepts these
RADAR exports only for the matching floor and drawing. It validates the whole
file before replacement and rejects mismatched floors, changed source geometry,
invalid coordinates, unknown tools, duplicate IDs and excessive data. Import
replaces the current floor's annotations; Undo restores the prior draft. Raw
standalone Pathfinder exports require an explicit registration step and are not
silently attached to a campus floor. Raster/PDF replacement and 3D registration
are not part of this integration.

Coordinates are normalized relative to the displayed floor crop. Rendering maps
them back to scene coordinates using the crop origin; synthesized interiors use
the same artwork-piece placements as the explorer. A label such as Floor 2 does
not determine identity: the stable scene ID does.

The bundled source uses Pathfinder's actual rendering, coordinate, hit-test,
history and JSON modules. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
The combined web application is AGPL-3.0-or-later. The editor has license,
attribution and downloadable corresponding-source links. `npm run build` creates
the source archive automatically; run `npm run source:bundle` before starting the
development server if that archive is absent.

Validation: `npm test`, `npm run lint`, `npm run build`, and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.
The tests cover crop registration, malformed import rejection, persistence,
floor isolation, keyboard/pointer editing, exports and storage failures.

## Complete shared platform

The full Pathfinder application is now included in `apps/pathfinder`. Use
**Open Facilities workspace** to access the authenticated server-backed tools.
**Publish new shared draft** creates a separate document using the registered
floor PDF; it preserves existing shared annotations. See
[the complete platform guide](PATHFINDER-PLATFORM.md).
