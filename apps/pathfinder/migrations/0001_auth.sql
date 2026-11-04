-- Migration 0001: authentication foundation (Epic E2 - Identity, Roles & Access).
-- Ported additively from v1 els911-portal schema (canonical sec 8: users + audit_log
-- are retained as-is). Plain SQL only: D1 rejects PRAGMA journal_mode=WAL.

-- Users: email/password identities with admin/staff/client RBAC roles.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client'
                  CHECK (role IN ('admin', 'staff', 'client')),
  org           TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  mfa_enabled   INTEGER NOT NULL DEFAULT 0,
  last_login    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- Audit log: append-only record of authentication and access events
-- (AC-2.4.1). Actor, action, resource, ip, timestamp.
CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  action     TEXT NOT NULL,        -- e.g. 'auth.login', 'auth.logout', 'access.denied'
  resource   TEXT,                 -- e.g. 'user:uuid', 'facility:uuid'
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);
