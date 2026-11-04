// Shared login hardening helpers (Epic E2 - Identity, Roles & Access).
// Used by both the form action (/login) and the API route (/api/auth/login) so
// anti-enumeration and input-cap behavior is identical across entry points.

// --- Input caps (validate cheaply BEFORE any DB or crypto work) ---

/** RFC-5321 local+domain practical ceiling. */
export const EMAIL_MAX = 320;
/** Defensive password length cap (PBKDF2 cost is bounded regardless). */
export const PASSWORD_MAX = 200;

// Deliberately loose shape check: just enough to reject obvious garbage before
// touching the DB, without trying to fully validate email RFC grammar.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(email: string): boolean {
	return email.length > 0 && email.length <= EMAIL_MAX && EMAIL_RE.test(email);
}

// --- Anti-enumeration decoy ---
//
// On the unknown-user path we still run a real verifyPassword against this
// constant decoy hash, so the response time matches the known-user path and an
// attacker cannot distinguish "no such user" from "wrong password" by timing.
// Precomputed offline: PBKDF2-SHA256(100000, "decoy-password-never-matches",
// salt=DECOY_SALT). It is never a valid credential for any account.
export const DECOY_SALT = 'pathfinder-decoy-salt-constant';
export const DECOY_HASH = 'xsEzKdj2MzpXRb3uhY73RTg5FdAPKI-J20a_-BlCOx4';

// --- Client IP extraction (for rate limiting / audit) ---

export function clientIp(request: Request): string | null {
	return (
		request.headers.get('CF-Connecting-IP') ||
		request.headers.get('X-Forwarded-For') ||
		null
	);
}
