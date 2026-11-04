-- Migration 0009: project review workflow (Epic E4). Adds project_members
-- (reviewer/viewer assignment) and an updated_at stamp on projects so status
-- transitions are timestamped. The status/progress columns already exist
-- (migration 0003); this layers the membership + review loop on top.
--
-- Plain SQL only. ASCII only.

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer','viewer')),
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);

ALTER TABLE projects ADD COLUMN updated_at TEXT;
