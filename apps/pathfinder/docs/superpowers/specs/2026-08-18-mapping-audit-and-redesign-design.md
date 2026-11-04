# Mapping / PDF / Annotator - Audit and Redesign

Date: 2026-08-18
Status: DRAFT - awaiting approval. Nothing implemented.
Scope: `src/lib/engines/map-export/`, `src/lib/engines/2d-annotate/`, `migrations/`,
       facility / building / document routes. Cross-references v1 `els911-portal`.

---

## 0. Decisions taken

| # | Question | Decision |
|---|---|---|
| Q1 | Which repo? | pathfinder (v2) for all redesign. v1 gets hotfix H1 only. |
| Q2 | Stairwell across floors - one label or three? | Count up by default; shaft linking available. Overridable per building (see 6.2). |
| Q3 | Output model? | One skeleton, appearance is data. The 3 styles become seeded presets. |
| Q4 | Is v1 still delivering? | Assume yes. H1 is urgent. |
| Q5 | Editions | **No CE/Pro split. Every feature is full-fat.** `AGENTS.md` and `docs/06-editions-and-integrations.md` are now stale and must be updated as part of this work. |
| Q6 | Label stability | **Freeze on export.** Exporting commits the current assignment; later additions take the next free number. |

Driving example, from the field: **Rock L. Butler school**. Three floor plans, in three
separate PDFs, named `0`, `main`, `3`. `0` is a basement, `main` is the first floor, `3` is
the top. Hallway 1 belongs in the basement. Facilities are re-surveyed often, so the same
floor of the same facility exists in many versions over time.

Every design decision below is checked against that example.

---

## 1. Why this document exists

Reported problems:

1. Hallway and stairway labels duplicate across floors instead of continuing upward.
2. Floors of one building live in separate PDFs with no way to combine them.
3. The map output is three fixed generic styles; it should be highly customizable while
   still producing a consistent document.
4. Changing a hallway number must be trivial.
5. Redos are constant. The same floor of the same facility has many versions.

(1) and (2) are the same defect: marker numbering is scoped to a single document, and floors
are separate documents. (5) is the constraint that determines the whole data model.

---

## 2. Audit findings

### 2.1 Repo lineage

`pathfinder` (v2) is current. `els911-portal` (v1) is the ancestor; v2 declares it in source
(`2d-annotate/types.ts:3`, `map-export/markers.ts:4`, `map-export/layout.ts:94` cites v1
line numbers).

The port is **partial and has diverged**:

- v1 has the richer map UI: label search (`viewer.js:4268-4330`), a marker list panel
  (`viewer.js:3148-3177`), hallway polygon rendering with fills and label pills
  (`viewer.js:3632-3705`), per-style per-type icon art, draggable label pills, shift-click
  extra label pins.
- v2 has the tests, migrations, the org/district/facility/building hierarchy, a toast
  system, Pointer Events (so touch works), and a delete confirmation.
- v2's `alignExtraLabels` (`layout.ts:99-111`), `snap90` (`markers.ts:98`) and `pointInPoly`
  (`markers.ts:107`) are exported but referenced only by tests. Not wired into the app.
- v2 round-trips `labelNx`/`labelNy` through save and load but **nothing writes them and
  `renderMap` ignores them** (`+page.svelte:201` always draws at `m.nx/m.ny`).
- v2's legend computes per-type cell sizes (`legend.ts:50-68`) then draws **every chip as a
  circle** (`export-pdf.ts:198`). The table is dead weight.
- Palettes drifted. `HALLWAY_COLORS` share only their first entry (v1 `viewer.js:2219-2228`
  vs v2 `markers.ts:26-35`). Command navy, Sage gold and Alert orange all differ. Orientation
  tie-break differs (`>` vs `>=`), so a square page flips between the two.

### 2.2 Two marker systems, not one

`annotations` (review layer, 12 types incl. aed/exit/fireext) and `map_markers` (wayfinding
layer, 5 types) are separate tables, type lists, renderers and label schemes.

**Only `map_markers` is numbered.** An AED annotation's badge is the literal string `AED` for
every instance. There is no numbered AED/exit/extinguisher marker in either repo.

`MAP_TYPES` (v1 `viewer.js:2210-2216`, v2 `markers.ts:17-23`) is hardcoded. Adding a type
means editing the object, a D1 CHECK constraint, the chip renderer, the PDF pin renderer,
the legend cell-size table, and the toolbar. No registry.

### 2.3 Numbering - the core defect

