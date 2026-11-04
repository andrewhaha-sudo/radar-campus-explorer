-- Migration 0005: unified scan library (Epic E7). The media_assets model
-- supersedes the flat documents.doc_type for 3D scans, walkthroughs and
-- reference media. Documents (migration 0004) stay for the 2D annotation
-- engine; media_assets is the home for the larger artefacts (point clouds,
-- splats, videos) with versioning, R2 storage tier and field-capture metadata.
--
-- Plain SQL only. ASCII only.

CREATE TABLE IF NOT EXISTS media_assets (
  id            TEXT PRIMARY KEY,
  building_id   TEXT REFERENCES buildings(id) ON DELETE CASCADE,
  facility_id   TEXT REFERENCES facilities(id) ON DELETE CASCADE,
  type          TEXT NOT NULL
                  CHECK (type IN ('floorplan_pdf','point_cloud','splat','walkthrough_video','reference_image')),
  filename      TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  storage_tier  TEXT NOT NULL DEFAULT 'hot' CHECK (storage_tier IN ('hot','cold')),
  served        INTEGER NOT NULL DEFAULT 1,     -- 0 = archived master, never streamed
  size          INTEGER,
  version       INTEGER NOT NULL DEFAULT 1,
  capture_date  TEXT,                            -- when the scan/photo was captured
  surveyor      TEXT,                            -- field-verification metadata
  floor         INTEGER,                         -- which floor this asset documents
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('pending','active','archived')),
  upload_id     TEXT,                            -- R2 multipart upload id while pending
  uploaded_by   TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_building ON media_assets(building_id);
CREATE INDEX IF NOT EXISTS idx_media_facility ON media_assets(facility_id);
CREATE INDEX IF NOT EXISTS idx_media_type     ON media_assets(type);
CREATE INDEX IF NOT EXISTS idx_media_status   ON media_assets(status);
