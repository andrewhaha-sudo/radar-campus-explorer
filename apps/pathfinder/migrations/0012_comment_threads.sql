-- Migration 0012: threaded comments + comment images (Epic E9). Adds reply
-- nesting (parent_id) and an images column (JSON array of R2 keys) to
-- annotation_comments. Plain SQL, ASCII only.

ALTER TABLE annotation_comments ADD COLUMN parent_id TEXT;
ALTER TABLE annotation_comments ADD COLUMN images TEXT;

CREATE INDEX IF NOT EXISTS idx_ann_comments_parent ON annotation_comments(parent_id);
