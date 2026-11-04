// Server hooks (Epic E2 - Identity, Roles & Access).
//
// For every request: resolve the session token (httpOnly cookie first, then an
// Authorization: Bearer header for API clients) into event.locals.user. Then
// guard protected route trees - unauthenticated users hitting /dashboard are
// redirected to /login.

import { json, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	userFromToken,
	bearerFromRequest,
	apiKeyFromRequest,
	userFromApiKey
} from '$lib/server/session';
import { captureError } from '$lib/server/observability';

/** Route prefixes that require an authenticated session. (/share is public:
 *  a share token is its own bearer of read-only access.) */
const PROTECTED_PREFIXES = [
    '/campus-workspace',
	'/dashboard',
	'/districts',
	'/facilities',
	'/buildings',
	'/documents',
	'/scans',
	'/search',
	'/admin'
];

/**
 * Response-header Content-Security-Policy. Complements the document <meta> CSP
 * emitted by kit.csp (svelte.config.js): the meta policy hash-pins SvelteKit's
 * inline scripts for tight document enforcement, while this header policy is
 * permissive on script/style ('unsafe-inline') so it never blocks what the meta
 * policy already allows, and it carries frame-ancestors (which a <meta> CSP
 * cannot) and applies to every response, not just HTML documents.
 */
const CSP_HEADER = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self' data:",
	"connect-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	"form-action 'self'"
].join('; ');

/** Apply security headers to every response. */
function applySecurityHeaders(headers: Headers, isHttps: boolean, scanRuntime = false): void {
	headers.set('X-Frame-Options', 'DENY');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// Spark uses bundled data-URL Wasm and a local blob worker. Keep external
    // connections and general eval blocked; permit this runtime only on scan pages.
    const policy = scanRuntime ? CSP_HEADER
        .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'")
        .replace("connect-src 'self'", "connect-src 'self' data:") + "; worker-src 'self' blob:" : CSP_HEADER;
    headers.set('Content-Security-Policy', policy);
	if (isHttps) {
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
}

/** Same-origin CORS gate for /api/* (configured origins only). */
function corsCheck(event: Parameters<Handle>[0]['event']): Response | null {
	const origin = event.request.headers.get('Origin');
	if (!origin) return null; // same-origin / non-browser request: no CORS needed.
	const self = event.url.origin;
	if (origin === self) return null; // same-origin XHR.
	// Cross-origin API access is not permitted (no third-party origins configured).
	return json({ error: 'Cross-origin requests are not allowed.' }, { status: 403 });
}

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	event.locals.user = null;
	event.locals.apiScope = null;

	if (env?.DB) {
		const token = event.cookies.get(SESSION_COOKIE) || bearerFromRequest(event.request);
		event.locals.user = await userFromToken(token, env);
		// API-key auth (Epic E13): falls back to a scoped key when no JWT session.
		if (!event.locals.user) {
			const keyed = await userFromApiKey(apiKeyFromRequest(event.request), env);
			if (keyed) {
				event.locals.user = keyed.user;
				event.locals.apiScope = keyed.scope;
			}
		}
	}

	const path = event.url.pathname;

	// Lock /api/* to same-origin (or configured origins) before doing any work.
	if (path === '/api' || path.startsWith('/api/')) {
		const blocked = corsCheck(event);
		if (blocked) {
			applySecurityHeaders(blocked.headers, event.url.protocol === 'https:');
			return blocked;
		}
		// A read-scoped API key may not perform mutations (AC-13.2.1).
		const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
		if (event.locals.apiScope === 'read' && mutating) {
			const denied = json({ error: 'This API key is read-only.' }, { status: 403 });
			applySecurityHeaders(denied.headers, event.url.protocol === 'https:');
			return denied;
		}
	}

	const isProtected = PROTECTED_PREFIXES.some(
		(p) => path === p || path.startsWith(p + '/')
	);
	if (isProtected && !event.locals.user) {
		redirect(303, `/login?redirectTo=${encodeURIComponent(path)}`);
	}

	const response = await resolve(event);
	applySecurityHeaders(response.headers, event.url.protocol === 'https:', path.startsWith('/scans/'));
	return response;
};

/**
 * Observability (Epic E13, AC-13.5.1): capture every unhandled server error
 * with diagnostic context into error_log (and forward to Sentry when a DSN is
 * configured). Returns a safe shape to the client. Never throws.
 */
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	const err = error as Error;
	const id = await captureError(event.platform?.env, {
		message: err?.message ?? message,
		stack: err?.stack ?? null,
		url: event.url.pathname,
		status,
		userId: event.locals.user?.id ?? null
	});
	return { message: 'Internal Error', errorId: id };
};