```js
// v1 viewer.js:2236-2255, v2 markers.ts:74-95 (functionally identical)
function reNumberMarkers() {
  for (const [type, info] of Object.entries(MAP_TYPES)) {
    const markers = state.mapMarkers
      .filter(m => m.type === type)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let counter = 0;
    for (const m of markers) {
      if (m.labelPinned) continue;          // <-- fires BEFORE counter++
      m.label = type === 'door'
        ? String.fromCharCode(65 + counter)
        : `${info.prefix}${counter + 1}`;
      counter++;
    }
  }
}
```

- **D1 - scope.** `state.mapMarkers` is one document. Separate-PDF-per-floor collides silently.
  This is Rock L. Butler exactly: three PDFs, three independent H1s.
- **D2 - sort regression.** Commit `8a36808` sorted `(a.page - b.page) || createdAt`.
  Commit `484b474` dropped the page term while adding `labelPinned`. Now: annotate floor 1
  (H1,H2), floor 2 (H3,H4), return to floor 1 and add one - it becomes **H5, on floor 1**.
- **D3 - pinned labels generate duplicates.** `continue` precedes `counter++`, so a pinned
  label does not reserve its number. Place S1,S2,S3; hand-rename S2; renumber yields
  S1, [pinned S2], **S2**. The legend de-dupes (`viewer.js:3416`), so the map prints two S2
  pins and one S2 legend row. v2 asserts this as intended in
  `tests/unit/map-engine.test.ts:63-71` - that test encodes the bug and must be rewritten.
- **D4 - no stairwell continuity.** No concept of a shaft spanning floors. Floors 1-3 of one
  stairwell become S1, S4, S7.

Renumbering runs on load (`viewer.js:109`), so the persisted `label` column is a cache.

### 2.4 Data model - there is no floor, and no version lineage

No `floor` column on `documents`. The convention is **page == floor**, explicit in
`src/lib/server/compliance.ts:78` (`SELECT mm.page AS floor`), `layout.ts:145-147`, and
`scripts/seed-hierarchy.mjs:129` (floor encoded only in the filename, `pageCount = 1`).

`buildings.floors` (`0003:57`) is an unreferenced integer count.
`compliance_meta.floor_labels` (`0008:18`) is a facility-scoped write-only JSON blob.

Ownership is `documents -> projects -> buildings -> facilities -> orgs`
(`documents.ts:77-84`). **Documents attach to a project, not a building.**

No grouping or ordering primitive exists at the document level. `map_crops.print_order` is
keyed `(doc_id, page)`; `orderPages` takes `Record<number, Crop>` keyed by page only
(`layout.ts:29-33`), so two documents collide on page 1. Building documents list as
`ORDER BY d.uploaded_at DESC` (`documents.ts:136-141`).

`documents.version INTEGER DEFAULT 1` exists (`0004:20`) but nothing increments it and no
lineage links a v2 document to the v1 it replaces. `project_versions` / `project_approvals`
(`0011`) version the *project record*, not the floor plan. **There is no way to say "this
PDF replaces that PDF for the same floor."**

Coordinates are normalized `[0,1]` against **each PDF page's own render canvas**
(`2d-annotate/coords.ts:11-56`, scale 2.0). No origin, scale, rotation or transform exists.
`nx=0.5` on two floors is not the same physical point. No DXF/CAD ingest.

### 2.5 Output pipeline

100% client-side. jsPDF (v1 CDN 2.5.1, v2 npm `^2.5.2`) + PDF.js `3.11.174`, dynamically
imported in v2 to stay out of the SSR bundle. `buildMapPdf` takes an injected `mkDoc`
factory (`export-pdf.ts:109`) so the engine stays Node-testable.

The Worker does no PDF work; `/api/export-jobs` is a queue only. This is forced: Workers
have no DOM or canvas, so PDF.js rasterization cannot run server-side, and Worker CPU limits
rule out multi-page rendering in-request. Server-side rendering would need a browser service
- a new dependency.

Source PDFs are **rasterized, not embedded**: PDF.js renders at `RENDER_SCALE = 2.0`, crops
to a second canvas, emits `toDataURL('image/jpeg', 0.97)`, placed via `addImage`. Vector
fidelity is lost. No `pdf-lib` dependency, so page-level PDF copying is not possible today.

Defensive handling worth preserving: `willReadFrequently: true` because GPU-backed canvas
`toDataURL()` returns garbled pixels on some Linux/GPU setups (`viewer.js:3358-3360`);
try/catch with user-facing remediation for Brave/Firefox fingerprint blocking of canvas
readback (`viewer.js:3380-3392`); white-fill before render to stop grid bleed.

