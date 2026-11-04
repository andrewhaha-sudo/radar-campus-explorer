// POST /api/auth/logout (Epic E2, AC-2.4.1). Clears the session cookie and
// writes an audit entry for the logout event.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { audit, SESSION_COOKIE } from '$lib/server/session';

export const POST: RequestHandler = async ({ platform, cookies, locals, request }) => {
	const env = platform?.env;
	if (env?.DB && locals.user) {
		// Bump token_version to revoke EVERY outstanding token for this user, not
		// just clear this browser's cookie. Defends against a stolen/leaked token
		// surviving logout (the same hook a password change would use).
		await env.DB.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?')
			.bind(locals.user.id)
			.run();
		await audit(env, locals.user.id, 'auth.logout', `user:${locals.user.id}`, request);
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ ok: true });
};
