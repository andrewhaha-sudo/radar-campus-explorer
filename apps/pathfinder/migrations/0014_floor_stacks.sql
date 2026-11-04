-- Migration 0014: floor stacks and floor plan versions (Epic E15, AC-15.1.x).
--
-- Floors of one building routinely arrive as SEPARATE per-floor PDFs with
-- arbitrary names ("0", "Main", "3" - not 1/2/3), and re-surveys are constant,
-- so the same floor exists in many versions over time. Before this migration
-- there was no way to relate those documents: marker numbering was scoped to a
-- single document, so every floor restarted at H1, and a redo stranded the
-- annotation work on the superseded PDF.
--
-- The floor becomes the durable unit. Markers hang off the floor; a floor plan
-- version is the swappable image underneath them. label is free text and never
-- drives ordering; sort_order is the only ordering truth; level is optional
-- metadata for NG911 z-axis output.
--
-- Plain SQL, ASCII only.

CREATE TABLE IF NOT EXISTS floors (
  id           TEXT PRIMARY KEY,
  building_id  TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,           -- "0", "Main", "3" - verbatim, arbitrary
  level        INTEGER,                 -- optional; compliance z-axis only
  sort_order   INTEGER NOT NULL,        -- the ONLY ordering truth; lowest first
  needs_review INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fpv_floor_version ON floor_plan_versions(floor_id, version);
CREATE INDEX IF NOT EXISTS idx_fpv_current ON floor_plan_versions(floor_id, is_current);
CREATE INDEX IF NOT EXISTS idx_fpv_doc ON floor_plan_versions(doc_id, page);

-- One physical stairwell or elevator spanning several floors. Markers linked to
-- a shaft share one label, so a responder told "go to S1" finds the same shaft
-- on any floor.
CREATE TABLE IF NOT EXISTS shafts (
  id           TEXT PRIMARY KEY,
  building_id  TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('stairs','elevator')),
  label        TEXT,
  label_pinned INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shafts_building ON shafts(building_id);

-- map_markers keeps doc_id/page for one release so a rollback stays possible;
-- floor_id is the new owner. label_frozen is set when an export commits the
-- current numbering, so a printed and posted map does not silently renumber.
ALTER TABLE map_markers ADD COLUMN floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE;
ALTER TABLE map_markers ADD COLUMN shaft_id TEXT REFERENCES shafts(id) ON DELETE SET NULL;
ALTER TABLE map_markers ADD COLUMN label_frozen INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_map_markers_floor ON map_markers(floor_id);
CREATE INDEX IF NOT EXISTS idx_map_markers_shaft ON map_markers(shaft_id);