Page geometry is derived from the crop, not a paper size:

```
pageW_mm = cropW_px * (25.4/72) / RENDER_SCALE
pageH_mm = HDR_MM(36) + cropH_mm + legH_mm + footerH_mm(8)
```

The floor plan bleeds edge to edge; `PAD = 10mm` insets legend and footer text only.

**Neither repo has a scale bar.** v1 has no north arrow; v2 has one at a fixed corner
assuming north is up. No revision block, no key plan, no notes field. Marker icons are
bespoke line art, not NFPA 170 glyphs - worth noting against `AC-6.1.1`, which claims the
standardized symbol is rendered.

### 2.6 The three styles

Keys `command` / `blueprint` / `field`; displayed Command / Sage / Alert. `blueprint` is a
legacy key - nothing about it is blue. Hardcoded, never persisted, passed as a transient
string.

In v1 the style key branches in **five independent places**, each with separate hand-drawn
vector art: header band, marker geometry, legend cell sizes, legend chip rendering, and
footer - including different footer *copy* per style. The `PRINT_STYLES` object is only a
colour bag and is consulted for 3 of those 5; headers, footers and markers re-hardcode the
same RGB literals inline. ~50+ inline literal colour triples across `viewer.js:3496-4216`,
plus 13 duplicated in the style-card HTML.

That five-way branching is why the three outputs read as three unrelated products rather
than one map with a skin. It is the thing to eliminate.

**`map-export/` never imports `src/lib/brand/`.** Verified across all five files. Yet
`brand/profiles/els911.ts` primary `#B22234` is byte-identical to v1's Command accent and
secondary `#002868` to v2's Command header. The Command style already *is* the brand,
copy-pasted as literals.

### 2.7 Legend

One row per marker *type* on the page; one chip per unique label, numeric-aware sorted.
Caption `N on floor - M total`. Autofit is three nested mechanisms: per (style,type) cell
size, wrap-and-row-height, then total legend height fed back into page height **before**
`new jsPDF(...)`. The page grows; the legend never truncates.

Failure mode: `LEG_ICON_W` is a hardcoded 105mm and `NAME_X` sits near 123mm. A tall/narrow
plan easily yields `pageW_mm < 150`, at which point the type name and right-aligned count
collide or run off the page. Nothing clamps `LEG_ICON_W` against `pageW_mm`.

### 2.8 Relabeling is the worst part of the current UX

Measured against "make it dummy easy", today's flow is close to worst case:

| | v1 | v2 |
|---|---|---|
| Gestures to rename | 3 (click to select, then dbl-click on target) | 2 (dbl-click) |
| Editor | inline `position:fixed` input, **not repositioned on scroll/zoom** | blocking `window.prompt` |
| Rename **hallways** | **impossible** - hard `return` at `viewer.js:2996` | allowed, but a non-numeric label silently breaks colour keying (`markers.ts:53`) |
| Clear back to auto-number | impossible (`if (val && ...)` guard, `viewer.js:3024`) | commits a **pinned empty label**; chip renders blank forever |
| Length limits | 24 rooms / 6 others, silent truncation | none |
| Validation / duplicate detection | none | none |
| Feedback on rename | none | none |
| Rename from a list | list exists but click only selects | no list at all |
| Keyboard rename (F2 etc.) | none | none |
| Batch or sequential renumber | none | none |
| Multi-select | none | none |
| Find marker by name | Ctrl+F | **nothing** |
| Touch support on map layer | **none** - mouse events only | works (Pointer Events) |

Two persistence defects sit underneath this:

- v1 autosaves on an 800ms debounce but `_flushMapSave` swallows errors
  (`viewer.js:3242`) with no UI feedback, and the unload guard (`viewer.js:4460-4466`)
  checks `state.isDirty` (annotations) and **not `state.mapDirty`**. Closing the tab inside
  the debounce window loses the rename silently.
- v2 has **no autosave and no `beforeunload` handler anywhere in `src/`**. Renaming 30
  markers and navigating away loses all 30 with no warning.

Undo differs too: v1 only pushes a drag snapshot if the marker actually moved
(`viewer.js:2918-2931`); v2 pushes on every mousedown that hits a marker
(`+page.svelte:678`), so **50 stray clicks silently flush the entire undo history**.

### 2.9 Defect register

