// Server-side session helpers (Epic E2). Bridges the JWT crypto in auth.ts to
// the D1 `users` table and the audit_log. Used by API routes and hooks.

import { verifyJWT, getJwtSecret, uuid } from './auth';

export const SESSION_COOKIE = 'pf_session';

/** Columns safe to expose on event.locals / API responses (no hash/salt). */
export interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'staff' | 'client';
	org: string | null;
	active: number;
	mfa_enabled: number;
}

type Env = { DB: D1Database; JWT_SECRET?: string; CACHE?: KVNamespace };

/** Internal row shape: the public SessionUser plus the revocation counter. */
type SessionUserRow = SessionUser & { token_version: number };

/**
 * Resolve a JWT into the live user row from D1. Returns null if the token is
 * missing, invalid, expired, the user is gone/inactive, or the token has been
 * revoked (its `tv` claim no longer matches the user's token_version).
 */
export async function userFromToken(
	token: string | undefined | null,
	env: Env
): Promise<SessionUser | null> {
	if (!token) return null;
	try {
		const payload = await verifyJWT(token, getJwtSecret(env));
		const row = await env.DB.prepare(
			'SELECT id, name, email, role, org, active, mfa_enabled, token_version FROM users WHERE id = ?'
		)
			.bind(payload.sub)
			.first<SessionUserRow>();
		if (!row || !row.active) return null;
		// Revocation check: a bumped token_version invalidates older tokens.
		const tv = typeof payload.tv === 'number' ? payload.tv : 0;
		if (tv !== (row.token_version ?? 0)) return null;
		const { token_version: _tv, ...user } = row;
		return user;
	} catch {
		return null;
	}
}

/** Pull a bearer token from the Authorization header, if present. */
export function bearerFromRequest(request: Request): string | null {
	const auth = request.headers.get('Authorization') || '';
	if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
	return null;
}

/** Pull an API key from X-API-Key or an Authorization: Bearer pf_... header. */
export function apiKeyFromRequest(request: Request): string | null {
	const x = request.headers.get('X-API-Key');
	if (x) return x.trim();
	const b = bearerFromRequest(request);
	if (b && b.startsWith('pf_')) return b;
	return null;
}

/** Hex SHA-256 of a string (Web Crypto). */
export async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve a raw API key into its user + scope (Epic E13). Looks the key up by
 * SHA-256 hash; rejects revoked or expired keys. Touches last_used_at. Returns
 * null when the key is unknown/revoked/expired or its user is inactive.
 */
export async function userFromApiKey(
	rawKey: string | null,
	env: Env
): Promise<{ user: SessionUser; scope: 'read' | 'write' } | null> {
	if (!rawKey) return null;
	const hash = await sha256Hex(rawKey);
	const row = await env.DB.prepare(
		`SELECT k.scope, k.expires_at, k.revoked,
		        u.id, u.name, u.email, u.role, u.org, u.active, u.mfa_enabled
		   FROM api_keys k JOIN users u ON u.id = k.user_id
		  WHERE k.key_hash = ?`
	)
		.bind(hash)
		.first<{ scope: 'read' | 'write'; expires_at: string | null; revoked: number } & SessionUser>();
	if (!row || row.revoked || !row.active) return null;
	if (row.expires_at && row.expires_at < new Date().toISOString()) return null;
	env.DB.prepare('UPDATE api_keys SET last_used_at = datetime("now") WHERE key_hash = ?')
		.bind(hash)
		.run()
		.catch(() => {});
	const { scope, expires_at: _e, revoked: _r, ...user } = row;
	return { user, scope };
}

/**
 * Append an immutable audit entry (AC-2.4.1). Fire-and-forget: an audit write
 * failure must never break the request it records.
 */
export async function audit(
	env: Env,
	userId: string | null,
	action: string,
	resource: string | null,
	request: Request
): Promise<void> {
	const ip =
		request.headers.get('CF-Connecting-IP') ||
		request.headers.get('X-Forwarded-For') ||
		null;
	try {
		await env.DB.prepare(
			'INSERT INTO audit_log (id, user_id, action, resource, ip, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
		)
			.bind(uuid(), userId, action, resource, ip)
			.run();
	} catch {
		// non-fatal
	}
}
