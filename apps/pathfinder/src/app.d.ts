// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces.
/// <reference types="@cloudflare/workers-types" />

/** Authenticated user shape exposed on event.locals (Epic E2). */
interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'staff' | 'client';
	org: string | null;
	active: number;
	mfa_enabled: number;
}

declare global {
	namespace App {
		interface Error {
			message: string;
			errorId?: string;
		}
		interface Locals {
			/** Populated by hooks.server.ts from the JWT, or null if unauthenticated. */
			user: SessionUser | null;
			/** When authenticated via an API key, its scope ('read'|'write'); else null. */
			apiScope: 'read' | 'write' | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			// Cloudflare bindings (canonical sec 3), available in dev via the
			// SvelteKit platformProxy (wrangler.toml) and in production on Pages.
			env?: {
				DB: D1Database;
				JWT_SECRET?: string;
				DOCUMENTS?: R2Bucket;
				CACHE?: KVNamespace;
				RESEND_API_KEY?: string;
				RESEND_FROM?: string;
				SENTRY_DSN?: string;
				// Workers AI binding (keyless) + external-provider key for the AI
				// briefing feature (provider/model/base-url live in the settings table).
				AI?: { run: (model: string, input: unknown) => Promise<unknown> };
				LLM_API_KEY?: string;
			};
		}
	}
}

export {};
