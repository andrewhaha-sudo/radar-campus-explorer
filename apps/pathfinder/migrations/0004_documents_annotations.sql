-- Migration 0004: documents, annotations, map markers/crops (Epics E5, E6).
-- Ported additively from the v1 els911-portal schema (canonical sec 8: v2
-- retains all v1 tables and layers hierarchy/media on top). Documents hang off
-- the minimal projects table (migration 0003), which already links to buildings,
-- so the chain is building -> project -> document -> annotations/markers.
--
-- Plain SQL only (D1 rejects PRAGMA WAL). ASCII only.

-- Documents: a floorplan PDF (or reference image) under a project.
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  storage_key TEXT NOT NULL,                 -- R2 object key
  size        INTEGER,
  page_count  INTEGER DEFAULT 1,
  doc_type    TEXT NOT NULL DEFAULT 'floorplan'
                CHECK (doc_type IN ('floorplan', 'dollhouse', 'reference', 'other')),
  mime_type   TEXT NOT NULL DEFAULT 'application/pdf',
  version     INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('pending', 'active', 'archived')),
  uploaded_by TEXT REFERENCES users(id),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id  ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);

-- Annotations: the 12 review tool types, normalized [0,1] coordinates.
CREATE TABLE IF NOT EXISTS annotations (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number  INTEGER NOT NULL DEFAULT 1,
  type         TEXT NOT NULL
                 CHECK (type IN (
                   'circle', 'rect', 'arrow', 'freehand',
                   'comment', 'correction',
                   'aed', 'stairs', 'door', 'overhead', 'exit', 'fireext'
                 )),
  nx           REAL NOT NULL DEFAULT 0,
  ny           REAL NOT NULL DEFAULT 0,
  nw           REAL NOT NULL DEFAULT 0,
  nh           REAL NOT NULL DEFAULT 0,
  points       TEXT,                          -- JSON array of [nx,ny] (freehand)
  color        TEXT NOT NULL DEFAULT '#B22234',
  text         TEXT,
  images       TEXT DEFAULT NULL,             -- JSON array of R2 keys
  linked_annotation_id TEXT,
  resolved     INTEGER NOT NULL DEFAULT 0,
  resolved_by  TEXT REFERENCES users(id),
  resolved_at  TEXT,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_page_number ON annotations(page_number);
CREATE INDEX IF NOT EXISTS idx_annotations_resolved    ON annotations(resolved);

-- Annotation comments (threaded discussion on a single annotation). E9 builds
-- the full collaboration loop on top of this; the table lands here with E5.
CREATE TABLE IF NOT EXISTS annotation_comments (
  id            TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id),
  text          TEXT NOT NULL,
  resolved      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ann_comments_annotation_id ON annotation_comments(annotation_id);

-- Map markers: persistent wayfinding layer (S1, H2, door A...). 'room' is
-- allowed (the engine supports it; v1 schema omitted it - aligned here).
CREATE TABLE IF NOT EXISTS map_markers (
  id           TEXT PRIMARY KEY,
  doc_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page         INTEGER NOT NULL DEFAULT 1,
  type         TEXT NOT NULL CHECK (type IN ('stairs','hallway','door','elevator','room')),
  label        TEXT NOT NULL,
  label_pinned INTEGER NOT NULL DEFAULT 0,
  nx           REAL NOT NULL,
  ny           REAL NOT NULL,
  label_nx     REAL DEFAULT NULL,
  label_ny     REAL DEFAULT NULL,
  points       TEXT DEFAULT NULL,             -- JSON [{nx,ny}] hallway polygon
  extra_labels TEXT DEFAULT NULL,             -- JSON [{nx,ny}] secondary pins
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_map_markers_doc_id ON map_markers(doc_id);

-- Map crops: per-page print boundary + label + order for multi-page export.
CREATE TABLE IF NOT EXISTS map_crops (
  doc_id      TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page        INTEGER NOT NULL,
  nx          REAL NOT NULL DEFAULT 0,
  ny          REAL NOT NULL DEFAULT 0,
  nw          REAL NOT NULL DEFAULT 1,
  nh          REAL NOT NULL DEFAULT 1,
  label       TEXT DEFAULT NULL,
  print_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_id, page)
);
