// Public read-only share view (Epic E9). A share token is its own bearer of
// access (no login), so this route is outside the auth guard. The token
// resolves to a resource; for a document we render a read-only summary of its
// annotations and map markers. Invalid/expired/revoked tokens 404.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveShareLink } from '$lib/server/collab';
import { listAnnotations, listMarkers } from '$lib/server/documents';

export const load: PageServerLoad = async ({ platform, params }) => {
	const env = platform?.env;
	if (!env?.DB) error(500, 'Database binding unavailable.');

	const target = await resolveShareLink(env, params.token);
	if (!target) error(404, 'This share link is invalid or has expired.');

	if (target.resource_type === 'document') {
		const doc = await env.DB.prepare('SELECT id, filename, page_count FROM documents WHERE id = ?')
			.bind(target.resource_id)
			.first<{ id: string; filename: string; page_count: number }>();
		if (!doc) error(404, 'Shared document no longer exists.');
		const [annotations, markers] = await Promise.all([
			listAnnotations(env, doc.id),
			listMarkers(env, doc.id)
		]);
		return { kind: 'document' as const, document: doc, annotations, markers };
	}

	return { kind: 'other' as const, resource: target };
};
