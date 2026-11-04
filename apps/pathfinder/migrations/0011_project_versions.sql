-- Migration 0011: project review versions + approvals (Epic E4). A project
-- accrues review rounds (V1, V2, ...); publishing a new version supersedes the
-- prior as current while the prior round and its approvals are retained.
-- Approvals record who approved which version, when (immutable, append-only).
-- Plain SQL, ASCII only.

CREATE TABLE IF NOT EXISTS project_versions (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'in_review'
                 CHECK (status IN ('draft','in_review','approved','archived')),
  notes        TEXT,
  published_by TEXT REFERENCES users(id),
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_pv_project ON project_versions(project_id);

CREATE TABLE IF NOT EXISTS project_approvals (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  approver_id TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pa_project ON project_approvals(project_id);
