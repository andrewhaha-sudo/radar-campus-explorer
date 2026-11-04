-- Migration 0008: compliance metadata (Epic E11). Per-facility trust/compliance
-- attributes that feed the NG911 export, the trust page, and procurement
-- evidence. Audit immutability is enforced at the application layer (append-only
-- inserts; no UPDATE/DELETE paths in code) building on audit_log (migration 0001).
--
-- Plain SQL only. ASCII only.

CREATE TABLE IF NOT EXISTS compliance_meta (
  facility_id      TEXT PRIMARY KEY REFERENCES facilities(id) ON DELETE CASCADE,
  last_reviewed    TEXT,                       -- date the map was last verified
  last_tour        TEXT,                       -- last responder walkthrough
  alyssas_law      INTEGER NOT NULL DEFAULT 0, -- Alyssa's Law mandate flag
  karis_law        INTEGER NOT NULL DEFAULT 0, -- Kari's Law mandate flag
  state_mandate    TEXT,                       -- state-specific mandate reference
  drill_link       TEXT,                       -- link to drill records
  floor_labels     TEXT,                       -- JSON map of floor number -> label
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