| ID | Severity | Where | Defect |
|---|---|---|---|
| H1 | **Data loss** | v1 `schema.sql:162` | CHECK omits `'room'` but the room tool shipped in `a882593`. Markers save as one `DB.batch()`, so one room marker **rolls back every stair, hallway and door in that session**. |
| H2 | **Data loss** | v2 `+page.svelte` | No autosave, no `beforeunload`. Navigating away loses every unsaved marker edit. |
| H3 | High | v2 `export-client.ts:18-42` | Batch export hardcodes `getPage(1)` and filters `m.page === 1`. A 3-floor plan batch-exports as one floor. **`AC-6.4.1` claims correct multi-page output; its E2E only asserts the job record exists.** |
| H4 | High | both | Pinned labels do not reserve their number; duplicates result (D3). |
| H5 | High | both | Page term dropped from sort; labels non-monotonic per floor (D2). |
| M1 | Medium | v1 `viewer.js:3242,4460` | Save errors swallowed; unload guard checks the wrong dirty flag. |
| M2 | Medium | v2 `export-client.ts:39-58` | Fetch/parse failure degrades silently to a blank canvas - a legend over an empty page instead of an error. |
| M3 | Medium | both `legend.ts` | `LEG_ICON_W` 105mm unclamped; legend overruns narrow pages. |
| M4 | Medium | v2 `export-pdf.ts:198` | All legend chips drawn as circles; `legCellSize` dead. |
| M5 | Medium | v2 | Hallway polygons, fills and label pills never ported; hallway markers export as plain pins. |
| M6 | Medium | v2 `+page.svelte:678` | Undo slot burned on every select; history flushed by ordinary clicking. |
| M7 | Medium | v2 `+page.svelte:792` | Empty string commits as a pinned label; marker permanently unlabelled. |
| M8 | Medium | v1 `viewer.js:2996` | Hallways cannot be relabelled at all. |
| L1 | Low | v2 `layout.ts:99`, `markers.ts:98,107` | `alignExtraLabels`, `snap90`, `pointInPoly` exported but unused by the app. |
| L2 | Low | v1 `viewer.js:2549` | Hallway preview colour uses per-page count, commits with document-wide count. |
| L3 | Low | v1 `viewer.js:3320,3428` | `LEG_ROW`, `LEG_PAD`, `LEG_R_CALC`, `LEG_R` dead. |
| L4 | Low | both | ~15 constants duplicated across files; `HALLWAY_COLORS`, style palettes and orientation tie-break have already drifted. |

---

## 3. Design - the floor stack

### 3.1 The floor is the unit, and the PDF is a swappable backdrop

The redo cycle decides the model. If markers hang off a document, every re-survey throws
away the annotation work. So:

**Markers belong to the floor. A floor plan version is the image underneath them.**

```
facility               "Rock L. Butler"
  +- building          "Main"   (auto-created; invisible for single-building sites)
       +- floor  sort=1  label="0"      level=-1
       |    +- version 1  doc A p1        superseded
       |    +- version 2  doc D p1        CURRENT
       +- floor  sort=2  label="Main"   level=0
       +- floor  sort=3  label="3"      level=3
markers -> floor_id
```

Three properties, each earning its place against Rock L. Butler:

- **`label` is free text, decoupled from position.** `0`, `Main`, `3` are stored verbatim.
  Nothing derives a label from a number, and `Floor N of M` becomes a fallback used only
  when a floor is unlabelled.
- **`sort_order` is the single ordering truth**, set by dragging floors in a list. Numbering
  walks it bottom-up, so Hallway 1 lands in the basement because the basement is first in
  the stack - not because anything parsed "0" or a filename.
- **`level` is optional integer metadata** for NG911 / compliance z-axis output
  (`AC-6.5.1`). It never drives ordering, so a site with `LL`, `G`, `M`, `1`, `1A` needs no
  invented numbering.

This also unifies both real-world layouts under one model: floors that are pages of a single
multi-page PDF, and floors that are separate PDFs. Both are floor stacks. A floor's version
points at a `(document, page)` pair, so a 3-page PDF yields three floors sharing one document.

### 3.2 Rejected alternatives

- *Add `floor` and `building_id` columns to `documents`.* Breaks the still-valid case of one
  multi-page PDF containing several floors, and gives versioning nowhere to live.
- *Keep markers on `(doc_id, page)` and group documents.* Simpler migration, but every redo
  orphans the markers - which is the single most expensive thing about the current workflow.
- *Physically merge source PDFs.* Needs a `pdf-lib` dependency that does not exist, forces
  rewriting every child row's page number, and destroys the `annotations.document_id` FK.
  The exporter rasterizes to JPEG anyway, so there is nothing to gain.
