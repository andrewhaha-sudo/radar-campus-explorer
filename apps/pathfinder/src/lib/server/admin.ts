// Admin / platform-ops DAL (Epic E13). User listing, API-key listing and audit
// access for the admin console. Admin role is enforced by the callers.

import { uuid, hashPassword } from './auth';
import { sha256Hex } from './session';

type Env = { DB: D1Database };

function b64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomToken(bytes = 24): string {
	const b = new Uint8Array(bytes);
	crypto.getRandomValues(b);
	return b64url(b);
}

export interface AdminUser {
	id: string;
	name: string;
	email: string;
	role: string;
	org: string | null;
	active: number;
	mfa_enabled: number;
	last_login: string | null;
	created_at: string;
}

export async function listUsers(env: Env): Promise<AdminUser[]> {
	const { results } = await env.DB.prepare(
		'SELECT id, name, email, role, org, active, mfa_enabled, last_login, created_at FROM users ORDER BY created_at DESC'
	).all<AdminUser>();
	return results ?? [];
}

export async function setUserActive(env: Env, id: string, active: boolean): Promise<void> {
	await env.DB.prepare('UPDATE users SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run();
}

/** Create a user with an explicit role + initial password (AC-13.1.1). Returns
 *  the new id, or null if the email is already taken. */
export async function createUser(
	env: Env,
	input: { name: string; email: string; password: string; role: 'admin' | 'staff' | 'client'; org?: string | null }
): Promise<string | null> {
	const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(input.email).first();
	if (existing) return null;
	const id = uuid();
	const salt = randomToken(16);
	const hash = await hashPassword(input.password, salt);
	await env.DB.prepare(
		'INSERT INTO users (id, name, email, password_hash, salt, role, org, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
	)
		.bind(id, input.name, input.email.toLowerCase(), hash, salt, input.role, input.org ?? null)
		.run();
	return id;
}

export async function updateUserRole(env: Env, id: string, role: 'admin' | 'staff' | 'client'): Promise<void> {
	await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
}

// --- API keys (E13) ---

/** Issue an API key for a user at a scope. Returns the RAW key ONCE (only its
 *  SHA-256 hash is stored). Caller surfaces the raw key to the operator. */
export async function createApiKey(
	env: Env,
	input: { name: string; userId: string; scope: 'read' | 'write'; createdBy: string; expiresAt?: string | null }
): Promise<{ id: string; rawKey: string; masked: string }> {
	const raw = `pf_${input.scope === 'write' ? 'wr' : 'rd'}_${randomToken(24)}`;
	const hash = await sha256Hex(raw);
	const masked = `${raw.slice(0, 10)}...${raw.slice(-4)}`;
	const id = uuid();
	await env.DB.prepare(
		'INSERT INTO api_keys (id, name, key_hash, masked_key, user_id, scope, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
	)
		.bind(id, input.name, hash, masked, input.userId, input.scope, input.createdBy, input.expiresAt ?? null)
		.run();
	return { id, rawKey: raw, masked };
}

export async function revokeApiKey(env: Env, id: string): Promise<void> {
	await env.DB.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?').bind(id).run();
}

// --- Settings (E13) ---

export async function getSetting(env: Env, key: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
	return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string, updatedBy: string): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO settings (key, value, updated_by) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`
	)
		.bind(key, value, updatedBy)
		.run();
}

export async function listSettings(env: Env): Promise<Array<{ key: string; value: string }>> {
	const { results } = await env.DB.prepare('SELECT key, value FROM settings ORDER BY key').all<{ key: string; value: string }>();
	return results ?? [];
}

/** Filtered audit query for the admin viewer (AC-13.3.1). */
export async function filterAudit(
	env: Env,
	opts: { actor?: string; since?: string; until?: string; limit?: number }
): Promise<Array<{ id: string; user_id: string | null; action: string; resource: string | null; ip: string | null; created_at: string }>> {
	const where: string[] = [];
	const binds: unknown[] = [];
	if (opts.actor) {
		where.push('user_id = ?');
		binds.push(opts.actor);
	}
	if (opts.since) {
		where.push('created_at >= ?');
		binds.push(opts.since);
	}
	if (opts.until) {
		where.push('created_at <= ?');
		binds.push(opts.until);
	}
	const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	binds.push(opts.limit ?? 100);
	const { results } = await env.DB.prepare(
		`SELECT id, user_id, action, resource, ip, created_at FROM audit_log ${clause} ORDER BY created_at DESC LIMIT ?`
	)
		.bind(...binds)
		.all<{ id: string; user_id: string | null; action: string; resource: string | null; ip: string | null; created_at: string }>();
	return results ?? [];
}

export interface AdminApiKey {
	id: string;
	name: string;
	masked_key: string | null;
	user_id: string | null;
	revoked: number;
	last_used_at: string | null;
	created_at: string;
}

export async function listApiKeys(env: Env): Promise<AdminApiKey[]> {
	// api_keys ships in the v1 schema; the table may not exist in a fresh v2 DB
	// until the v1 import runs, so tolerate its absence.
	try {
		const { results } = await env.DB.prepare(
			'SELECT id, name, masked_key, user_id, revoked, last_used_at, created_at FROM api_keys ORDER BY created_at DESC'
		).all<AdminApiKey>();
		return results ?? [];
	} catch {
		return [];
	}
}

export interface PlatformStats {
	users: number;
	facilities: number;
	buildings: number;
	documents: number;
	media: number;
}

export async function platformStats(env: Env): Promise<PlatformStats> {
	const row = await env.DB.prepare(
		`SELECT
		   (SELECT COUNT(*) FROM users) AS users,
		   (SELECT COUNT(*) FROM facilities) AS facilities,
		   (SELECT COUNT(*) FROM buildings) AS buildings,
		   (SELECT COUNT(*) FROM documents) AS documents,
		   (SELECT COUNT(*) FROM media_assets) AS media`
	).first<PlatformStats>();
	return row ?? { users: 0, facilities: 0, buildings: 0, documents: 0, media: 0 };
}
