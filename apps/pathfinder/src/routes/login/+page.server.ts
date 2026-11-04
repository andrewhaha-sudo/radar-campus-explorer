// Login form action (Epic E2, AC-2.1.1 / AC-2.1.2 / AC-2.4.1).
//
// Progressive-enhancement login: works with or without client JS (no hydration
// race). Validates email+password against D1, issues an HS256 JWT, sets it as
// an httpOnly session cookie, audits the event, updates last_login, then
// redirects to the scoped dashboard. Crypto/login logic ported from v1.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { signJWT, verifyPassword, getJwtSecret } from '$lib/server/auth';
import { audit, SESSION_COOKIE } from '$lib/server/session';
import { isLockedOut, recordFailure, resetFailures } from '$lib/server/ratelimit';
import { clientIp, DECOY_HASH, DECOY_SALT, validEmail, EMAIL_MAX, PASSWORD_MAX } from '$lib/server/login';

const GENERIC_ERROR = 'Invalid email or password.';
const LOCKOUT_ERROR = 'Too many attempts. Try again later.';
// 12 hours (see /api/auth/login for rationale).
const SESSION_TTL_SECONDS = 60 * 60 * 12;

interface UserRow {
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
}

export const actions: Actions = {
	default: async ({ request, platform, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') || '').toLowerCase().trim();
		const password = String(form.get('password') || '');

		const env = platform?.env;
		if (!env?.DB) return fail(500, { error: 'Database binding unavailable.', email });

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}
		// Cap input length and validate email shape before any DB/crypto work.
		if (email.length > EMAIL_MAX || password.length > PASSWORD_MAX || !validEmail(email)) {
			return fail(400, { error: GENERIC_ERROR, email });
		}

		const cache = env.CACHE;
		const ip = clientIp(request);

		// Lockout gate (degrades to no-op without KV).
		if (await isLockedOut(cache, ip, email)) {
			await audit(env, null, 'access.denied', `lockout:${email}`, request);
			return fail(429, { error: LOCKOUT_ERROR, email });
		}

		const user = await env.DB.prepare(
			'SELECT id, name, email, role, org, active, mfa_enabled, token_version, password_hash, salt FROM users WHERE email = ? AND active = 1'
		)
			.bind(email)
			.first<UserRow>();

		if (!user) {
			// Anti-enumeration: run a real hash against the constant decoy so the
			// timing matches the known-user path, then fail generically.
			await verifyPassword(password, DECOY_SALT, DECOY_HASH);
			await recordFailure(cache, ip, email);
			await audit(env, null, 'access.denied', `login:${email}`, request);
			return fail(401, { error: GENERIC_ERROR, email });
		}

		const valid = await verifyPassword(password, user.salt, user.password_hash);
		if (!valid) {
			await recordFailure(cache, ip, email);
			await audit(env, user.id, 'access.denied', `user:${user.id}`, request);
			return fail(401, { error: GENERIC_ERROR, email });
		}

		// Success: clear any failure counters for this IP/email.
		await resetFailures(cache, ip, email);

		const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
		const token = await signJWT(
			{ sub: user.id, role: user.role, email: user.email, tv: user.token_version ?? 0, exp },
			getJwtSecret(env)
		);

		await env.DB.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?')
			.bind(user.id)
			.run();
		await audit(env, user.id, 'auth.login', `user:${user.id}`, request);

		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: SESSION_TTL_SECONDS
		});

		const redirectTo = url.searchParams.get('redirectTo') || '/dashboard';
		redirect(303, redirectTo);
	}
};