- *Attach the stack to the facility rather than the building.* A school is a facility that
  can have a main building plus a gym annex, each with its own floors; "floor 2" of the annex
  is not "floor 2" of the main building. The stack belongs to a building. To keep this
  invisible for the common single-building case, uploading floors to a facility that has no
  building auto-creates one named "Main", and the UI says "Rock L. Butler" until a second
  building exists.

### 3.3 Proposed migration `0014_floor_stacks.sql`

```sql
-- 0014: Floor stacks and floor plan versions (Epic E15)
-- Plain SQL only: D1 rejects PRAGMA journal_mode=WAL. ASCII only.

CREATE TABLE IF NOT EXISTS floors (
  id           TEXT PRIMARY KEY,
  building_id  TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,           -- "0", "Main", "3" - verbatim, arbitrary
  level        INTEGER,                 -- optional; compliance z-axis only, never ordering
  sort_order   INTEGER NOT NULL,        -- the ONLY ordering truth; bottom of stack first
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id, sort_order);

CREATE TABLE IF NOT EXISTS floor_plan_versions (
  id              TEXT PRIMARY KEY,
  floor_id        TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  doc_id          TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page            INTEGER NOT NULL DEFAULT 1,
  version         INTEGER NOT NULL,     -- 1, 2, 3 ... per floor
  is_current      INTEGER NOT NULL DEFAULT 0,
  note            TEXT,                 -- "post-2026 renovation"
  marker_snapshot TEXT,                 -- JSON marker set captured when superseded
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fpv_floor_version ON floor_plan_versions(floor_id, version);
CREATE INDEX IF NOT EXISTS idx_fpv_current ON floor_plan_versions(floor_id, is_current);

CREATE TABLE IF NOT EXISTS shafts (
  id           TEXT PRIMARY KEY,
  building_id  TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('stairs','elevator')),
  label        TEXT,
  label_pinned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shafts_building ON shafts(building_id);

ALTER TABLE map_markers ADD COLUMN floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE;
ALTER TABLE map_markers ADD COLUMN shaft_id TEXT REFERENCES shafts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_map_markers_floor ON map_markers(floor_id);
```

Backfill: for every distinct `(doc_id, page)` that has markers or a crop, create a `floors`
row (label from `map_crops.label` if set, else `Floor {page}`; `sort_order` = page) plus a
`floor_plan_versions` row at `version = 1, is_current = 1`, then set `map_markers.floor_id`.
`doc_id` and `page` stay on `map_markers` as legacy columns for one release so a rollback
is possible; a later migration drops them.

### 3.4 What happens on a redo

Uploading a new plan for an existing floor:

1. The current version's marker set is serialized into `marker_snapshot` on that version row.
2. A new `floor_plan_versions` row is inserted, `version = max+1`, `is_current = 1`; the old
   row's `is_current` clears.
3. **Markers are not touched.** They belong to the floor.
4. `floors.needs_review = 1`, surfacing a "Plan updated - verify marker positions" banner
   and a per-marker review state, cleared per floor by an explicit "positions verified".
5. The version list offers "compare to previous" (old plan ghosted under the current one, so
   drift is visible) and "restore markers from this version" (rehydrate `marker_snapshot`).

Marker positions are normalized to the page, so a redo at a different crop or scale shifts
them. Nothing in the model can auto-correct that - there is no transform between plans (2.4)
- so the honest behaviour is to carry markers forward and flag the floor, never to silently
claim they are still right. An optional two-point realignment (click the same two reference
features on old and new plans, derive scale + offset, apply to all markers on that floor) is
a strong candidate but is deferred; it is the only piece here that needs real geometry.

### 3.5 Numbering algorithm

Replaces `reNumberMarkers` in `map-export/markers.ts`. Signature changes from a flat array to
`(markers, floorOrder, options)`.

```
1. Resolve scope from the building setting: 'facility' | 'building' (default) | 'floor'.
2. Order floors by floors.sort_order ascending (bottom of the stack first).
3. Sort markers by (floorIndex, createdAt).                  [fixes D2, and puts H1 in the
                                                              basement for Rock L. Butler]
4. Per type, two passes:
     pass 1 - collect every pinned label into a taken-set
     pass 2 - assign each unpinned marker the next label NOT in the taken-set,
              adding each assignment to the taken-set        [fixes D3 - no duplicates,
                                                              ever, by construction]
5. Shafts: a marker with shaft_id renders its shaft's label. The shaft is numbered once,
   at its lowest floor; its other markers consume no numbers.
6. Frozen labels (6.1) are treated exactly like pinned labels in pass 1.
```

