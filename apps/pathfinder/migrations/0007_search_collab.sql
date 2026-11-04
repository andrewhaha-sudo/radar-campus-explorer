-- Migration 0007: global search (E10), collaboration (E9), batch export (E6).
-- D1/SQLite ships FTS5; search_index is a standalone FTS5 table indexed on
-- write (and rebuildable via the reindex path). annotation_comments already
-- carries `resolved` (migration 0004); the resolve workflow hides rather than
-- deletes, preserving the audit trail.
--
-- Plain SQL only. ASCII only.

-- Full-text search across facilities, buildings, projects, documents, markers.
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entity_type UNINDEXED,
  entity_id   UNINDEXED,
  title,
  subtitle,
  url         UNINDEXED,
  tokenize = 'porter'
);

-- Activity feed: an append-only record of notable mutations for the feed UI.
CREATE TABLE IF NOT EXISTS activity_log (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT REFERENCES users(id),
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  summary       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_resource ON activity_log(resource_type, resource_id);

-- Share links: tokenised read-only access to a resource for outside stakeholders.
CREATE TABLE IF NOT EXISTS share_links (
  token         TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  created_by    TEXT REFERENCES users(id),
  expires_at    TEXT,
  revoked       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_resource ON share_links(resource_type, resource_id);

-- Batch export jobs: a queued + tracked multi-map PDF export over a scope.
CREATE TABLE IF NOT EXISTS export_jobs (
  id          TEXT PRIMARY KEY,
  scope_type  TEXT NOT NULL CHECK (scope_type IN ('district','facility','building')),
  scope_id    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','done','error')),
  total       INTEGER NOT NULL DEFAULT 0,
  done        INTEGER NOT NULL DEFAULT 0,
  result_key  TEXT,                              -- R2 key of the assembled bundle
  error       TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_scope ON export_jobs(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);

-- Notifications: mention/reply/resolve events, batched into digests before send.
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES users(id),
  actor_id     TEXT REFERENCES users(id),
  kind         TEXT NOT NULL CHECK (kind IN ('mention','reply','resolve')),
  resource_url TEXT NOT NULL,
  excerpt      TEXT,
  read_at      TEXT,
  batched_at   TEXT,                             -- set when included in a digest send
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unbatched ON notifications(batched_at);
