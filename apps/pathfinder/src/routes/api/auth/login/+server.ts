// POST /api/auth/login (Epic E2, AC-2.1.1 / AC-2.1.2 / AC-2.4.1).
// Validates email+password against D1, issues an HS256 JWT, sets it as an
// httpOnly session cookie, writes an audit entry, and updates last_login.
// Login logic ported from v1 els911-portal handleLogin.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { signJWT, verifyPassword, getJwtSecret } from '$lib/server/auth';
import { audit, SESSION_COOKIE } from '$lib/server/session';
import { isLockedOut, recordFailure, resetFailures } from '$lib/server/ratelimit';
import { clientIp, DECOY_HASH, DECOY_SALT, validEmail, EMAIL_MAX, PASSWORD_MAX } from '$lib/server/login';

const GENERIC_ERROR = 'Invalid email or password.';
const LOCKOUT_ERROR = 'Too many attempts. Try again later.';
// 12 hours: short enough to bound a leaked token's blast radius, long enough to
// avoid forcing field users to re-auth mid-shift.
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');

	let body: { email?: string; password?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Malformed request body.');
	}

	const email = (body.email || '').toLowerCase().trim();
	const password = body.password || '';
	if (!email || !password) error(400, 'Email and password are required.');
	// Cap input length and validate email shape before any DB/crypto work.
	if (email.length > EMAIL_MAX || password.length > PASSWORD_MAX || !validEmail(email)) {
		error(400, GENERIC_ERROR);
	}

	const cache = env.CACHE;
	const ip = clientIp(request);

	// Lockout gate (degrades to no-op without KV).
	if (await isLockedOut(cache, ip, email)) {
		await audit(env, null, 'access.denied', `lockout:${email}`, request);
		error(429, LOCKOUT_ERROR);
	}

	const user = await env.DB.prepare(
		'SELECT id, name, email, role, org, active, mfa_enabled, token_version, password_hash, salt FROM users WHERE email = ? AND active = 1'
	)
		.bind(email)
		.first<{
			id: string;
			name: string;
			email: string;
			role: 'admin' | 'staff' | 'client';
			org: string | null;
			active: number;
			mfa_enabled: number;
			token_version: number;
			password_hash: string;
			salt: string;
		}>();

	if (!user) {
		// Run a real hash against a constant decoy so timing matches the
		// known-user path (anti-enumeration), then fail generically.
		await verifyPassword(password, DECOY_SALT, DECOY_HASH);
		await recordFailure(cache, ip, email);
		await audit(env, null, 'access.denied', `login:${email}`, request);
		// Generic error, no session issued (AC-2.1.2).
		error(401, GENERIC_ERROR);
	}

	const valid = await verifyPassword(password, user.salt, user.password_hash);
	if (!valid) {
		await recordFailure(cache, ip, email);
		await audit(env, user.id, 'access.denied', `user:${user.id}`, request);
		error(401, GENERIC_ERROR);
	}

	// Success: clear any failure counters for this IP/email.
	await resetFailures(cache, ip, email);

	// MFA hook (AC-2.5.1): password-only users continue unchanged; an
	// mfa_enabled user would branch into a second step here. The flag is
	// surfaced so the flow can expose the step without breaking anyone.
	const mfaRequired = user.mfa_enabled === 1;

	const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
	const token = await signJWT(
		{ sub: user.id, role: user.role, email: user.email, tv: user.token_version ?? 0, exp },
		getJwtSecret(env)
	);

	await env.DB.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?')
		.bind(user.id)
		.run();
	await audit(env, user.id, 'auth.login', `user:${user.id}`, request);

	// httpOnly session cookie so the browser auto-sends it; the token is also
	// returned for non-browser API clients.
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: request.url.startsWith('https://'),
		maxAge: SESSION_TTL_SECONDS
	});

	const safeUser = {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		org: user.org,
		active: user.active,
		mfa_enabled: user.mfa_enabled
	};

	// This is the JSON API endpoint, whose purpose is non-browser clients that
	// authenticate with `Authorization: Bearer <token>` on subsequent requests.
	// They cannot read the httpOnly cookie, so the raw token IS the deliverable
	// here and is intentionally returned. Browsers should use the form action at
	// /login, which never exposes the token to JS.
	return json({ token, user: safeUser, mfaRequired });
};
