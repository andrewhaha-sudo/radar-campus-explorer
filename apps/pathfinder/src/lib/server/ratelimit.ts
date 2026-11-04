// Login rate limiting / lockout (Epic E2 - Identity, Roles & Access).
//
// Per-IP and per-email failed-login throttling backed by the KV namespace
// (binding CACHE). Each failed attempt increments a counter under a key, with a
// rolling TTL window; once a threshold is crossed the caller is locked out for
// the remainder of the window. A successful login resets the counters.
//
// Degrades gracefully: if KV is unavailable (e.g. local `wrangler pages dev`
// without the CACHE binding) every operation is a no-op and login proceeds
// normally - throttling is a defense-in-depth layer, never a hard dependency.

/** Minimal KV surface we rely on (subset of KVNamespace). */
export interface RateLimitStore {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface RateLimitConfig {
	/** Number of failed attempts allowed before lockout. */
	threshold: number;
	/** Lockout / counter TTL window, in seconds. */
	windowSeconds: number;
}

/** Defaults: 8 failures within 15 minutes triggers a lockout. */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
	threshold: 8,
	windowSeconds: 15 * 60
};

const PREFIX = 'login_fail:';

function ipKey(ip: string): string {
	return `${PREFIX}ip:${ip}`;
}

function emailKey(email: string): string {
	return `${PREFIX}email:${email}`;
}

/**
 * Is this (ip, email) pair currently locked out? Returns true if EITHER counter
 * is at or above the threshold. Missing store -> never locked (graceful).
 */
export async function isLockedOut(
	store: RateLimitStore | undefined | null,
	ip: string | null,
	email: string,
	config: RateLimitConfig = DEFAULT_RATE_LIMIT
): Promise<boolean> {
	if (!store) return false;
	const keys: string[] = [];
	if (ip) keys.push(ipKey(ip));
	if (email) keys.push(emailKey(email));
	try {
		for (const k of keys) {
			const v = await store.get(k);
			if (v && parseInt(v, 10) >= config.threshold) return true;
		}
	} catch {
		// KV failure -> fail open, do not block real users.
		return false;
	}
	return false;
}

/**
 * Record a failed login: increment the IP and email counters (each with a fresh
 * TTL so a steady stream of attempts keeps the window open). Returns the higher
 * of the two new counts (0 if no store). Never throws.
 */
export async function recordFailure(
	store: RateLimitStore | undefined | null,
	ip: string | null,
	email: string,
	config: RateLimitConfig = DEFAULT_RATE_LIMIT
): Promise<number> {
	if (!store) return 0;
	let worst = 0;
	const keys: string[] = [];
	if (ip) keys.push(ipKey(ip));
	if (email) keys.push(emailKey(email));
	for (const k of keys) {
		try {
			const cur = await store.get(k);
			const next = (cur ? parseInt(cur, 10) || 0 : 0) + 1;
			await store.put(k, String(next), { expirationTtl: config.windowSeconds });
			if (next > worst) worst = next;
		} catch {
			// non-fatal: a missing increment must not break the login path.
		}
	}
	return worst;
}

/** Clear both counters on a successful login. Never throws. */
export async function resetFailures(
	store: RateLimitStore | undefined | null,
	ip: string | null,
	email: string
): Promise<void> {
	if (!store) return;
	const keys: string[] = [];
	if (ip) keys.push(ipKey(ip));
	if (email) keys.push(emailKey(email));
	for (const k of keys) {
		try {
			await store.delete(k);
		} catch {
			// non-fatal.
		}
	}
}
