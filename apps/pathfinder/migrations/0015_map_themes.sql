-- Migration 0015: map themes (design doc 2026-08-18, sections 5.3-5.5).
--
-- The PDF exporter shipped three hardcoded palettes and branched on a style
-- key, so a district could not change a single colour, size or printed string
-- without a code edit. Appearance is now data: a theme is a partial token set
-- over the seeded defaults, and it cascades org -> facility -> building ->
-- floor with the nearest scope winning.
--
-- Only the OVERRIDDEN tokens are stored, as JSON in `tokens`. A theme that
-- names one colour keeps inheriting every other token, so improving a preset
-- reaches every facility that did not deliberately opt out. `is_default` marks
-- the row the cascade uses at that scope; other rows at the same scope are
-- saved looks an operator can pick.
--
-- scope_id is deliberately NOT a foreign key: one column points at four
-- different tables, which SQLite cannot express, and a theme outliving a
-- deleted floor is harmless (it simply stops matching).
--
-- Plain SQL, ASCII only.

CREATE TABLE IF NOT EXISTS map_themes (
  id         TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('org','facility','building','floor')),
  scope_id   TEXT NOT NULL,           -- orgs.id / facilities.id / buildings.id / floors.id
  name       TEXT NOT NULL,           -- "Wellsboro standard", "Command"
  tokens     TEXT NOT NULL DEFAULT '{}',  -- JSON: the partial MapTheme this scope overrides
  is_default INTEGER NOT NULL DEFAULT 0,  -- the row the cascade uses at this scope
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_map_themes_scope ON map_themes(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_map_themes_default ON map_themes(scope_type, scope_id, is_default);
