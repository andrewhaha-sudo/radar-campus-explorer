// Observability (Epic E13, AC-13.5.1). Captures unhandled server errors with
// diagnostic context into error_log, and forwards to Sentry when a DSN is set.
// Kept out of hooks.server.ts so it is unit-testable via a relative import.

import { uuid } from './auth';

type Env = { DB?: D1Database; SENTRY_DSN?: string };

export interface CapturedError {
	message: string;
	stack?: string | null;
	url?: string;
	status?: number;
	userId?: string | null;
}

/**
 * Record an error. Skips 404s (noise). Returns the generated error id (handed
 * back to the client for support correlation). Never throws.
 */
export async function captureError(env: Env | undefined, e: CapturedError): Promise<string> {
	const id = uuid();
	if (!env?.DB || e.status === 404) {
		if (env?.SENTRY_DSN) await forwardSentry(env.SENTRY_DSN, id, e).catch(() => {});
		return id;
	}
	try {
		await env.DB.prepare(
			'INSERT INTO error_log (id, message, stack, url, status, user_id) VALUES (?, ?, ?, ?, ?, ?)'
		)
			.bind(id, e.message, e.stack ?? null, e.url ?? null, e.status ?? null, e.userId ?? null)
			.run();
	} catch {
		// observability must never mask the original error
	}
	if (env.SENTRY_DSN) await forwardSentry(env.SENTRY_DSN, id, e).catch(() => {});
	return id;
}

async function forwardSentry(dsn: string, id: string, e: CapturedError): Promise<void> {
	await fetch('https://sentry.io/api/0/store/', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_key=${dsn}` },
		body: JSON.stringify({ event_id: id.replace(/-/g, ''), message: e.message, request: { url: e.url } })
	});
}