Numbering becomes floor-major. Floor `0` = H1-H4, `Main` = H5-H8, `3` = H9-H12.

### 3.6 Code touchpoints

| File | Change |
|---|---|
| `map-export/markers.ts:74` | `reNumberMarkers` takes floor order + scope; two-pass reservation |
| `map-export/layout.ts:29` | `orderPages` re-keyed from `page` to `floorId` |
| `map-export/export-pdf.ts:112` | `crops: Record<number,Crop>` re-keyed to `floorId` |
| `map-export/export-client.ts:18` | `renderFirstPage` becomes an N-document, N-page loop (fixes H3) |
| `map-export/layout.ts:145` | `floorLine` reads `floors.label` verbatim; `Floor N of M` only as fallback |
| `src/lib/server/floors.ts` | new - stack CRUD, versions, `resolveFloorOrder(buildingId)` |
| `src/lib/server/documents.ts:130` | building document list ordered by floor |
| `src/routes/facilities/[id]/floors/` | new - stack assembly, drag ordering, version history |
| `tests/unit/map-engine.test.ts:63` | rewrite the test that encodes D3 |

`buildMapPdf` (`export-pdf.ts:108-225`) already loops an `ExportPageInput[]` and calls
`addPage` per entry - it is **already document-agnostic**. Only its inputs change.

---

## 4. Design - relabeling that is actually easy

Four mechanisms, cheapest first. All operate on any marker type, hallways included (fixes M8).

### 4.1 Direct edit with swap-on-collision

