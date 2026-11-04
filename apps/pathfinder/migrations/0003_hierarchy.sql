-- Migration 0003: org hierarchy and roll-up dashboards (Epic E3 - Org Hierarchy
-- & Dashboards). Adds the tenant backbone Org -> District -> Facility -> Building
-- (canonical sec 8, spec 9.10) plus a minimal projects table so hierarchy
-- roll-ups have something to count. The full project/review workflow (E4) lands
-- in a later sprint; this projects table is intentionally minimal.
--
-- Plain SQL only: D1 rejects PRAGMA journal_mode=WAL. ASCII only.

-- Orgs: the client organization (tenant). users.org (free text from migration
-- 0001) is matched to orgs.name for client role-scoping (see hierarchy.ts).
CREATE TABLE IF NOT EXISTS orgs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  brand_id   TEXT,
  type       TEXT CHECK (type IN
               ('school', '911_center', 'university', 'government', 'healthcare', 'other')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orgs_name ON orgs(name);

-- Districts: a grouping under an org (e.g. a school district).
CREATE TABLE IF NOT EXISTS districts (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES orgs(id),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_districts_org_id ON districts(org_id);

-- Facilities: a site (school, 911 center, campus building cluster). district_id
-- is nullable for facilities that hang directly off the org.
CREATE TABLE IF NOT EXISTS facilities (
  id          TEXT PRIMARY KEY,
  district_id TEXT REFERENCES districts(id),
  org_id      TEXT NOT NULL REFERENCES orgs(id),
  name        TEXT NOT NULL,
  type        TEXT CHECK (type IN
                ('school', '911_center', 'university', 'government', 'healthcare', 'other')),
  address     TEXT,
  zip         TEXT,
  phone       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_facilities_district_id ON facilities(district_id);
CREATE INDEX IF NOT EXISTS idx_facilities_org_id      ON facilities(org_id);

-- Buildings: a structure within a facility, multi-floor capable.
CREATE TABLE IF NOT EXISTS buildings (
  id          TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  name        TEXT NOT NULL,
  floors      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_buildings_facility_id ON buildings(facility_id);

-- Projects: minimal table so roll-ups can count work per building/facility.
-- The full review workflow (status transitions, members, versions, approvals)
-- is Epic E4 / a later sprint; building_id is the only hierarchy link needed now.
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  building_id TEXT REFERENCES buildings(id),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  progress    INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_building_id ON projects(building_id);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);
