-- Migration 0006: 3D scan annotations (Epic E8). Anchored scene markers and
-- named camera viewpoints attach to a media_asset (a splat or walkthrough).
-- Positions/normals are stored in the scan's world space.
--
-- Plain SQL only. ASCII only.

CREATE TABLE IF NOT EXISTS scan_markers_3d (
  id           TEXT PRIMARY KEY,
  media_id     TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
                 CHECK (type IN ('aed','stairs','door','exit','fire_extinguisher','hazard','utility','note')),
  label        TEXT NOT NULL DEFAULT '',
  description  TEXT,
  px REAL NOT NULL, py REAL NOT NULL, pz REAL NOT NULL,   -- position
  nx REAL, ny REAL, nz REAL,                              -- surface normal (optional)
  viewpoint_id TEXT,                                      -- optional framing bookmark
  floor        INTEGER,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_markers3d_media ON scan_markers_3d(media_id);

CREATE TABLE IF NOT EXISTS viewpoints (
  id          TEXT PRIMARY KEY,
  media_id    TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  px REAL NOT NULL, py REAL NOT NULL, pz REAL NOT NULL,   -- camera position
  tx REAL NOT NULL, ty REAL NOT NULL, tz REAL NOT NULL,   -- look-at target
  fov         REAL NOT NULL DEFAULT 60,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_viewpoints_media ON viewpoints(media_id);
