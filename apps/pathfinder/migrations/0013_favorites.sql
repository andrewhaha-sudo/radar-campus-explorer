-- Migration 0013: building favorites (Epic E3, AC-3.5.1). Per-user starred
-- buildings, persisted server-side so they survive across sessions/devices.
-- Plain SQL, ASCII only.

CREATE TABLE IF NOT EXISTS favorites (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, building_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
