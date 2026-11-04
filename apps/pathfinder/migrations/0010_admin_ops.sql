-- Migration 0010: admin & platform ops (Epic E13). API keys (scoped, hashed),
-- deployment settings (runtime config without code change), and an error log
-- for observability. Ported/extended from v1's api_keys. Plain SQL, ASCII only.

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  key_hash     TEXT UNIQUE NOT NULL,            -- SHA-256 of the raw key
  masked_key   TEXT,                            -- display-safe (pf_live_....abcd)
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  scope        TEXT NOT NULL DEFAULT 'read'     -- 'read' or 'write'
                 CHECK (scope IN ('read','write')),
  created_by   TEXT REFERENCES users(id),
  expires_at   TEXT,
  last_used_at TEXT,
  revoked      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Deployment-wide settings (key/value). Read at runtime so an operator can
-- flip behaviour without a code change (AC-13.4.1).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Observability: captured runtime errors with diagnostic context (AC-13.5.1).
CREATE TABLE IF NOT EXISTS error_log (
  id         TEXT PRIMARY KEY,
  message    TEXT NOT NULL,
  stack      TEXT,
  url        TEXT,
  status     INTEGER,
  user_id    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at DESC);
