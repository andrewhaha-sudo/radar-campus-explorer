// Auth crypto library (Epic E2 - Identity, Roles & Access).
//
// PORTED from v1 els911-portal (functions/api/[[route]].js). The crypto is
// deliberately unchanged - PBKDF2-SHA256 password hashing at 100000 iterations
// and HS256 JWT sign/verify, both on the Web Crypto API so the same code runs
// in Cloudflare Workers, the dev platform proxy, and Node (vitest).
//
// These are pure, side-effect-free, unit-testable functions. No DB, no env.

// --- base64url helpers (Web Crypto produces ArrayBuffers) ---

function b64url(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str: string): Uint8Array {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(base64);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// UTF-8 encode to a BufferSource. Typed explicitly so the stricter
// @cloudflare/workers-types crypto.subtle signatures accept it.
function utf8(str: string): BufferSource {
	return new TextEncoder().encode(str) as BufferSource;
}

// --- Password hashing (PBKDF2 via Web Crypto) ---

/**
 * Derive a base64url password hash. Deterministic for a given (password, salt)
 * pair. Ported verbatim from v1: 100000 iterations, SHA-256, 256-bit output.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
	const keyMat = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: utf8(salt), iterations: 100000, hash: 'SHA-256' },
		keyMat,
		256
	);
	return b64url(bits);
}

/**
 * Constant-shape password check. Returns true iff `password` re-hashes (with the
 * stored `salt`) to the stored `hash`.
 *
 * NOTE: argument order is (password, salt, hash) per the v2 auth library API;
 * v1's helper was (password, hash, salt). The crypto is identical.
 */
export async function verifyPassword(
	password: string,
	salt: string,
	hash: string
): Promise<boolean> {
	const computed = await hashPassword(password, salt);
	return constantTimeEqualB64url(computed, hash);
}

/**
 * Constant-time comparison of two base64url strings. Decodes both to bytes and
 * XOR-accumulates every byte so the running time does not leak how many leading
 * bytes matched (a `===` string compare short-circuits and is timing-leaky).
 * A length mismatch (or a malformed input) returns false in constant time.
 */
export function constantTimeEqualB64url(a: string, b: string): boolean {
	let ab: Uint8Array;
	let bb: Uint8Array;
	try {
		ab = b64urlDecode(a);
		bb = b64urlDecode(b);
	} catch {
		return false;
	}
	if (ab.length !== bb.length) return false;
	let diff = 0;
	for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
	return diff === 0;
}

// --- JWT (HS256) via Web Crypto ---

export interface JwtPayload {
	sub: string;
	role?: string;
	email?: string;
	/** Expiry as seconds since epoch (optional). */
	exp?: number;
	[key: string]: unknown;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);
}

/** Sign a JWT payload with HS256. Ported from v1. */
export async function signJWT(payload: JwtPayload, secret: string): Promise<string> {
	const key = await importHmacKey(secret);
	const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
	const sigBuf = await crypto.subtle.sign('HMAC', key, utf8(`${header}.${body}`));
	return `${header}.${body}.${b64url(sigBuf)}`;
}

/**
 * Verify an HS256 JWT and return its decoded payload. Throws on a malformed
 * token, a bad signature, or an expired token. Ported from v1.
 */
export async function verifyJWT(token: string, secret: string): Promise<JwtPayload> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('Invalid token format');
	const [header, body, sig] = parts;

	// Pin the algorithm BEFORE verifying: reject anything that is not exactly an
	// HS256 JWT. Without this, an attacker could supply alg:"none" (or swap to a
	// different family) and bypass signature checks.
	let head: { alg?: string; typ?: string };
	try {
		head = JSON.parse(new TextDecoder().decode(b64urlDecode(header)));
	} catch {
		throw new Error('Invalid token header');
	}
	if (head.alg !== 'HS256') throw new Error('Unexpected token alg');
	if (head.typ !== 'JWT') throw new Error('Unexpected token typ');

	const key = await importHmacKey(secret);
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		b64urlDecode(sig) as BufferSource,
		utf8(`${header}.${body}`)
	);
	if (!valid) throw new Error('Invalid signature');
	const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as JwtPayload;
	if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired');
	return payload;
}

// --- shared helpers used by routes/hooks ---

/** The public, well-known dev fallback. NEVER usable to sign in production. */
export const DEV_JWT_SECRET = 'pathfinder-dev-secret-change-in-production';

/**
 * Resolve the JWT secret from platform env, failing CLOSED.
 *
 * A real `JWT_SECRET` (not the public dev string) is always accepted. The dev
 * fallback is only allowed when running in local dev; in any other environment
 * a missing or dev-string secret THROWS so the app never signs or verifies
 * tokens with a publicly-known key.
 *
 * `isDev` defaults to Vite's `import.meta.env.DEV`; it is a parameter so tests
 * can simulate production by passing `false`. (Note: in `wrangler pages dev`,
 * which serves a production build, `import.meta.env.DEV` is false - local dev
 * there must supply a real `JWT_SECRET` via .dev.vars, which it does.)
 */
export function getJwtSecret(
	env?: { JWT_SECRET?: string },
	isDev: boolean = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV
): string {
	const secret = env?.JWT_SECRET;
	if (secret && secret !== DEV_JWT_SECRET) return secret;
	if (isDev) return DEV_JWT_SECRET;
	throw new Error(
		'JWT_SECRET is not configured. Set a real secret (wrangler pages secret put JWT_SECRET); the dev fallback is refused outside local dev.'
	);
}

/** RFC4122 v4 uuid (Web Crypto). */
export function uuid(): string {
	return crypto.randomUUID();
}
