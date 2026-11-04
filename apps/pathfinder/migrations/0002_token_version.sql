-- Migration 0002: token versioning for JWT revocation (Epic E2 - Identity,
-- Roles & Access). Adds a monotonically-increasing token_version per user. The
-- signed JWT carries the version (claim `tv`); session resolution rejects any
-- token whose `tv` does not match the user's current token_version. Bumping the
-- column (on logout, or a future password change) revokes all outstanding
-- tokens for that user without a server-side session store.

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