`F2` or double-click on a selected marker opens an inline editor anchored to the marker and
**re-anchored on scroll, zoom and resize** (v1's floats away today).

- Typing a label already held by another marker **swaps** them: rename `H5` to `H2` and the
  marker holding `H2` becomes `H5`. Duplicates are unreachable through the UI.
- `Enter` commits and `Tab` commits then jumps to the next marker of the same type, so a
  whole floor can be relabelled without touching the mouse.
- An empty input **clears back to auto-numbering** (currently impossible in v1, and in v2
  pins an empty label forever - M7).
- Length limits become soft: a counter appears near the limit instead of silently truncating.

### 4.2 Resequence mode - the primary tool

The direct answer to "dummy easy". Pick a type, then click markers in the order you want
them numbered. They renumber live as you click, across floors, following the floor stack.

For Rock L. Butler: choose Hallways, start in the basement, click along the walking route,
and hallways number 1..N in exactly that order. No typing, no arithmetic, no collisions.

- A live counter badge on each marker shows its pending number.
- Unclicked markers keep their existing numbers and are shown dimmed.
- `Esc` cancels the whole sequence; commit is one action and one undo step.

### 4.3 Marker panel

A building-wide list grouped by floor in stack order, filtered by type, with:

- inline rename (same swap semantics)
- **drag to reorder within a type, which renumbers to match** - the list is the numbering
- click to select and jump to that floor
- pinned/frozen/auto state visible per row, and clearable
- duplicate and gap warnings inline

v1's panel is per-page and click-to-select only; v2 has none.

### 4.4 Bulk operations

- Renumber a whole type across the building from the current spatial order
- Offset: "start hallways on floor `3` at H20"
- Unpin all / unfreeze all on a floor
- Search by label across floors (v1's Ctrl+F, which v2 never got, extended building-wide)

### 4.5 Safety net

Relabeling is worthless if it is lost. Alongside the above: autosave with a visible saved
state, save errors surfaced as toasts rather than swallowed (M1), a `beforeunload` guard
covering marker state in both apps (H2), and undo that does not burn a slot on a plain
select (M6).

---

## 5. Design - one skeleton, everything else is data

### 5.1 Principle

"The maps should always output essentially the same aside the custom frills." Taken
literally: **layout is invariant, appearance is data.** Every current `if (style === ...)`
branch becomes a token lookup. Exactly one page skeleton, one draw path.

Per `AGENTS.md` this is an **extension of `map-export/`, not a rewrite** - v1's per-style
icon art is ported forward into token-parameterised draw functions.

### 5.2 The invariant skeleton

```
+--------------------------------------------------+
| header band                                      |  logo, facility, floor label,
|                                                  |  address, date, page n/N
+--------------------------------------------------+
| accent stripe                                    |
+--------------------------------------------------+
|                                                  |
| floor plan raster + markers + hallway polygons   |  bleeds to page edge
|                       [north arrow]  [scale bar] |
+--------------------------------------------------+
| legend - vertical list, one row per type         |  height autofits, page grows
+--------------------------------------------------+
| footer - strapline, page number                  |
+--------------------------------------------------+
```

New or restored: the scale bar (absent from both repos); a north arrow on every output with
a per-floor `north_deg`; v1's hallway polygon rendering (M5) and per-type legend chip art
(M4) ported into the single path.

The scale bar can only be drawn where a plan scale is known, so it is **conditional** on a
per-floor scale set by drawing a reference line of known length. Absent that, the existing
"not to scale" note stands.

### 5.3 Three tiers of customization

The constant inventory found roughly 400 tunable values across the two pipelines. Exposing
400 controls is not customization, it is a maze. Three tiers instead, each a strict superset
of the last:

**Tier 1 - Presets.** Pick a look. Command, Sage and Alert ship as seeded rows; any saved
theme joins the list. This is the default path and needs no decisions.

**Tier 2 - The controls people actually want.** A live-previewing panel over the real map:

| Group | Controls |
|---|---|
| Colour | accent, header background + text tiers, legend background/text/muted, plan border, divider, footer background/text |
| Per-type | colour, pin shape (`rect`/`badge`/`diamond`/`pill`/`circle`), pin size, label size, legend row order, display name, label prefix |
| Hallways | the 8-colour cycle palette, fill opacity, border width, dash pattern, label pill size |
| Typography | family, and a size for each of: facility name, floor line, address, pin label, legend header, legend type name, legend count, footer |
| Geometry | header height, footer height, page padding, legend icon column width, legend row min height, orientation rule |
| Text | every printed string - straplines, eyebrow, legend header, empty-legend message, count caption format, floor line format, page counter format, date format, filename pattern |
| Output | render scale, JPEG quality, grid on/off + pitch, north arrow on/off + position, scale bar on/off |
| Logo | brand default or uploaded asset, plus its zone width |

**Tier 3 - Full token override.** Every constant in the inventory is addressable by key. A
power panel plus JSON import/export, so a theme can be diffed, shared between facilities,
and version-controlled. Nothing in the pipeline stays unreachable.

### 5.4 The theme document

```ts
interface MapTheme {
  id: string; name: string; basedOn?: string;
  header: { bg, text, sub, tert, treatment: 'solid'|'graph-rule'|'hazard-stripe'|'none',
            heightMm, logoZoneMm, stripeMm, eyebrow?: string };
  accent: string;
  legend: { bg, text, sub, muted, border, accent, iconColWidthMm, rowMinHMm,
            rowOrder: MapMarkerType[], headerText, emptyText, countFormat };
  plan:   { border, divider, grid: {on, pitchMm, color}, north: {on, corner},
            scaleBar: {on} };
  types:  Record<MapMarkerType, { color, shape, sizeMm, labelPt, displayName, prefix }>;
  hallway:{ palette: string[], fillOpacity, borderWidthMm, dash: [number,number],
            pillWMm, pillHMm };
  type_:  { family, sizes: Record<string, number> };
  footer: { bg, text, strapline, pageFormat, heightMm };
  output: { renderScale, jpegQuality, dateFormat, filenamePattern };
  overrides: Record<string, string|number>;   // tier 3 escape hatch
}
```

`treatment` is the key move: v1's three header *compositions* - solid navy, green with a 5mm
graph-paper rule, vermillion with 45-degree hazard stripes - stop being three code paths and
become one enum. Same for the marker shape family, which v2 already proved is one parameter.

Defaults derive from `src/lib/brand/` rather than literals, closing the gap in 2.6.

### 5.5 Where a theme lives

Themes cascade, nearest wins: **org -> facility -> building -> floor -> this export**.

A district gets one look for free; a single school can deviate; a single floor can deviate;
and an operator can tweak one export without saving anything. "Save as theme" promotes an
ad-hoc tweak to any level of the cascade. This is what makes "super custom" survive contact
with a district that has 40 schools.

### 5.6 Consequences of Q5 (no editions)

`AGENTS.md` "Ask first: anything that blurs the CE / Pro edition boundary" and
`docs/06-editions-and-integrations.md` describe a split that no longer exists. Both need
updating in the same change, or the guardrail file will contradict the product.

---

## 6. Settings beyond appearance

Same cascade (org -> facility -> building -> floor), because a district standard and a
one-off school both have to be expressible.

### 6.1 Label freezing (Q6)

Exporting freezes the current assignment: every label is persisted as frozen, and later
additions take the next free number instead of reflowing. A printed, posted map stays valid.

- The frozen state is visible per marker and clearable ("unfreeze floor", "unfreeze all").
- Frozen labels participate in the taken-set (3.5 step 4), so gaps are preserved and
  duplicates remain impossible.
- Freezing is per building and records which export froze it, so "why is this H7" has an
  answer.

### 6.2 Numbering settings

| Setting | Options | Default |
|---|---|---|
| Scope | facility / building / floor | building |
| Direction | bottom-up / top-down | bottom-up (Hallway 1 in the basement) |
| Per type: format | prefix + number / letters / prefix + floor + number (`H2-04`) / custom pattern | prefix + number |
| Per type: start at | integer | 1 |
| Per type: pad | none / 2-digit / 3-digit | none |
| Vertical circulation | count up / one identity per shaft | count up (Q2) |
| Freeze | on export / manual only / never | on export |
| Doors | letters / numbers | letters |

The custom pattern covers site conventions the fixed options miss, e.g. `{prefix}{floor}.{n}`
producing `H0.1` in the basement.

### 6.3 Marker type registry

`MAP_TYPES` becomes a table rather than a hardcoded object, so a facility can add a type
(for example a numbered AED) without the six-file edit described in 2.2. Type definition
carries prefix, colour, shape, display name, legend order and whether it participates in
numbering. This also removes the D1 CHECK constraint as a schema-level blocker - the class
of bug behind H1.

### 6.4 Export settings

Per-floor include/exclude, floor ordering, page order override, which marker types print,
crop per floor, per-floor notes printed in the legend area, and output target (one combined
PDF for the building, one PDF per floor, or a facility bundle covering every building).

---

## 7. Phasing

Each phase is its own spec -> plan -> implement cycle.

| Phase | Content | Depends on |
|---|---|---|
| **0 - Stop the bleeding** | H1 (v1 room CHECK), H2 (v2 autosave + unload guard), M1 (v1 silent save failure + wrong dirty flag), H3 (batch export page 1), M2 (silent blank canvas) | none |
| **A - Floor stacks and versions** | 3.1-3.6. Resolves problems 1, 2 and 5. Fixes D1-D4, H4, H5 | 0 |
| **B - Relabeling** | 4.1-4.5. Resolves problem 4. Fixes M6, M7, M8 | A |
| **C - Output engine to tokens** | 5.1-5.4. Port v1 art forward, fix M3, M4, M5, L1, L3, L4 | A |
| **D - Theme + settings cascade** | 5.5, 6.1-6.4. Resolves problem 3 | B, C |

Phase 0 ships first regardless - H1 and H2 are both actively losing user work.

Deferred, and explicitly not in any phase above: two-point marker realignment across plan
versions (3.4), true NFPA 170 glyphs, numbered AED/exit markers, merging the two marker
systems, DXF ingest, server-side rendering.

## 8. Testing

Test-first is enforced. New ACs under **E15 - Floor Stacks, Relabeling and Map Theming**.
E6 ACs affected: 6.2.1 (legend), 6.3.1 (north/grid), 6.4.1 (multi-page - see H3, currently
passing on a technicality), 6.5.1 (z-axis floor labels - currently satisfied only by an
unrelated facility-level JSON blob).

Unit (Vitest; the engine is pure and Node-testable via the injected `mkDoc`):

- floor order comes from `sort_order`, never from `label` or filename
- a stack labelled `0`, `Main`, `3` numbers hallways H1.. starting on `0`
- returning to a lower floor inserts rather than appends (D2)
- a pinned or frozen label reserves its number; no duplicates are emitted (D3)
- renaming to a taken label swaps the two markers
- a shaft renders one label across all its floors (D4)
- a new plan version preserves markers, sets `needs_review`, and snapshots the prior set
- restoring a snapshot returns the exact prior marker set
- frozen labels survive a renumber; new markers take the next free number
- `orderPages` orders correctly across two documents both having a page 1
- legend does not overrun a narrow page (M3)
- theme tokens fully determine output: same markers, two themes -> identical geometry,
  different colours
- the cascade resolves org -> facility -> building -> floor -> export in that precedence

E2E (Playwright, screenshots for `[screenshot]` ACs):

- assemble three single-page PDFs into a stack labelled `0`, `Main`, `3`; export; one PDF,
  three pages, correct order, hallways numbered from the basement
- resequence mode: click four hallways, they renumber live and commit as one undo step
- upload a replacement plan for one floor; markers persist and the review banner appears
- theme picker changes accent and the live preview updates
