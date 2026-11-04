-- Migration 0016: per-floor plan geometry - scale and north (design doc
-- 2026-08-18, plan.scaleBar / plan.north).
--
-- The map theme has carried scale bar and north arrow tokens since migration
-- 0015, but both were inert decoration: the north arrow always pointed up the
-- page, and no scale bar could be drawn at all, because nothing in the data
-- said how big the building is or which way it faces. A floorplan is scanned
-- and cropped at whatever rotation the source PDF happened to use, so neither
-- fact can be inferred from the image.
--
-- Both live on the floor, not the building: floors of one building arrive as
-- separate PDFs at different crops and rotations, so a building-wide value
-- would be wrong on most of the stack.
--
-- plan_scale is deliberately nullable and has NO default. Unknown scale means
-- the export prints no scale bar, which is the honest outcome; a default would
-- silently print a measuring instrument nobody verified. north_deg defaults to
-- 0, which is the arrow's existing behaviour, so nothing changes until a
-- surveyor says otherwise.
--
-- Plain SQL, ASCII only.

-- Real-world millimetres spanned by one normalized unit of page width, i.e.
-- how wide the whole plan is in the world. NULL = unknown, scale bar suppressed.
ALTER TABLE floors ADD COLUMN plan_scale REAL;

-- Rotation of true north away from up the page, in degrees clockwise, 0-359.
ALTER TABLE floors ADD COLUMN north_deg REAL NOT NULL DEFAULT 0;
